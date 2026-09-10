// ============================================================
// PickyPal — User model (mirrors supabase/schema.sql users table)
// ============================================================
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  session_phone: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: null },
  // Real contact phone number collected during onboarding (distinct from
  // session_phone, which is just the internal session/device identifier).
  phone: { type: String, default: null },
  address: { type: String, default: null },
  language_pref: { type: String, enum: ["en", "ur", "pa"], default: "en" },
  allergies: { type: [String], default: [] },
  dietary_restrictions: { type: [String], default: [] },
  // Flips to true once name + phone + address + allergen check are all
  // collected, so returning users skip straight back to ordering.
  onboarding_complete: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model("User", UserSchema);
