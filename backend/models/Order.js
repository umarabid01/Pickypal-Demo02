// ============================================================
// PickyPal — Order model (mirrors supabase/schema.sql orders table)
// ============================================================
import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    item_id: String,
    item_name: String,
    quantity: Number,
    base_price: Number,
    customizations: { type: [String], default: [] },
    item_total: Number,
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  restaurant_id: String,
  restaurant_name: String,
  items: { type: [OrderItemSchema], default: [] },
  status: {
    type: String,
    enum: ["placed", "preparing", "rider_assigned", "on_the_way", "delivered"],
    default: "placed",
  },
  // Snapshot of the customer's details at the time of ordering, so the
  // order record is self-contained even if the user later edits their profile.
  customer_name: { type: String, default: null },
  customer_phone: { type: String, default: null },
  delivery_address: { type: String, default: null },
  allergens_snapshot: { type: [String], default: [] },

  payment_method: { type: String, enum: ["cod", "jazzcash", "easypaisa", null], default: null },
  payment_status: { type: String, enum: ["pending", "paid"], default: "pending" },
  payment_reference: { type: String, default: null },

  confirmed: { type: Boolean, default: false },
  delivery_fee: { type: Number, default: 100 },
  total: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model("Order", OrderSchema);
