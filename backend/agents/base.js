// ============================================================
// PickyPal — Agent Base (shared AI call helper)
// All 5 agents use this to call the model with structured output.
// ============================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { getAIClient } from "../config/aiClient.js";
import { addTraceStep } from "../lib/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load an agent's system prompt from /prompts/<name>.system.md
 */
export function loadSystemPrompt(agentName) {
  const promptPath = path.join(__dirname, "..", "prompts", `${agentName}.system.md`);
  return fs.readFileSync(promptPath, "utf-8");
}

/**
 * Call the active AI model (Gemini or GPT-4o) with an agent's
 * system prompt and context. Returns parsed JSON. Retries once
 * on parse failure. Emits trace steps for the Agent Trace Panel.
 */
export async function callAgent(sessionId, agentName, context, userMessage) {
  const systemPrompt = loadSystemPrompt(agentName);
  const startTime = Date.now();

  const traceStep = {
    id: crypto.randomUUID(),
    agent_name: agentName,
    action: `${agentName} agent processing`,
    timestamp: new Date().toISOString(),
    input_summary: userMessage.slice(0, 120) + (userMessage.length > 120 ? "..." : ""),
    output_json: null,
    status: "running",
  };

  await addTraceStep(sessionId, traceStep);

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `${context}\n\n---\nUser message: "${userMessage}"` },
  ];

  let attempts = 0;
  const maxAttempts = 2; // retry once on parse failure

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const { client: aiClient, model: activeModel } = getAIClient();
      const completion = await aiClient.chat.completions.create({
        model: activeModel,
        messages,
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from AI model");

      const parsed = JSON.parse(content);

      traceStep.status = "success";
      traceStep.output_json = parsed;
      traceStep.duration_ms = Date.now() - startTime;
      traceStep.action = `${agentName} agent completed`;

      return { response: parsed, traceStep };
    } catch (err) {
      if (attempts >= maxAttempts) {
        traceStep.status = "error";
        traceStep.error_message = err instanceof Error ? err.message : "Unknown error";
        traceStep.duration_ms = Date.now() - startTime;
        throw err;
      }
      traceStep.action = `${agentName} agent retrying (parse error)`;
    }
  }

  throw new Error("Unexpected: exceeded retry loop");
}
