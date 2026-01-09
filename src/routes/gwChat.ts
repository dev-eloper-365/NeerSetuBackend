import { Router, Request, Response, type IRouter } from "express";
import {
  streamGroundwaterChat,
  invokeGroundwaterChat,
} from "../services/gwAgent";
import { generateSuggestions } from "../services/llm";
import logger from "../utils/logger";

const router: IRouter = Router();

/**
 * POST /api/gw-chat
 * Non-streaming groundwater chat endpoint
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { query, chatHistory = [], language = "en" } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Missing or invalid 'query' field" });
      return;
    }

    logger.info(
      { query, language, historyLength: chatHistory.length },
      "Chat request received"
    );

    const { response, charts } = await invokeGroundwaterChat(
      query,
      chatHistory,
      language
    );

    logger.info({ chartsCount: charts.length }, "Chat response generated");

    res.json({
      response,
      charts,
    });
  } catch (error) {
    logger.error({ err: error, query: req.body.query }, "Chat request failed");
    res.status(500).json({ error: "Failed to generate response" });
  }
});

/**
 * POST /api/gw-chat/stream
 * Streaming groundwater chat endpoint with SSE
 */
router.post("/stream", async (req: Request, res: Response) => {
  try {
    const { query, chatHistory = [], language = "en" } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Missing or invalid 'query' field" });
      return;
    }

    logger.info(
      { query, language, historyLength: chatHistory.length },
      "Stream request received"
    );

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Track accumulated charts
    const charts: object[] = [];

    await streamGroundwaterChat(
      query,
      chatHistory,
      {
        onToken: async (token) => {
          res.write(
            `data: ${JSON.stringify({ type: "token", content: token })}\n\n`
          );
        },
        onChart: (chart) => {
          logger.debug(
            { chartType: (chart as { type?: string }).type, chart },
            "Streaming chart to client"
          );
          charts.push(chart);
          res.write(`data: ${JSON.stringify(chart)}\n\n`);
        },
        onToolCall: (toolName, args) => {
          logger.debug({ tool: toolName, args }, "Tool invoked");
          res.write(
            `data: ${JSON.stringify({
              type: "tool_call",
              tool: toolName,
              args,
            })}\n\n`
          );
        },
        onToolResult: (toolName, result) => {
          // Parse result to extract useful info without sending raw data
          try {
            const parsed = JSON.parse(result);
            res.write(
              `data: ${JSON.stringify({
                type: "tool_result",
                tool: toolName,
                found: parsed.found,
                summary: parsed.textSummary?.substring(0, 200) + "..." || null,
              })}\n\n`
            );
          } catch {
            res.write(
              `data: ${JSON.stringify({
                type: "tool_result",
                tool: toolName,
              })}\n\n`
            );
          }
        },
        onComplete: async (fullResponse) => {
          logger.info(
            { responseLength: fullResponse.length },
            "Stream completed"
          );

          // Generate suggestions based on the query and response
          let suggestions: string[] = [];
          try {
            suggestions = await generateSuggestions(
              query,
              fullResponse,
              language
            );
            res.write(
              `data: ${JSON.stringify({
                type: "suggestions",
                suggestions,
              })}\n\n`
            );
          } catch (error) {
            console.error("Failed to generate suggestions:", error);
          }

          res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
          res.end();
        },
        onError: (error) => {
          logger.error({ err: error, query: req.body.query }, "Stream error");
          res.write(
            `data: ${JSON.stringify({
              type: "error",
              error: error.message,
            })}\n\n`
          );
          res.end();
        },
      },
      language
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error(
      { 
        err: error,
        errorMessage,
        errorStack,
        query: req.body.query,
      },
      "Stream request failed"
    );
    
    // If headers haven't been sent yet, send JSON error
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Failed to start streaming",
        message: process.env.NODE_ENV !== "production" ? errorMessage : "Internal server error",
      });
    } else {
      // Headers already sent (SSE started), send error via SSE
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: errorMessage,
        })}\n\n`
      );
      res.end();
    }
  }
});

/**
 * POST /api/gw-chat/suggestions
 * Generate follow-up suggestions based on query and context
 */
router.post("/suggestions", async (req: Request, res: Response) => {
  try {
    const { query, context = "" } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Missing or invalid 'query' field" });
      return;
    }

    logger.info({ query }, "Suggestions request received");

    const suggestions = await generateSuggestions(query, context);

    logger.info(
      { suggestionsCount: suggestions.length },
      "Suggestions generated"
    );

    res.json({ suggestions });
  } catch (error) {
    logger.error(
      { err: error, query: req.body.query },
      "Suggestions request failed"
    );
    res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

export default router;
