// ============================================================
// PickyPal — Groq AI client
// ============================================================

import OpenAI from "openai";

let _client = null;

const _activeModel = "openai/gpt-oss-120b";

export function getAIClient() {
  if (!_client) {
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) {
      throw new Error(
        "GROQ_API_KEY is not set. Add it to your backend environment variables."
      );
    }

    _client = new OpenAI({
      apiKey: groqKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }

  return {
    client: _client,
    model: _activeModel,
  };
}

export const AGENT_COLORS = {
  discovery: "#25D366",
  preference: "#FF9500",
  order: "#007AFF",
  payment: "#AF52DE",
  rider: "#FF3B30",
};
