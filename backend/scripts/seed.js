// ============================================================
// PickyPal — Seed script
// Loads data/seedRestaurants.json into MongoDB.
// Run with: npm run seed
// ============================================================
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "../config/db.js";
import Restaurant from "../models/Restaurant.js";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seed() {
  await connectDB();

  const dataPath = path.join(__dirname, "..", "data", "seedRestaurants.json");
  const raw = fs.readFileSync(dataPath, "utf-8");
  const { restaurants } = JSON.parse(raw);

  console.log(`Seeding ${restaurants.length} restaurants...`);

  for (const r of restaurants) {
    await Restaurant.findOneAndUpdate({ id: r.id }, r, { upsert: true, new: true });
    console.log(`  ✔ ${r.name}`);
  }

  console.log("✅ Seed complete.");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
