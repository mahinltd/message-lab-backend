import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const headerValue = req.headers["x-request-id"];

  const existingRequestId = Array.isArray(headerValue)
    ? headerValue[0]
    : headerValue;

  const requestId =
    existingRequestId && existingRequestId.trim().length > 0
      ? existingRequestId.trim()
      : crypto.randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  next();
}