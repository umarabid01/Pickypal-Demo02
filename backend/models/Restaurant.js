// ============================================================
// PickyPal — Restaurant model (mirrors the old Airtable-shaped
// data). Restaurants own their own menu_items array so a seller
// can edit their own menu without touching other restaurants.
// ============================================================
import mongoose from "mongoose";

const MenuItemSchema = new mongoose.Schema(
  {
    id: String,
    item_name: String,
    description: String,
    price: Number,
    allergens: { type: [String], default: [] },
    dietary_tags: { type: [String], default: [] },
    customizable: { type: Boolean, default: false },
    customization_options: { type: String, default: "" },
    // "main" = a full dish (burger, biryani, pizza...); "addon" = an extra
    // that goes ON a main item (extra cheese, extra patty); "side" = fries/
    // naan/raita type sides; "drink" = beverages; "dessert" = sweets.
    // Every item is scoped to its own restaurant's menu_items array, so
    // addons/drinks/sides shown for an order are ALWAYS from that one
    // restaurant only — never mixed across restaurants.
    category: {
      type: String,
      enum: ["main", "addon", "side", "drink", "dessert"],
      default: "main",
    },
  },
  { _id: false }
);

const RestaurantSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // stable string id used across the app
  name: String,
  cuisine: String,
  location: String,
  rating: Number,
  halal_certified: { type: Boolean, default: false },
  // High-level bucket used to answer "desi or fast food?" during discovery.
  category: { type: String, enum: ["desi", "fast_food"], default: "fast_food" },
  menu_items: { type: [MenuItemSchema], default: [] },
});

export default mongoose.model("Restaurant", RestaurantSchema);
