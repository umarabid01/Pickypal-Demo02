// ============================================================
// PickyPal — Discovery Agent
// Parses free-text intent, cross-refs allergies, finds safe options.
// Runs only AFTER onboarding (name/phone/address/allergens) is done,
// and is scoped to the user's chosen category (desi vs fast food).
// ============================================================
import { callAgent } from "./base.js";
import { getRestaurantContextForAI } from "../lib/restaurants.js";

export async function runDiscoveryAgent(sessionId, userMessage, user, conversationHistory, categoryPreference) {
  const restaurantContext = await getRestaurantContextForAI(
    user.allergies,
    user.dietary_restrictions,
    categoryPreference || null
  );

  const context = `## User Profile
Name: ${user.name || "Unknown"}
Language: ${user.language_pref}
Known Allergies: ${user.allergies.length ? user.allergies.join(", ") : "none"}
Dietary Restrictions: ${user.dietary_restrictions.length ? user.dietary_restrictions.join(", ") : "none"}
Category preference so far: ${categoryPreference || "not chosen yet — ask desi or fast food if unclear"}

## Available Restaurants & Safe Main Items
${restaurantContext}

## Conversation History
${conversationHistory || "(new conversation)"}`;

  const { response } = await callAgent(sessionId, "discovery", context, userMessage);
  return response;
}
