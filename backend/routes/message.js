// ============================================================
// PickyPal — POST /api/message
// Main orchestrator entrypoint. Receives chat message, returns
// reply + trace steps for the Agent Trace Panel.
// ============================================================
import { Router } from "express";
import { handleMessage, transitionToOrdering } from "../lib/orchestrator.js";
import { getConversation } from "../lib/store.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { sessionId, message, selectRestaurant } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: "Missing sessionId or message" });
    }

    if (selectRestaurant) {
      await transitionToOrdering(sessionId, selectRestaurant);
    }

    const result = await handleMessage(sessionId, message);
    const conv = await getConversation(sessionId);

    res.json({
      reply: result.reply,
      traceSteps: result.traceSteps,
      phase: result.phase,
      allTraceSteps: conv.trace_steps,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({
      reply: `⚠️ Error: ${errorMessage}`,
      traceSteps: [],
      phase: "idle",
      error: errorMessage,
    });
  }
});

export default router;
