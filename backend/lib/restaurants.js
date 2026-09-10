// ============================================================
// PickyPal — Restaurant data helpers
// Reads from MongoDB (seeded via scripts/seed.js) instead of
// the original static seedRestaurants.json import.
// ============================================================
import Restaurant from "../models/Restaurant.js";

export async function getAllRestaurants() {
  return Restaurant.find({});
}

export async function getRestaurantsByCategory(category) {
  if (!category) return getAllRestaurants();
  return Restaurant.find({ category });
}

export async function getRestaurantById(id) {
  return Restaurant.findOne({ id });
}
export async function getRestaurantByName(name) {
  if (!name) return null;
  return Restaurant.findOne({ name: { $regex: `^${String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
}

export async function getMenuItemById(restaurantId, itemId) {
  const restaurant = await getRestaurantById(restaurantId);
  if (!restaurant) return null;
  return restaurant.menu_items.find((m) => m.id === itemId) || null;
}

/**
 * Filter menu items that are safe for a user with given allergies
 * and dietary restrictions.
 */
export function getSafeMenuItems(restaurant, userAllergies, userDietary) {
  const allergiesLower = userAllergies.map(normalizeAllergen);
  const dietaryLower = userDietary.map((d) => d.toLowerCase());

  const safe = [];
  let unsafeCount = 0;

  for (const item of restaurant.menu_items) {
    const itemAllergens = item.allergens.map(normalizeAllergen);
    const hasAllergen = allergiesLower.some((a) => itemAllergens.includes(a));

    if (hasAllergen) {
      unsafeCount++;
      continue;
    }

    if (dietaryLower.length > 0) {
      const itemTags = item.dietary_tags.map((t) => t.toLowerCase());
      const matchesDietary = dietaryLower.every((d) => itemTags.includes(d));
      if (!matchesDietary) {
        unsafeCount++;
        continue;
      }
    }

    safe.push(item);
  }

  return { safe, unsafeCount };
}

/**
 * Given a specific item and a user's allergies, return the list of
 * allergens that item contains which the user has flagged — or null if
 * safe. Used by the order flow to show an explicit warning at the moment
 * an item/addon is added, on top of the discovery-time filtering.
 */
export function getItemAllergenWarning(item, userAllergies) {
  return getItemAllergenWarningWithCustomizations(item, userAllergies, []);
}

export function getItemAllergenWarningWithCustomizations(item, userAllergies, customizations = []) {
  if (!item || !item.allergens?.length || !userAllergies?.length) return null;
  const allergiesLower = userAllergies.map(normalizeAllergen);
  const customizationText = customizations.join(" ").toLowerCase();
  const hits = item.allergens.filter((a) => {
    const allergen = normalizeAllergen(a);
    if (allergen === "nut" && /no\s+granola|nut[- ]free/.test(customizationText)) return false;
    return allergiesLower.includes(allergen);
  });
  return hits.length ? hits : null;
}

function normalizeAllergen(value) {
  const normalized = String(value).trim().toLowerCase();
  return normalized.endsWith("s") && !normalized.endsWith("ss")
    ? normalized.slice(0, -1)
    : normalized;
}

/**
 * Build a compact restaurant summary for the AI context window.
 * Optionally scoped to a single category ("desi" | "fast_food").
 */
export async function getRestaurantContextForAI(userAllergies, userDietary, category) {
  const restaurants = await getRestaurantsByCategory(category);
  const summaries = restaurants.map((r) => {
    // Discovery only needs to show "main" dishes — addons/drinks/sides are
    // revealed later, once a restaurant + main item is picked, in the
    // Order Agent's context (see getMenuContextForAI below).
    // Keep allergen-containing dishes visible so the user can understand the
    // full menu; the warning and order-time safety net prevent silent unsafe adds.
    const mains = r.menu_items.filter((item) => item.category === "main" || item.category === "dessert");
    const menuItems = mains
      .map(
        (item) => {
          const allergenHits = getItemAllergenWarning(item, userAllergies);
          const allergenNote = allergenHits
            ? `⚠️ WARNING: contains your allergen(s): ${allergenHits.join(", ")}`
            : item.allergens.length
              ? `contains: ${item.allergens.join(", ")}`
              : "✅ allergen-free";
          return `  - [${item.id}] ${item.item_name} (Rs.${item.price}) [${item.dietary_tags.join(",")}] ${allergenNote}`;
        }
      )
      .join("\n");
    return `🏪 ${r.name} (${r.category === "desi" ? "Desi" : "Fast Food"} — ${r.cuisine}, ${r.location}, ⭐${r.rating})\n  Full menu (${mains.length} main items; allergen warnings are marked):\n${
      menuItems || "  (no main items)"
    }`;
  });
  return summaries.join("\n\n");
}

/**
 * Build full menu context for a specific restaurant (used by Order Agent),
 * grouped by category so the model can offer addons/drinks/sides from
 * THIS restaurant only, right after a main item is picked.
 */
export async function getMenuContextForAI(restaurantId) {
  const r = await getRestaurantById(restaurantId);
  if (!r) return "Restaurant not found.";

  const describe = (item) =>
    `- [${item.id}] ${item.item_name} — Rs.${item.price}\n  ${item.description}\n  Allergens: ${
      item.allergens.join(", ") || "none"
    }\n  Tags: ${item.dietary_tags.join(", ")}\n  Customizable: ${
      item.customizable ? `Yes — ${item.customization_options}` : "No"
    }`;

  const byCategory = (cat) => r.menu_items.filter((i) => i.category === cat);

  const sections = [
    ["🍽️ Mains", byCategory("main")],
    ["➕ Add-ons (extras that go ON a main item)", byCategory("addon")],
    ["🍟 Sides (fries, naan, etc.)", byCategory("side")],
    ["🥤 Drinks", byCategory("drink")],
    ["🍰 Desserts", byCategory("dessert")],
  ];

  const body = sections
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => `${label}:\n${items.map(describe).join("\n")}`)
    .join("\n\n");

  return `Menu for ${r.name} (all items below belong ONLY to this restaurant):\n\n${body}`;
}
