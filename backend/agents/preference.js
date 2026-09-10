// ============================================================
// PickyPal — Preference Agent
// Detects and persists new allergy/dietary info from messages
// ============================================================
import { callAgent } from "./base.js";

export async function runPreferenceAgent(sessionId, userMessage, user) {
  const context = `## Current User Profile
Name: ${user.name || "Unknown"}
Language: ${user.language_pref}
Existing Allergies: ${user.allergies.length ? user.allergies.join(", ") : "none"}
Existing Dietary Restrictions: ${user.dietary_restrictions.length ? user.dietary_restrictions.join(", ") : "none"}

Only flag NEW information not already in the profile above.`;

  const { response } = await callAgent(sessionId, "preference", context, userMessage);
  return response;
}
