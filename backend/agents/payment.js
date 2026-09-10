// ============================================================
// PickyPal — Payment Agent (deterministic, not AI-driven)
// Payment is mocked for this prototype, and getting it right is
// mostly about reliably showing the correct bank/account details
// and reference number — so this runs as plain rule-based logic
// instead of an LLM call. It still emits a trace step so the
// Agent Trace Panel keeps showing every step of the pipeline.
// ============================================================
import crypto from "crypto";
import { addTraceStep } from "../lib/store.js";

// Mocked receiving accounts for the two bank-transfer style wallets.
// In a real deployment these would come from env vars / the seller's
// verified merchant account, never hardcoded.
const BANK_DETAILS = {
  jazzcash: {
    label: "JazzCash",
    account_title: "PickyPal Foods (Pvt) Ltd",
    account_number: "0300-1234567",
  },
  easypaisa: {
    label: "EasyPaisa",
    account_title: "PickyPal Foods (Pvt) Ltd",
    account_number: "0345-7654321",
  },
};

function genReference() {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `PP-${year}-${rand}`;
}

async function logStep(sessionId, action, inputSummary, outputJson) {
  await addTraceStep(sessionId, {
    id: crypto.randomUUID(),
    agent_name: "payment",
    action,
    timestamp: new Date().toISOString(),
    input_summary: inputSummary.slice(0, 120),
    output_json: outputJson,
    status: "success",
    duration_ms: 1,
  });
}

/**
 * Step 1: present the three payment options once the order is confirmed.
 */
export async function presentPaymentOptions(sessionId, order) {
  const reply_text = `Great, your order is confirmed! 🎉 Total: **Rs.${order.total}**

How would you like to pay?
- 💵 **Cash on Delivery (COD)**
- 📱 **JazzCash**
- 📱 **EasyPaisa**

Just reply with one of: "COD", "JazzCash", or "EasyPaisa".`;

  await logStep(sessionId, "Presenting payment options", `order total Rs.${order.total}`, {
    agent: "payment",
    action: "present_options",
    options: ["cod", "jazzcash", "easypaisa"],
    order_total: order.total,
  });

  return { reply_text };
}

/**
 * Step 2a: user chose JazzCash or EasyPaisa — show the mock account to
 * send payment to, and a reference number to include.
 */
export async function initiateWalletPayment(sessionId, method, order) {
  const details = BANK_DETAILS[method];
  const reference = genReference();

  const reply_text = `📱 **${details.label} Payment**

Please send **Rs.${order.total}** to:
- Account Title: **${details.account_title}**
- ${details.label} Number: **${details.account_number}**
- Reference: **${reference}** (please add this in the transaction note)

Once you've sent it, just reply **"paid"** or **"done"** and I'll confirm your order right away. (This is a mocked payment for the demo — no real transaction happens.)`;

  await logStep(sessionId, `Initiating ${details.label} payment`, `method=${method}`, {
    agent: "payment",
    action: "initiate_wallet_payment",
    payment_method: method,
    payment_reference: reference,
    order_total: order.total,
    account_number: details.account_number,
  });

  return { reply_text, reference };
}

/**
 * Step 2b: user chose Cash on Delivery — no bank details needed, order
 * goes straight to confirmed/pending-cash and into the tracking phase.
 */
export async function confirmCODOrder(sessionId, order) {
  const reference = genReference();

  const reply_text = `💵 **Cash on Delivery confirmed!**

Please keep **Rs.${order.total}** ready for the rider. Order reference: **${reference}**.

Sending your order to the restaurant now... 🍽️`;

  await logStep(sessionId, "Confirming COD order", "method=cod", {
    agent: "payment",
    action: "confirm_cod",
    payment_method: "cod",
    payment_reference: reference,
    order_total: order.total,
  });

  return { reply_text, reference };
}

/**
 * Step 3: user confirms they've sent the JazzCash/EasyPaisa transfer.
 */
export async function confirmWalletPaymentReceived(sessionId, order, method, paymentReference) {
  const details = BANK_DETAILS[method];
  const itemLines = order.items
    .map((item) => `- ${item.quantity}x ${item.item_name} — Rs.${item.item_total}`)
    .join("\n");
  const reply_text = `✅ **Payment received!** Thanks — Rs.${order.total} via ${details.label} confirmed.

**Payment**
- Method: **${details.label}**
- Amount: **Rs.${order.total}**
- Transaction ID: **${paymentReference || "recorded"}**
- Status: **Paid**

**Order confirmed**
Order ID: **${order._id}**
Restaurant: **${order.restaurant_name}**
${itemLines}
Total: **Rs.${order.total}**
Payment: **Paid**
Status: **Confirmed**

${order.restaurant_name} is preparing your order. Estimated delivery time: **35–40 minutes**. 🍽️`;

  await logStep(sessionId, "Confirming wallet payment received", `method=${method}`, {
    agent: "payment",
    action: "payment_success",
    payment_method: method,
    order_total: order.total,
  });

  return { reply_text };
}
