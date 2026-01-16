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
const PORT = parseInt(process.env.PORT || '3004', 10);

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
    // Start the server first
    const host = process.env.RENDER ? '0.0.0.0' : 'localhost';
    const server = app.listen(PORT, host, () => {
      logger.info(`Server running on http://${host}:${PORT}`);
    });

    // Initialize location search in the background (non-blocking)
    initLocationSearch()
      .then(() => {
        logger.info("Location search initialized successfully");
      })
      .catch((error) => {
        logger.error(error, "Failed to initialize location search - some features may not work");
        logger.warn("The server is running but location-based queries will fail until database is connected");
      });

  } catch (error) {
    logger.error(error, "Failed to start server");
    process.exit(1);
  }
}

start();
