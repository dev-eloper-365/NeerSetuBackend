import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import logger from "../utils/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.socket.remoteAddress,
    };

    if (res.statusCode >= 400) {
      logger.warn(logData, "Request completed with error");
    } else {
      logger.info(logData, "Request completed");
    }
  });

  next();
}

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(
    {
      err: { message: err.message, stack: err.stack, name: err.name },
      method: req.method,
      url: req.originalUrl,
    },
    "Unhandled exception"
  );

  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV !== "production" ? err.message : undefined,
  });
};
