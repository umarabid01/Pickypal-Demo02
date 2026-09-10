// ============================================================
// PickyPal — Order Agent
// Handles item selection, quantity, customization, and upsells
// addons/drinks/sides — strictly scoped to the ONE selected
// restaurant's own menu — then builds the cart payload.
// ============================================================
import { callAgent } from "./base.js";
import { getMenuContextForAI } from "../lib/restaurants.js";

export async function runOrderAgent(
  sessionId,
  userMessage,
  user,
  restaurantId,
  restaurantName,
  currentOrder,
  conversationHistory
) {
  const menuContext = await getMenuContextForAI(restaurantId);

  const orderSummary =
    currentOrder && currentOrder.items.length
      ? `Current cart items:\n${currentOrder.items
          .map(
            (i) =>
              `  - ${i.quantity}x ${i.item_name} (${
                i.customizations.join(", ") || "no customizations"
              }) = Rs.${i.item_total}`
          )
          .join("\n")}\nCurrent total: Rs.${currentOrder.total}`
      : "No items added yet.";

  const context = `## User Profile
Name: ${user.name || "Unknown"}
Allergies: ${user.allergies.length ? user.allergies.join(", ") : "none"}
Dietary Restrictions: ${user.dietary_restrictions.length ? user.dietary_restrictions.join(", ") : "none"}

## Selected Restaurant
${restaurantName} (restaurant_id: ${restaurantId})

## Restaurant Menu (mains, add-ons, sides, drinks, desserts — all from THIS restaurant only)
${menuContext}

## Current Cart State
${orderSummary}

## Conversation History
${conversationHistory}`;

  const { response } = await callAgent(sessionId, "order", context, userMessage);
  return response;
}
