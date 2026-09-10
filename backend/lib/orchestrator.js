// ============================================================
// PickyPal — Orchestrator
// Central control flow: receives message -> determines phase ->
// runs deterministic onboarding OR routes to AI agent(s) ->
// executes DB writes -> returns reply + trace.
//
// Phase machine:
//   idle
//     -> collecting_name -> collecting_phone -> collecting_address
//     -> collecting_allergens -> browsing
//   browsing            (desi/fast-food + Discovery Agent)
//     -> ordering
//   ordering            (Order Agent: mains, add-ons, drinks, sides)
//     -> confirming
//   confirming          (deterministic itemized bill + yes/no)
//     -> payment_method
//   payment_method      (COD / JazzCash / EasyPaisa)
//     -> paying (wallets only) -> tracking
//     -> tracking (COD, immediately)
//   tracking            (Rider Agent, mocked fulfillment)
//     -> delivered -> back to browsing
// ============================================================
import crypto from "crypto";
import {
  getOrCreateUser,
  updateUserPreferences,
  updateUserContact,
  getConversation,
  updateConversation,
  addMessage,
  createOrder,
  updateOrderItems,
  confirmOrder,
  setOrderPaymentMethod,
  setOrderReference,
  getActiveOrder,
  getDraftOrder,
  updateOrderStatus,
  updateOrderPayment,
} from "./store.js";
import { getRestaurantById, getRestaurantByName, getItemAllergenWarningWithCustomizations } from "./restaurants.js";
import { runDiscoveryAgent } from "../agents/discovery.js";
import { runPreferenceAgent } from "../agents/preference.js";
import { runOrderAgent } from "../agents/order.js";
import {
  presentPaymentOptions,
  initiateWalletPayment,
  confirmCODOrder,
  confirmWalletPaymentReceived,
} from "../agents/payment.js";
import { runRiderAgent } from "../agents/rider.js";
import { validateName, validatePhone, validateAddress, isNoAllergyResponse } from "./validators.js";

// ---------- small helpers ----------

function buildConversationHistory(messages, maxMessages = 10) {
  const recent = messages.slice(-maxMessages);
  return recent.map((m) => `${m.role === "user" ? "User" : "PickyPal"}: ${m.content}`).join("\n");
}

function isResetRequest(message) {
  const t = message.toLowerCase();
  return t.includes("start over") || t.includes("new order") || t.includes("naya order");
}

function isAffirmative(message) {
  const t = message.trim().toLowerCase();
  return ["yes", "y", "yeah", "yep", "confirm", "confirmed", "haan", "han", "theek hai", "ok", "okay", "sure"].some(
    (w) => t === w || t.startsWith(w + " ") || t.includes(w)
  );
}

function isNegative(message) {
  const t = message.trim().toLowerCase();
  return ["no", "nah", "nahi", "nai", "cancel", "change"].some((w) => t === w || t.includes(w));
}

function isCheckoutTrigger(message) {
  const t = message.toLowerCase();
  return [
    "done",
    "that's all",
    "thats all",
    "checkout",
    "check out",
    "bill",
    "total",
    "finish",
    "no more",
    "confirm order",
    "proceed to payment",
    "place my order",
    "place order",
    "place the order",
    "place it",
    "final order",
    "finalize order",
    "finalise order",
    "final",
    "bas",
    "bas itna",
  ].some((w) => t.includes(w));
}

function parseCategoryPreference(message) {
  const t = message.toLowerCase();
  if (/\bdesi\b|pakistani|traditional|biryani|karahi|tikka/.test(t)) return "desi";
  if (/fast\s*food|burger|shawarma|pizza|western|pasta|cafe/.test(t)) return "fast_food";
  return null;
}

function parsePaymentMethod(message) {
  const t = message.toLowerCase();
  if (/\bcod\b|cash on delivery|\bcash\b/.test(t)) return "cod";
  if (/jazz\s*cash/.test(t)) return "jazzcash";
  if (/easy\s*paisa/.test(t)) return "easypaisa";
  return null;
}

function formatBill(order) {
  const lines = order.items
    .map(
      (i) =>
        `  • ${i.quantity}x ${i.item_name}${i.customizations.length ? ` (${i.customizations.join(", ")})` : ""} — Rs.${i.item_total}`
    )
    .join("\n");
  const deliveryFee = order.delivery_fee ?? 100;
  const subtotal = order.items.reduce((sum, item) => sum + item.item_total, 0);
  return `**Delivery**\n- ${order.customer_name || "Customer"}\n- ${order.customer_phone || "Phone not provided"}\n- ${order.delivery_address || "Address not provided"}\n\n**Restaurant**\n- ${order.restaurant_name}\n\n**Order**\n${lines}\n\nSubtotal: **Rs.${subtotal}**\nDelivery Fee: **Rs.${deliveryFee}**\n**Total: Rs.${order.total}**`;
}

function extractPaymentReference(message) {
  const match = message.match(/(?:transaction|reference|ref(?:erence)?\s*(?:number|no|#)?|id)\D{0,12}(\d{6,})/i);
  return match?.[1] || null;
}

// ---------- allergen safety net ----------
// Independent of what the AI returns, strip any item that contains one of
// the user's known allergens before it's ever saved to the cart, and warn.
async function sanitizeOrderItems(restaurantId, orderItems, userAllergies) {
  const restaurant = await getRestaurantById(restaurantId);
  const warnings = [];
  const safeItems = [];

  for (const item of orderItems) {
    const menuItem = restaurant?.menu_items.find((m) => m.id === item.item_id || m.item_name === item.item_name);
    const hits = menuItem
      ? getItemAllergenWarningWithCustomizations(menuItem, userAllergies, item.customizations)
      : null;
    if (hits) {
      warnings.push(`⚠️ Removed **${item.item_name}** from your cart — it contains ${hits.join(", ")}, which you're allergic to.`);
      continue;
    }
    safeItems.push(item);
  }

  const total = safeItems.reduce((sum, i) => sum + i.item_total, 0);
  return { safeItems, total, warnings };
}

function needsAddonTargetClarification(message, order) {
  if (!order?.items?.length || !/extra\s+cheese|cheese\s+slice|add\s+cheese/i.test(message)) return false;

  const eligibleItems = order.items.filter((item) => /burger|shawarma/i.test(item.item_name));
  if (eligibleItems.length <= 1) return false;

  const text = message.toLowerCase();
  return !eligibleItems.some((item) => text.includes(item.item_name.toLowerCase()));
}

// ---------- shared "run the order agent + persist cart" step ----------
async function processOrderingTurn(sessionId, user, conv, userMessage) {
  const restaurantId = conv.selected_restaurant_id;
  const restaurantName = conv.selected_restaurant_name || "the restaurant";
  const draftOrder = await getDraftOrder(user._id);

  if (needsAddonTargetClarification(userMessage, draftOrder)) {
    const eligibleItems = draftOrder.items
      .filter((item) => /burger|shawarma/i.test(item.item_name))
      .map((item) => `- ${item.item_name} (currently ${item.quantity} in your cart)`)
      .join("\n");
    return {
      replyText: `Which item should get the extra cheese, and how many?\n${eligibleItems}\n\nFor example: **extra cheese on 1 Beef Zinger Burger**.`,
    };
  }

  const orderResult = await runOrderAgent(
    sessionId,
    userMessage,
    user,
    restaurantId,
    restaurantName,
    draftOrder,
    buildConversationHistory(conv.messages)
  );

  let replyText = orderResult.reply_text;

  if (orderResult.order_items?.length) {
    const { safeItems, total, warnings } = await sanitizeOrderItems(restaurantId, orderResult.order_items, user.allergies);

    if (draftOrder) {
      await updateOrderItems(draftOrder._id, safeItems, total, orderResult.restaurant_id, orderResult.restaurant_name, 100);
    } else if (safeItems.length) {
      await createOrder(user._id, orderResult.restaurant_id || restaurantId, orderResult.restaurant_name || restaurantName, safeItems, total + 100, {
        customer_name: user.name,
        customer_phone: user.phone,
        delivery_address: user.address,
        allergens_snapshot: user.allergies,
        delivery_fee: 100,
      });
    }

    if (warnings.length) {
      replyText = `${warnings.join("\n")}\n\n${replyText}`;
    }
  }

  return { replyText };
}

// ---------- main entry point ----------

export async function handleMessage(sessionId, userMessage) {
  const newTraceSteps = [];
  let replyText = "";

  const user = await getOrCreateUser(sessionId);
  let conv = await getConversation(sessionId);

  const userMsg = {
    id: crypto.randomUUID(),
    role: "user",
    content: userMessage,
    timestamp: new Date().toISOString(),
  };
  await addMessage(sessionId, userMsg);

  let phase = conv.phase;

  // Global reset — works from any phase except mid-onboarding (so someone
  // typing "new order" as their name doesn't accidentally wipe state).
  const midOnboarding = ["idle", "collecting_name", "collecting_phone", "collecting_address", "collecting_allergens"].includes(
    phase
  );
  if (!midOnboarding && isResetRequest(userMessage)) {
    await updateConversation(sessionId, {
      selected_restaurant_id: null,
      selected_restaurant_name: null,
      category_preference: null,
      pending_payment_method: null,
      pending_payment_reference: null,
      phase: "browsing",
    });
    replyText = `Sure, starting a fresh order! 🍽️ Would you like something **Desi** 🍛 or **Fast Food** 🍔 today?`;
    const agentMsg = { id: crypto.randomUUID(), role: "agent", content: replyText, timestamp: new Date().toISOString() };
    await addMessage(sessionId, agentMsg);
    return { reply: replyText, traceSteps: [], phase: "browsing" };
  }

  const traceCountBefore = conv.trace_steps.length;

  try {
    // ================= ONBOARDING =================

    let skipChain = false;
    if (phase === "idle") {
      if (user.onboarding_complete) {
        // Returning user — skip straight to browsing and process this
        // message as a food query right away.
        phase = "browsing";
      } else {
        // Brand-new session: just greet and ask for a name. The message
        // that triggered "idle" (e.g. a generic "hi") is NOT itself a name
        // attempt — wait for the next message before validating a name.
        phase = "collecting_name";
        replyText = `Assalam-o-Alaikum! 👋 Welcome to PickyPal — before we get started, may I have your **full name**?`;
        skipChain = true;
      }
    }

    if (skipChain) {
      // handled above — fall through to persistence at the bottom
    } else if (phase === "collecting_name") {
      const check = validateName(userMessage);
      if (!check.valid) {
        replyText = `Hmm, that doesn't look like a valid name 🤔 Please enter your **full name** using letters only (e.g. "Ahmed Khan").`;
      } else {
        await updateUserContact(sessionId, { name: check.value });
        replyText = `Nice to meet you, ${check.value}! 📱 What's the best **phone number** to reach you on? (e.g. 03001234567)`;
        phase = "collecting_phone";
      }
    } else if (phase === "collecting_phone") {
      const check = validatePhone(userMessage);
      if (!check.valid) {
        replyText = `That doesn't look like a valid Pakistani mobile number 📵 Please enter it like **03001234567** or **+923001234567**.`;
      } else {
        await updateUserContact(sessionId, { phone: check.value });
        replyText = `Got it ✅ Now, what's your **complete delivery address** (house/street, area, city)?`;
        phase = "collecting_address";
      }
    } else if (phase === "collecting_address") {
      const check = validateAddress(userMessage);
      if (!check.valid) {
        replyText = `Could you share a more **complete address**? Include your house/street number and area, e.g. "House 12, Street 5, Gulberg III, Lahore".`;
      } else {
        await updateUserContact(sessionId, { address: check.value });
        replyText = `Perfect 📍 Last thing — do you have **any food allergies** I should know about (e.g. peanuts, dairy, gluten)? If none, just reply "none".`;
        phase = "collecting_allergens";
      }
    } else if (phase === "collecting_allergens") {
      if (isNoAllergyResponse(userMessage)) {
        replyText = `Great, noted — no allergies on file ✅`;
      } else {
        const prefResult = await runPreferenceAgent(sessionId, userMessage, user);
        const latestConv = await getConversation(sessionId);
        newTraceSteps.push(...latestConv.trace_steps.slice(traceCountBefore));

        if (prefResult.has_updates) {
          await updateUserPreferences(sessionId, {
            allergies: prefResult.new_allergies,
            dietary_restrictions: prefResult.new_dietary_restrictions,
            language_pref: prefResult.detected_language,
          });
        }
        replyText = prefResult.reply_text || `Thanks, I've noted that down and will keep you safe from those! ✅`;
      }

      await updateUserContact(sessionId, { onboarding_complete: true });
      replyText += `\n\nAlright, you're all set! 🎉 Would you like something **Desi** 🍛 or **Fast Food** 🍔 today?`;
      phase = "browsing";
    }

    // ================= BROWSING (discovery) =================
    else if (phase === "browsing") {
      const freshConv = await getConversation(sessionId);
      let categoryPreference = freshConv.category_preference;
      const detectedCategory = parseCategoryPreference(userMessage);
      if (!categoryPreference && detectedCategory) {
        categoryPreference = detectedCategory;
        await updateConversation(sessionId, { category_preference: categoryPreference });
      }

      const [prefResult, discoveryResult] = await Promise.all([
        runPreferenceAgent(sessionId, userMessage, user),
        runDiscoveryAgent(sessionId, userMessage, user, buildConversationHistory(freshConv.messages), categoryPreference),
      ]);

      const latestConv = await getConversation(sessionId);
      newTraceSteps.push(...latestConv.trace_steps.slice(traceCountBefore));

      if (prefResult.has_updates) {
        await updateUserPreferences(sessionId, {
          allergies: prefResult.new_allergies,
          dietary_restrictions: prefResult.new_dietary_restrictions,
        });
      }

      replyText = discoveryResult.reply_text;
      if (prefResult.has_updates && prefResult.reply_text) {
        replyText = prefResult.reply_text + "\n\n" + discoveryResult.reply_text;
      }

      const matched = (discoveryResult.matched_restaurants || []).filter((r) => r.safe_items?.length > 0);

      if (matched.length === 1 && (discoveryResult.intent === "search" || discoveryResult.intent === "browse_menu")) {
        // Single confident restaurant match — move straight into ordering
        // and let the Order Agent process this same message (so "I want a
        // burger" both selects the restaurant AND adds the item in one turn).
        const pick = matched[0];
        const selectedRestaurant =
          (pick.restaurant_id && (await getRestaurantById(pick.restaurant_id))) ||
          (pick.restaurant_name && (await getRestaurantByName(pick.restaurant_name)));
        if (!selectedRestaurant) {
          replyText = "I couldn't verify that restaurant right now. Please choose one of the restaurants shown and try again.";
          phase = "browsing";
        } else {
          await updateConversation(sessionId, {
            selected_restaurant_id: selectedRestaurant.id,
            selected_restaurant_name: selectedRestaurant.name,
            phase: "ordering",
          });
          const updatedConv = await getConversation(sessionId);
          const { replyText: orderReply } = await processOrderingTurn(sessionId, user, updatedConv, userMessage);
          replyText = orderReply;
          phase = "ordering";
        }
      } else if (matched.length > 1) {
        // Ambiguous — Discovery Agent's reply_text should already be asking
        // the user to pick one; stay in browsing.
        phase = "browsing";
      }
    }

    // ================= ORDERING =================
    else if (phase === "ordering") {
      if (!conv.selected_restaurant_id) {
        replyText = `Let's pick a restaurant first — would you like **Desi** 🍛 or **Fast Food** 🍔?`;
        phase = "browsing";
      } else if (isCheckoutTrigger(userMessage)) {
        const draftOrder = await getDraftOrder(user._id);
        if (!draftOrder || !draftOrder.items.length) {
          replyText = `Your cart is empty so far — what would you like to add? 🍽️`;
        } else {
          replyText = `${formatBill(draftOrder)}\n\nShall I confirm this order? Reply **yes** to confirm or **no** to keep editing.`;
          phase = "confirming";
        }
      } else {
        const { replyText: orderReply } = await processOrderingTurn(sessionId, user, conv, userMessage);
        replyText = orderReply;
        const latestConv = await getConversation(sessionId);
        newTraceSteps.push(...latestConv.trace_steps.slice(traceCountBefore));
      }
    }

    // ================= CONFIRMING (deterministic bill) =================
    else if (phase === "confirming") {
      const draftOrder = await getDraftOrder(user._id);
      if (!draftOrder || !draftOrder.items.length) {
        replyText = `Hmm, I don't see any items in your cart. What would you like to order? 🍽️`;
        phase = "browsing";
      } else if (isAffirmative(userMessage)) {
        await confirmOrder(draftOrder._id);
        const { reply_text } = await presentPaymentOptions(sessionId, draftOrder);
        replyText = `✅ Order confirmed!\n\n${reply_text}`;
        phase = "payment_method";
        const latestConv = await getConversation(sessionId);
        newTraceSteps.push(...latestConv.trace_steps.slice(traceCountBefore));
      } else if (isNegative(userMessage)) {
        replyText = `No problem — what would you like to change? You can add, remove, or swap items. 🍽️`;
        phase = "ordering";
      } else {
        replyText = `${formatBill(draftOrder)}\n\nJust reply **yes** to confirm or **no** to make changes.`;
      }
    }

    // ================= PAYMENT METHOD =================
    else if (phase === "payment_method") {
      // Confirmation marks the order as confirmed, so it is no longer a draft.
      const order = await getActiveOrder(user._id);
      if (!order) {
        replyText = `I don't see a confirmed order to pay for. Let's start a new one — what would you like to eat? 🍽️`;
        phase = "browsing";
      } else {
        const method = parsePaymentMethod(userMessage);
        if (!method) {
          replyText = `Please choose one: **COD** (Cash on Delivery), **JazzCash**, or **EasyPaisa**.`;
        } else {
          await setOrderPaymentMethod(order._id, method);
          const latestConvBefore = await getConversation(sessionId);

          if (method === "cod") {
            const { reply_text, reference } = await confirmCODOrder(sessionId, order);
            await setOrderReference(order._id, reference);
            await updateOrderStatus(order._id, "placed");
            replyText = reply_text;
            phase = "tracking";
          } else {
            const { reply_text, reference } = await initiateWalletPayment(sessionId, method, order);
            await updateConversation(sessionId, { pending_payment_method: method, pending_payment_reference: reference });
            replyText = reply_text;
            phase = "paying";
          }

          const latestConv = await getConversation(sessionId);
          newTraceSteps.push(...latestConv.trace_steps.slice(latestConvBefore.trace_steps.length));
        }
      }
    }

    // ================= PAYING (wallet transfer confirmation) =================
    else if (phase === "paying") {
      const order = await getDraftOrder(user._id) || (await getActiveOrder(user._id));
      if (!order) {
        replyText = `I don't see an active order. Let's start fresh — what would you like to eat? 🍽️`;
        phase = "browsing";
      } else {
        const t = userMessage.toLowerCase();
        const transactionReference = extractPaymentReference(userMessage);
        const saysDone = ["paid", "done", "sent", "ho gaya", "bhej diya", "transferred", "payment completed"].some((w) => t.includes(w));
        if (saysDone) {
          const paymentReference = transactionReference || conv.pending_payment_reference;
          const { reply_text } = await confirmWalletPaymentReceived(
            sessionId,
            order,
            conv.pending_payment_method || "jazzcash",
            paymentReference
          );
          await updateOrderPayment(order._id, paymentReference);
          await updateOrderStatus(order._id, "placed");
          replyText = reply_text;
          phase = "tracking";
          const latestConv = await getConversation(sessionId);
          newTraceSteps.push(...latestConv.trace_steps.slice(traceCountBefore));
        } else {
          replyText = `Whenever you've sent the payment, just reply **"paid"** and I'll confirm your order. Need the account details again? Just ask!`;
        }
      }
    }

    // ================= TRACKING =================
    else if (phase === "tracking") {
      const order = await getActiveOrder(user._id);
      if (!order) {
        replyText = `No active order to track. Want to order something? 🍕`;
        phase = "browsing";
      } else {
        const riderResult = await runRiderAgent(sessionId, user, order);

        const latestConv = await getConversation(sessionId);
        newTraceSteps.push(latestConv.trace_steps[latestConv.trace_steps.length - 1]);

        if (riderResult.current_status) {
          await updateOrderStatus(order._id, riderResult.current_status);
        }
        if (riderResult.current_status === "delivered") {
          phase = "delivered";
        }
        replyText = riderResult.reply_text;
      }
    }

    // ================= DELIVERED =================
    else if (phase === "delivered") {
      await updateConversation(sessionId, {
        selected_restaurant_id: null,
        selected_restaurant_name: null,
        category_preference: null,
        pending_payment_method: null,
        pending_payment_reference: null,
      });
      replyText = `Thanks for ordering with PickyPal! 🎉 Want to order again? Just tell me what you're craving — Desi 🍛 or Fast Food 🍔.`;
      phase = "browsing";
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred";
    replyText = `⚠️ Something went wrong: ${errorMsg}`;

    newTraceSteps.push({
      id: crypto.randomUUID(),
      agent_name: "orchestrator",
      action: "Error",
      timestamp: new Date().toISOString(),
      input_summary: userMessage.slice(0, 80),
      output_json: null,
      status: "error",
      error_message: errorMsg,
    });
  }

  const agentMsg = {
    id: crypto.randomUUID(),
    role: "agent",
    content: replyText,
    timestamp: new Date().toISOString(),
  };
  await addMessage(sessionId, agentMsg);
  await updateConversation(sessionId, { phase });

  return { reply: replyText, traceSteps: newTraceSteps, phase };
}

/**
 * Handle "Simulate Next Step" for the rider tracking demo.
 */
export async function simulateNextStep(sessionId) {
  return handleMessage(sessionId, "What's the status of my order?");
}

/**
 * Handle the transition from discovery to ordering when the
 * user picks a restaurant from the discovery results (e.g. a UI button).
 */
export async function transitionToOrdering(sessionId, restaurantId) {
  const restaurant = await getRestaurantById(restaurantId);
  await updateConversation(sessionId, {
    phase: "ordering",
    selected_restaurant_id: restaurantId,
    selected_restaurant_name: restaurant?.name || null,
  });
}
