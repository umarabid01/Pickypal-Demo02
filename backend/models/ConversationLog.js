// ============================================================
// PickyPal — ConversationLog model
// Stores full chat history + agent trace data per user, and
// tracks live conversation state (phase, selected restaurant).
// ============================================================
import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    id: String,
    role: { type: String, enum: ["user", "agent"] },
    content: String,
    timestamp: { type: Date, default: Date.now },
    agent_name: String,
  },
  { _id: false }
);

const TraceStepSchema = new mongoose.Schema(
  {
    id: String,
    agent_name: String,
    action: String,
    timestamp: { type: Date, default: Date.now },
    input_summary: String,
    output_json: mongoose.Schema.Types.Mixed,
    status: { type: String, enum: ["running", "success", "error"] },
    error_message: String,
    duration_ms: Number,
  },
  { _id: false }
);

const ConversationLogSchema = new mongoose.Schema({
  session_id: { type: String, required: true, unique: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  phase: {
    type: String,
    enum: [
      "idle",
      "collecting_name",
      "collecting_phone",
      "collecting_address",
      "collecting_allergens",
      "browsing",
      "ordering",
      "confirming",
      "payment_method",
      "paying",
      "tracking",
      "delivered",
    ],
    default: "idle",
  },
  selected_restaurant_id: { type: String, default: null },
  selected_restaurant_name: { type: String, default: null },
  // "desi" | "fast_food" | null — set once the user answers the discovery
  // question, used to scope which restaurants Discovery/Order agents see.
  category_preference: { type: String, default: null },
  // Chosen at the payment_method phase, carried into the paying phase so we
  // know which mock flow (COD vs JazzCash/EasyPaisa bank transfer) to run.
  pending_payment_method: { type: String, default: null },
  pending_payment_reference: { type: String, default: null },
  messages: { type: [MessageSchema], default: [] },
  trace_steps: { type: [TraceStepSchema], default: [] },
});

export default mongoose.model("ConversationLog", ConversationLogSchema);
