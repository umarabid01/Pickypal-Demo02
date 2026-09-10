// ============================================================
// PickyPal — Rider Agent
// Advances mock fulfillment status, narrates delivery progress
// ============================================================
import { callAgent } from "./base.js";

export async function runRiderAgent(sessionId, user, order) {
  const context = `## Order Details
Order ID: ${order._id}
Restaurant: ${order.restaurant_name}
Items: ${order.items.map((i) => `${i.quantity}x ${i.item_name}`).join(", ")}
Current Status: ${order.status}

## User Profile
Name: ${user.name || "Customer"}
Language: ${user.language_pref}

## Instructions
Advance the fulfillment by exactly ONE step from the current status.
The sequence is: placed → preparing → rider_assigned → on_the_way → delivered`;

  const { response } = await callAgent(
    sessionId,
    "rider",
    context,
    "Advance to next fulfillment step"
  );
  return response;
}
