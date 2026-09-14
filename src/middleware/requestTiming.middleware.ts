import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

const SLOW_REQUEST_MS = 500;

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (durationMs < SLOW_REQUEST_MS) return;

    logger.warn("Slow request", {
      method: req.method,
      path: req.route?.path || req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      requestId: res.locals.requestId,
    });
  });

  next();
}