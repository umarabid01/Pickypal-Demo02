# PickyPal — Quick Changes Reference

## What Changed

### ✅ Onboarding is now bulletproof
- **Before**: Skipped or merged into discovery
- **After**: 5-step deterministic flow (name → phone → address → allergens → browsing)
  - Name/phone/address validated with regex (no AI guessing)
  - Allergens detected via Preference Agent (or "none" shortcut)
  - `user.onboarding_complete` flag prevents repeat onboarding

### ✅ Menu structure now supports addons/drinks/sides
- **Before**: Flat list of menu items
- **After**: Items categorized as `main`, `addon`, `side`, `drink`, `dessert`
- **Why**: Addons ("extra cheese") only show up AFTER a restaurant is chosen, upsold contextually

### ✅ Restaurants scoped to categories
- **Before**: All restaurants shown, discovery had to filter
- **After**: Restaurant has `category: "desi"` or `category: "fast_food"`
  - User picks category at start of browsing
  - Discovery Agent only sees restaurants in that category
  - Cleaner UX: "Desi or Fast Food?" → narrow list

### ✅ Payment flow is now deterministic
- **Before**: AI agent (`runPaymentAgent`) decided payment logic
- **After**: Rule-based functions (`presentPaymentOptions`, `initiateWalletPayment`, `confirmCODOrder`, etc.)
  - No LLM call for payment — must be 100% reliable
  - Shows mock JazzCash/EasyPaisa account details
  - COD confirmation is instant
  - Reference numbers generated deterministically

### ✅ Order cart now has safety net
- **Before**: Trust the AI to not suggest unsafe items
- **After**: Orchestrator strips any item containing a known allergen BEFORE saving
  - Independent check: `sanitizeOrderItems()` function
  - Warns user about removed items
  - Order record includes `allergens_snapshot` for audit trail

### ✅ New burger/shawarma restaurant
- **Before**: No "burger" or "shawarma" items in seed data
- **After**: "Lahore Burger & Shawarma Hub" with:
  - Mains: Zinger Burger, Beef Zinger, Chicken Shawarma, Beef Shawarma
  - Addons: Extra Cheese, Extra Patty, Extra Mayo
  - Sides: Regular Fries, Loaded Cheese Fries
  - Drinks: Pepsi, Coke, Water

---

## File-by-File Changes

### Backend Models

| File | Changes |
|------|---------|
| `User.js` | Added `phone`, `address`, `onboarding_complete` |
| `Order.js` | Added customer snapshot fields + payment_method/reference + confirmed flag |
| `Restaurant.js` | Added `category` to restaurant; added `category` to menu items |
| `ConversationLog.js` | Expanded phase enum with onboarding + payment flow phases; added `category_preference`, `pending_payment_*` |

### Backend Libraries

| File | Changes |
|------|---------|
| `lib/validators.js` | **NEW** — Deterministic name/phone/address/allergen validators |
| `lib/orchestrator.js` | **COMPLETE REWRITE** — 500+ line phase machine with all the logic |
| `lib/store.js` | Added contact update, order item update, confirm, payment method, reference setters |
| `lib/restaurants.js` | Added category queries, allergen warning helper, category-grouped menu context |

### Backend Agents

| File | Changes |
|------|---------|
| `agents/discovery.js` | Category-scoped, runs only post-onboarding |
| `agents/order.js` | Restaurant-specific menu context with add-ons/drinks/sides |
| `agents/payment.js` | **CHANGED TO DETERMINISTIC** — no more `callAgent()`, just rule-based logic |
| `agents/preference.js` | No changes (still used during onboarding & browsing) |
| `agents/rider.js` | No changes |

### Backend Prompts

| File | Changes |
|------|---------|
| `discovery.system.md` | Updated for post-onboarding, category-scoped flow |
| `order.system.md` | Updated to mention category-grouped menu, add-on upselling |
| `payment.system.md` | Added deprecation note (not used in live flow) |

### Backend Data

| File | Changes |
|------|---------|
| `data/seedRestaurants.json` | Categorized all items; added new "Lahore Burger & Shawarma Hub" restaurant |
| `scripts/seed.js` | No changes (should work as-is) |

### Frontend Components

| File | Changes |
|------|---------|
| `App.jsx` | Updated greeting message to explain onboarding |
| `components/ChatWindow.jsx` | **Context-aware quick replies** by phase; updated PHASE_STATUS |
| `components/PhaseStepper.jsx` | Updated to Browse → Order → Pay → Track; folds onboarding/confirming into previous step |
| `components/AgentTracePanel.jsx` | Updated badge names for new phases |

### Documentation

| File | Status |
|------|--------|
| `WORKFLOW.md` | **NEW** — Comprehensive 500-line guide to the new flow |
| `README.md` | Original, still valid for basic setup |

---

## Phase Machine (Updated)

```
idle
  ├─→ collecting_name (regex validation)
  │    └─→ collecting_phone (regex validation)
  │         └─→ collecting_address (regex validation)
  │              └─→ collecting_allergens (Preference Agent | "none" shortcut)
  │                   └─→ browsing (Discovery Agent, category-scoped)
  │                        └─→ ordering (Order Agent, restaurant-specific)
  │                             └─→ confirming (deterministic bill)
  │                                  └─→ payment_method (deterministic choice)
  │                                       ├─→ tracking (COD path)
  │                                       │    └─→ delivered
  │                                       └─→ paying (wallet path)
  │                                            └─→ tracking
  │                                                 └─→ delivered
  └─→ browsing (returning user, skip onboarding)
       └─ ... (same as above)
```

---

## Key Behaviors

### Onboarding
- **Name**: Must be 2–50 chars, letters/Urdu script only, no all-digits
- **Phone**: Pakistani mobile only (03XXXXXXXXX), normalized to this format
- **Address**: ≥10 chars, must have house/street number OR ≥3 words
- **Allergens**: AI extracts them, OR user can type "none"/"no allergies"

### Browsing
- If user hasn't chosen Desi/Fast Food, agent asks
- Once category is chosen, Discovery Agent only sees that category
- If user names a specific dish (e.g., "burger", "biryani"), prefer the ONE restaurant that has it

### Ordering
- Order Agent gets FULL menu (mains + add-ons + sides + drinks + desserts) for the selected restaurant only
- After user adds a main, agent upsells add-ons/sides/drinks
- Safety net: Strip items with known allergens before saving cart

### Confirming
- Show itemized bill (quantity × item + customizations = item total)
- Ask: "Confirm? Reply yes or no"
- If no, return to ordering

### Payment
- Three methods: COD, JazzCash, EasyPaisa (all mocked)
- COD: Show reference, confirm placed, go to tracking
- JazzCash/EasyPaisa: Show account details, wait for user to say "paid", then go to tracking

### Tracking
- Rider Agent advances status: placed → preparing → rider_assigned → on_the_way → delivered
- Demo button "Simulate Next Step" advances one step per click

---

## Example Conversation Flow

**User**: "Hi"
**Bot**: "Assalam-o-Alaikum! Welcome to PickyPal. Before we start, may I have your full name?"
[phase: collecting_name]

**User**: "Ahmed Khan"
**Bot**: "Nice to meet you, Ahmed! 📱 What's the best phone number to reach you on? (e.g., 03001234567)"
[phase: collecting_phone]

**User**: "03001234567"
**Bot**: "Got it ✅ Now, what's your complete delivery address?"
[phase: collecting_address]

**User**: "House 12, Street 5, Gulberg III, Lahore"
**Bot**: "Perfect 📍 Last thing — any allergies or dietary restrictions? (Or just reply "none")"
[phase: collecting_allergens]

**User**: "no peanuts"
**Bot**: "Thanks, I've noted that. All set! 🎉 Would you like Desi 🍛 or Fast Food 🍔 today?"
[phase: browsing]

**User**: "I want a burger"
**Bot**: "Great! I found **Lahore Burger & Shawarma Hub**. Safe for you: Zinger Burger (Rs.550), Beef Zinger Burger (Rs.600). Which one?"
[phase: browsing, 1 restaurant matched]

**User**: "Zinger burger"
**Bot**: "Perfect! Adding 1x Zinger Burger. Want to add fries or a drink? We have Regular Fries (Rs.250), Loaded Cheese Fries (Rs.400), Coke (Rs.150)."
[phase: ordering]

**User**: "fries and coke"
**Bot**: "Great! Your cart: 1x Zinger Burger (Rs.550) + 1x Regular Fries (Rs.250) + 1x Coke (Rs.150) = Rs.950. Anything else?"
[phase: ordering]

**User**: "done"
**Bot**: "📋 Order Summary — Lahore Burger & Shawarma Hub
  • 1x Zinger Burger — Rs.550
  • 1x Regular Fries — Rs.250
  • 1x Coke — Rs.150
**Total: Rs.950**

Confirm? Reply yes or no."
[phase: confirming]

**User**: "yes"
**Bot**: "✅ Order confirmed!

How would you like to pay?
- 💵 **Cash on Delivery (COD)**
- 📱 **JazzCash**
- 📱 **EasyPaisa**

Just reply with one of: "COD", "JazzCash", or "EasyPaisa"."
[phase: payment_method]

**User**: "cod"
**Bot**: "💵 Cash on Delivery confirmed!

Please keep Rs.950 ready for the rider. Order reference: PP-2026-ABC123.

Sending your order to the restaurant now... 🍽️"
[phase: tracking, order placed]

**User**: (click "Simulate Next Step")
**Bot**: "The kitchen at Lahore Burger & Shawarma Hub is preparing your food! 👨‍🍳"
[status: preparing]

**User**: (click "Simulate Next Step" x4)
**Bot**: [shows rider assigned, on the way, then...]
**Bot**: "Your order has been delivered! 🎉 Enjoy your meal! Khana enjoy karein!"
[phase: delivered]

---

## Testing Checklist

- [ ] New user → collect name/phone/address/allergies → browse
- [ ] Pick "Desi" category → see desi restaurants only
- [ ] Pick "Fast Food" category → see fast food restaurants only
- [ ] Pick burger restaurant → Order Agent shows burgers + addons
- [ ] Add burger + fries + drink → see cart
- [ ] Confirm order → payment method screen
- [ ] Choose COD → tracking phase
- [ ] Simulate delivery steps → see status progression
- [ ] Returning user → skip onboarding, go straight to browsing
- [ ] Allergen safety net → add item with known allergen → should be stripped with warning
