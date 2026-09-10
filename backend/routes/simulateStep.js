// ============================================================
// PickyPal — POST /api/simulate-step
// Advances rider fulfillment by one step for the demo.
// ============================================================
import { Router } from "express";
import { simulateNextStep } from "../lib/orchestrator.js";
import { getConversation } from "../lib/store.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" });
    }

    const result = await simulateNextStep(sessionId);
    const conv = await getConversation(sessionId);

    res.json({
      reply: result.reply,
      traceSteps: result.traceSteps,
      phase: result.phase,
      allTraceSteps: conv.trace_steps,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
