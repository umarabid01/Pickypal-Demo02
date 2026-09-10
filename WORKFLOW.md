# PickyPal — Complete Food Ordering System (MERN + Multi-Agent AI)

A fully-working AI food ordering assistant for people with allergies and dietary restrictions, deployed on Vercel (frontend) and Render (backend).

**This is a complete rewrite of the workflow**: proper onboarding → browsing by category (Desi/Fast Food) → selecting restaurant → ordering with add-ons/drinks/sides → itemized bill → payment (COD/JazzCash/EasyPaisa) → tracking → delivery.

---

## 🎯 What's New in This Version

### Workflow Overhaul
- **Proper onboarding**: Collects name → phone number → delivery address → allergen preferences in a deterministic (non-AI) flow, so users are never in a limbo of unclear validation rules.
- **Category-scoped discovery**: After onboarding, users choose Desi 🍛 or Fast Food 🍔, narrowing the restaurant list for clearer browsing.
- **Restaurant-specific ordering**: Once a restaurant is chosen, the Order Agent has access to that restaurant's FULL menu (mains, add-ons, drinks, sides, desserts) and can upsell naturally. Addons like "extra cheese" or "extra patty" are restaurant-specific — never mixed across restaurants.
- **Itemized bill confirmation**: Before payment, users see a clear, formatted bill and must confirm ("yes"/"no").
- **Three payment methods**: COD (cash on delivery), JazzCash, or EasyPaisa (all mocked but with realistic account details shown).
- **Allergen safety net**: Independent of what the AI returns, any item containing a user's known allergens is stripped from the cart before it's ever saved, and the user is warned.

### Data Model Enhancements
- **User model**: Added `phone`, `address`, `onboarding_complete` flag to track completion status.
- **Order model**: Added `customer_name`, `customer_phone`, `delivery_address`, `allergens_snapshot` (so the order is self-contained), `payment_method`, `payment_reference`, `confirmed` flag.
- **Restaurant model**: Added `category` (desi/fast_food) to each restaurant, and `category` (main/addon/side/drink/dessert) to each menu item.
- **ConversationLog**: Expanded phase enum with onboarding steps (collecting_name, collecting_phone, collecting_address, collecting_allergens), browsing, ordering, confirming, payment_method, paying, tracking, delivered.

### Backend Improvements
- **Validators module** (`lib/validators.js`): Deterministic, non-AI name/phone/address validators so onboarding is bulletproof.
- **Restaurants helper** (`lib/restaurants.js`): Category-scoped queries, allergen warnings per item, and menu context builders that group by category.
- **Payment agent** (`agents/payment.js`): Deterministic (rule-based) payment flow — no AI call needed since payment logic must be 100% reliable.
- **Orchestrator** (`lib/orchestrator.js`): Full phase machine, 500+ lines of well-structured control flow that never depends on the AI for onboarding or payment.
- **Seed data** (`data/seedRestaurants.json`): Now includes "Lahore Burger & Shawarma Hub" (burgers, shawarma, addons, sides, drinks) since the original lacked fast-food items.

### Frontend Updates
- **Context-aware quick replies**: Phase-specific buttons (e.g., "Desi"/"Fast Food" at browsing, "COD"/"JazzCash"/"EasyPaisa" at payment_method).
- **Updated phase stepper**: Shows Browse → Order → Pay → Track (hides onboarding steps).
- **Improved greeting**: Explains the onboarding flow upfront.

---

## 🚀 Architecture

```
pickypal-mern/
├── backend/     Express API + MongoDB (Node.js)
│   ├── models/
│   │   ├── User.js          (name, phone, address, allergies, onboarding_complete)
│   │   ├── Order.js         (items, payment_method, payment_reference, confirmed, etc.)
│   │   ├── Restaurant.js    (category: desi/fast_food, menu items with category)
│   │   └── ConversationLog.js
│   ├── agents/
│   │   ├── discovery.js     (post-onboarding browsing, category-scoped)
│   │   ├── order.js         (restaurant-specific, full menu with add-ons)
│   │   ├── payment.js       (deterministic: presents options, no AI call)
│   │   ├── preference.js    (allergen detection, used during onboarding & browsing)
│   │   ├── rider.js         (delivery tracking)
│   │   └── base.js          (shared AI call helper)
│   ├── lib/
│   │   ├── orchestrator.js  (phase machine: idle → collecting_* → browsing → ordering → confirming → payment_method → paying → tracking → delivered)
│   │   ├── validators.js    (name, phone, address validation — no AI)
│   │   ├── store.js         (MongoDB helpers)
│   │   └── restaurants.js   (category queries, allergen checks, menu context builders)
│   ├── prompts/
│   │   ├── discovery.system.md
│   │   ├── order.system.md
│   │   ├── payment.system.md (reference only — not used in live flow)
│   │   ├── preference.system.md
│   │   └── rider.system.md
│   ├── routes/
│   │   ├── message.js       (POST /api/message)
│   │   └── simulateStep.js  (POST /api/simulate-step)
│   ├── data/
│   │   └── seedRestaurants.json (6 restaurants: Basilico, Burning Brownie, Karachi Biryani House, Green Bowl, Lahore Tikka, **Lahore Burger & Shawarma Hub**)
│   ├── scripts/
│   │   └── seed.js          (loads restaurants into MongoDB)
│   ├── config/
│   │   ├── db.js
│   │   └── aiClient.js      (Groq API — using gpt-oss-120b for cost-effectiveness)
│   └── server.js            (Express entrypoint)
└── frontend/    React + Vite
    ├── src/
    │   ├── App.jsx
    │   ├── api.js           (fetch wrappers)
    │   ├── components/
    │   │   ├── ChatWindow.jsx    (context-aware quick replies by phase)
    │   │   ├── MessageBubble.jsx
    │   │   ├── AgentTracePanel.jsx (shows agent calls live)
    │   │   ├── PhaseStepper.jsx   (Browse → Order → Pay → Track)
    │   │   └── PhoneFrame.jsx     (WhatsApp-like UI)
    │   ├── globals.css
    │   └── main.jsx
    └── vite.config.js
```

### Phase Machine

```
┌─ idle (brand new session)
│  │
│  └─ collecting_name (deterministic validation)
│     └─ collecting_phone (deterministic validation)
│        └─ collecting_address (deterministic validation)
│           └─ collecting_allergens (AI: preference agent, unless "none")
│              └─ browsing ◄──────────────────────┐
│                 │ (Discovery Agent, category-scoped)
│                 │
│                 └─ ordering (Restaurant-specific)
│                    │ (Order Agent: mains, add-ons, drinks, sides)
│                    │
│                    └─ confirming (Itemized bill, deterministic)
│                       │ (Yes/No to confirm)
│                       │
│                       └─ payment_method (Deterministic choice)
│                          │ (COD / JazzCash / EasyPaisa)
│                          │
│                          ├─ tracking (COD path, skip to tracking)
│                          │  │ (Rider Agent: placed → preparing → rider_assigned → on_the_way → delivered)
│                          │  │
│                          │  └─ delivered → back to browsing
│                          │
│                          └─ paying (Wallet path: JazzCash/EasyPaisa)
│                             │ (Wait for user to confirm transfer)
│                             │
│                             └─ tracking
│                                │ (Rider Agent)
│                                │
│                                └─ delivered → back to browsing
└─ idle (returning user) ──→ browsing (skip onboarding)
```

---

## 🔧 Setup & Deployment

### Prerequisites
- **Node.js 18+**
- **MongoDB Atlas** (free tier is fine)
- **Groq API key** (free tier available at https://console.groq.com)
- **Vercel account** (for frontend)
- **Render account** (for backend)

### 1. Local Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env:
#   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/pickypal?retryWrites=true&w=majority
#   GROQ_API_KEY=your_groq_key_here
npm install
npm run seed          # Loads the 6 restaurants into MongoDB
npm run dev           # Starts on http://localhost:5000
```

### 2. Local Frontend Setup

```bash
cd frontend
cp .env.example .env  # VITE_API_URL=http://localhost:5000
npm install
npm run dev           # Starts on http://localhost:5173
```

Open http://localhost:5173 in your browser.

### 3. Deploy Backend to Render

1. Push the project to GitHub (both backend and frontend in the same repo).
2. Go to https://render.com, click **New → Web Service**.
3. Connect your GitHub repo.
4. Set:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Under **Environment**, add:
   - `MONGODB_URI` = your MongoDB Atlas connection string
   - `GROQ_API_KEY` = your Groq API key
   - `CORS_ORIGIN` = your frontend URL (can update later)
6. Deploy. Render gives you a URL like `https://pickypal-backend.onrender.com`.

### 4. Deploy Frontend to Vercel

1. Go to https://vercel.com, click **Add New → Project**.
2. Import the same GitHub repo.
3. Set:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
4. Under **Environment Variables**, add:
   - `VITE_API_URL` = your Render backend URL (from step 3)
5. Deploy. Vercel gives you a URL like `https://pickypal.vercel.app`.

### 5. Update Backend CORS

After frontend is deployed, go back to Render, update the `CORS_ORIGIN` env var to your Vercel URL, and redeploy.

---

## 📖 How It Works

### 1. **Onboarding** (deterministic)
- User sends first message → greet + ask for name
- Validates name (2–50 chars, letters only, no spam patterns)
- Asks for phone → validates Pakistani mobile (03XXXXXXXXX format)
- Asks for address → validates address (≥10 chars, has house/street number or ≥3 words)
- Asks for allergies → runs Preference Agent OR detects "none"/"no allergies"
- Sets `user.onboarding_complete = true` → moves to browsing

### 2. **Browsing** (Discovery Agent)
- Asks "Desi or Fast Food?" if not yet chosen
- Once category is set, filters restaurants by category and runs Discovery Agent
- Discovery Agent (with restaurant list already filtered to safe items per user's allergies) suggests main dishes
- If user names a specific dish or restaurant, strongly prefer the matching one (so ordering begins immediately)
- Multiple matches → ask user to pick

### 3. **Ordering** (Order Agent)
- User selected one restaurant → Order Agent gets that restaurant's FULL menu (mains, add-ons, sides, drinks, desserts)
- User says "add zinger burger" → Agent looks for it in this restaurant's menu
- Agent returns `order_items` array
- **Safety net**: Orchestrator strips any item containing a known allergen, warns user
- Agent upsells add-ons/drinks/sides from the same restaurant
- When user says "done", show cart; ask for confirmation

### 4. **Confirming** (deterministic)
- Show itemized bill: `📋 🍔 Zinger Burger (extra mayo) Rs.550 + 🍟 Regular Fries Rs.250 + 🥤 Coke Rs.150 = **Rs.950**`
- Ask: "Confirm? Reply **yes** or **no**"
- If yes → mark order as `confirmed: true`, move to payment_method
- If no → back to ordering

### 5. **Payment Method** (deterministic)
- Show three options: **COD**, **JazzCash**, **EasyPaisa**
- User picks one
- If COD → generate reference, confirm order placed, move to tracking
- If JazzCash/EasyPaisa → show mock account details, reference number, ask user to "reply when paid"

### 6. **Paying** (wallet flow only)
- User says "paid" / "done" / "sent" → confirm receipt
- Mark order as `payment_status: "paid"`, move to tracking

### 7. **Tracking** (Rider Agent)
- Show order status: placed → preparing → rider_assigned → on_the_way → delivered
- Each "Simulate Next Step" button click advances one step
- When delivered → back to browsing

---

## 🍽️ Restaurant & Menu Data

### Restaurants
1. **Basilico by Sara** (Fast Food) — Italian-Pakistani Fusion
2. **Burning Brownie** (Fast Food) — Café & Desserts
3. **Karachi Biryani House** (Desi) — Traditional Pakistani
4. **The Green Bowl** (Fast Food) — Vegetarian & Vegan
5. **Lahore Tikka** (Desi) — BBQ & Grill
6. **Lahore Burger & Shawarma Hub** (Fast Food) — Burgers & Shawarma **← NEW**

### Lahore Burger & Shawarma Hub Menu
- **Mains**: Zinger Burger, Beef Zinger Burger, Chicken Shawarma, Beef Shawarma
- **Add-ons**: Extra Cheese Slice, Extra Patty/Meat, Extra Mayo/Garlic Dip
- **Sides**: Regular Fries, Loaded Cheese Fries
- **Drinks**: Pepsi, Coca-Cola, Mineral Water

All items are tagged with allergens (gluten, dairy, eggs, sesame, etc.) and dietary info (halal, vegetarian, vegan).

---

## 🛡️ Safety Features

### Allergen Management
1. **Discovery phase**: Restaurants' menus are pre-filtered — only safe main items shown
2. **Order phase**: AI agent can see the full menu, but adds items to cart
3. **Safety net**: Before saving to DB, orchestrator strips any item with a known allergen and warns user
4. **Order record**: Allergens snapshot saved with order so delivery team & kitchen know what was checked

### Deterministic Onboarding & Payment
- Name/phone/address validation use hardcoded regex rules, not AI guessing
- Payment choices (COD/JazzCash/EasyPaisa) and confirmation logic are 100% rule-based
- Prevents ambiguity and ensures users always get predictable, clear guidance

---

## 🧠 AI Agents Used

| Agent | When Used | Input | Output |
|-------|-----------|-------|--------|
| **Preference** | Onboarding (allergens), continuous during browsing/ordering | User message | Detected allergies, dietary restrictions, language |
| **Discovery** | Browsing phase (after category chosen) | User message, restaurant list (category-filtered, allergy-filtered) | Matched restaurants with safe items, reply |
| **Order** | Ordering phase | User message, restaurant's full menu, current cart | Cart updates (add/remove/modify items), upsell suggestions, reply |
| **Payment** | Payment phase | Deterministic logic (no AI call) | Account details, reference number, confirmation reply |
| **Rider** | Tracking phase | Current order status | Next status, ETA, delivery narrative, reply |

**Why deterministic payment?** Payment logic must be 100% bulletproof and predictable. Hardcoding JazzCash/EasyPaisa account details and COD confirmation ensures no edge cases or misunderstandings.

---

## 📊 Database Schema (MongoDB)

### Users
```javascript
{
  session_phone: String,          // unique, internal session ID
  name: String,
  phone: String,                  // real contact phone (03XXXXXXXXX)
  address: String,                // delivery address
  language_pref: "en" | "ur" | "pa",
  allergies: [String],
  dietary_restrictions: [String],
  onboarding_complete: Boolean,
  created_at: Date
}
```

### Orders
```javascript
{
  user_id: ObjectId,              // ref to User
  restaurant_id: String,
  restaurant_name: String,
  items: [                         // ordered items
    {
      item_id: String,
      item_name: String,
      quantity: Number,
      base_price: Number,
      customizations: [String],    // "extra spicy", "no pickles", etc.
      item_total: Number
    }
  ],
  status: "placed" | "preparing" | "rider_assigned" | "on_the_way" | "delivered",
  payment_method: "cod" | "jazzcash" | "easypaisa",
  payment_status: "pending" | "paid",
  payment_reference: String,      // e.g. "PP-2024-ABC123"
  customer_name: String,          // snapshot at order time
  customer_phone: String,         // snapshot at order time
  delivery_address: String,       // snapshot at order time
  allergens_snapshot: [String],   // what was checked
  confirmed: Boolean,             // has user confirmed?
  total: Number,
  created_at: Date
}
```

### Restaurants
```javascript
{
  id: String,                     // stable, unique ID
  name: String,
  cuisine: String,
  location: String,
  rating: Number,
  halal_certified: Boolean,
  category: "desi" | "fast_food",
  menu_items: [
    {
      id: String,
      item_name: String,
      description: String,
      price: Number,
      allergens: [String],
      dietary_tags: [String],
      customizable: Boolean,
      customization_options: String,
      category: "main" | "addon" | "side" | "drink" | "dessert"
    }
  ]
}
```

### ConversationLog
```javascript
{
  session_id: String,             // unique per session
  phase: String,                  // see phase machine above
  selected_restaurant_id: String,
  selected_restaurant_name: String,
  category_preference: "desi" | "fast_food" | null,
  pending_payment_method: String,
  pending_payment_reference: String,
  messages: [{ id, role, content, timestamp }],
  trace_steps: [{ id, agent_name, action, status, output_json, ... }]
}
```

---

## 🎮 Testing the Flow

### Recommended Demo Sequence

1. **Greeting**: Open the app, send any message
   - Bot asks for your name
2. **Name**: Type "Ahmed Khan"
   - Bot asks for phone
3. **Phone**: Type "03001234567"
   - Bot asks for address
4. **Address**: Type "House 12, Street 5, Gulberg III, Lahore"
   - Bot asks about allergies
5. **Allergies**: Type "peanuts" (or "none")
   - Bot shows: "Would you like Desi or Fast Food?"
6. **Category**: Type "Fast Food"
   - Bot shows restaurants (Green Bowl, Basilico, Burning Brownie, Burger Hub)
7. **Browse**: Type "burger"
   - Bot suggests "Lahore Burger & Shawarma Hub" with Zinger Burger, Beef Zinger Burger
8. **Order**: Type "Zinger Burger"
   - Bot adds it, shows cart, upsells: "Want fries or a drink?"
9. **Add-ons**: Type "yes, fries and a coke"
   - Bot adds fries and drink
10. **Checkout**: Type "done" or "checkout"
    - Bot shows itemized bill, asks to confirm
11. **Confirm**: Type "yes"
    - Bot asks which payment method
12. **Payment**: Type "COD"
    - Bot confirms order placed, moves to tracking
13. **Track**: Click "🏍️ Simulate Next Step" 5 times
    - placed → preparing → rider_assigned → on_the_way → delivered
14. **End**: Bot says "Want to order again?" → back to browsing

---

## 🔐 Environment Variables

### Backend (.env)
```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/pickypal?retryWrites=true&w=majority
GROQ_API_KEY=your_groq_api_key_here
PORT=5000
CORS_ORIGIN=http://localhost:5173,https://pickypal.vercel.app
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000
```

---

## 🚨 Known Limitations & Future Work

1. **Payment is mocked** — no real JazzCash/EasyPaisa integration. In production, integrate with their APIs.
2. **Delivery is mocked** — no real rider assignment or GPS tracking. In production, integrate with a delivery fleet API.
3. **WhatsApp channel is mocked** — this is a web chat, not real WhatsApp. To go live, integrate with WhatsApp Cloud API (Meta).
4. **Restaurant admin dashboard** — no UI for restaurants to view/manage incoming orders. Add this for a complete seller product.
5. **Rating & reviews** — users can't rate dishes or restaurants post-delivery.
6. **Multi-language NLU** — currently relies on simple regex for language detection. Could improve with a proper NLU classifier.

---

## 📝 Deployment Checklist

- [ ] MongoDB Atlas cluster created, IP whitelist configured
- [ ] Groq API key obtained
- [ ] Backend pushed to Render, env vars set
- [ ] Frontend pushed to Vercel, env vars set
- [ ] Render CORS_ORIGIN updated with Vercel URL
- [ ] Test full flow end-to-end on production URLs
- [ ] Share links with stakeholders

---

## 📬 Support & Questions

For questions or issues, refer to:
- Agent Trace Panel (right side of UI) — shows every AI call, input, and JSON output
- MongoDB logs — check for data persistence issues
- Render/Vercel logs — check for deployment errors

---

**Built with Node.js, Express, MongoDB, React, Vite, Groq AI, and ❤️ for people with allergies.**
