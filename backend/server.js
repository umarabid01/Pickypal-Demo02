
// ============================================================
// PickyPal — Express server entrypoint
// ============================================================

import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import { connectDB } from "./config/db.js";
import messageRoute from "./routes/message.js";
import simulateStepRoute from "./routes/simulateStep.js";

const app = express();

// ============================================================
// CORS
// ============================================================

const allowedOrigins = (
  process.env.CORS_ORIGIN || "http://localhost:5173"
)
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
  })
);

app.use(express.json());

// ============================================================
// MongoDB Connection
// ============================================================

// Start MongoDB connection immediately when server.js loads
const dbConnection = connectDB();

dbConnection
  .then(() => {
    console.log("✅ MongoDB connected");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
  });

// ============================================================
// Root Route
// ============================================================

app.get("/", async (req, res) => {
  try {
    // Wait until the MongoDB connection attempt finishes
    await dbConnection;

    // Check actual Mongoose connection state
    if (mongoose.connection.readyState === 1) {
      return res.json({
        status: "ok",
        backend: "running",
        database: "connected",
        message: "PickyPal backend is running successfully",
      });
    }

    return res.status(503).json({
      status: "error",
      backend: "not ready",
      database: "disconnected",
    });
  } catch (err) {
    console.error("Root route database error:", err);

    return res.status(503).json({
      status: "error",
      backend: "not ready",
      database: "disconnected",
      message: err.message,
    });
  }
});

// ============================================================
// Health Check
// ============================================================

app.get("/api/health", async (req, res) => {
  try {
    await dbConnection;

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: "error",
        database: "disconnected",
      });
    }

    res.json({
      status: "ok",
      database: "connected",
      time: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Health check error:", err);

    res.status(500).json({
      status: "error",
      database: "disconnected",
      message: err.message,
    });
  }
});

// ============================================================
// API Routes
// ============================================================

app.use("/api/message", messageRoute);
app.use("/api/simulate-step", simulateStepRoute);

// ============================================================
// Export Express App for Vercel
// ============================================================

export default app;
const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 PickyPal backend running on http://localhost:${PORT}`);
  });
}



