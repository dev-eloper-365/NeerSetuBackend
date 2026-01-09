// Load environment variables FIRST before any other imports
import dotenv from "dotenv";

import express from "express";
import cors from "cors";

import gwChatRouter from "./routes/gwChat.js";
import gwMapRouter from "./routes/gwMap.js";
import { initLocationSearch } from "./services/locationSearch.js";
import logger from "./utils/logger.js";
import { requestLogger, errorHandler } from "./middleware/logging.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(requestLogger);

// Routes
app.use("/api/gw-chat", gwChatRouter);
app.use("/api/gw-map", gwMapRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

// Initialize services and start server
async function start() {
  try {
    // Initialize location search for groundwater queries
    await initLocationSearch();

    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error(error, "Failed to start server");
    process.exit(1);
  }
}

start();
