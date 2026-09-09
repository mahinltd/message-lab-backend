import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { isProduction } from "../config/env";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/ApiError";

type MongoDuplicateKeyError = {
  code?: number;
  keyValue?: Record<string, unknown>;
};

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: isProduction ? undefined : error.stack,
    };
  }

  return {
    message: String(error),
  };
}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  let statusCode = 500;
  let message = "Internal Server Error";
  let details: unknown = undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = "Invalid identifier format";
    details = {
      field: err.path,
      value: err.value,
    };
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = "Validation failed";
    details = Object.values(err.errors).map((error) => ({
      field: error.path,
      message: error.message,
    }));
  } else if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as MongoDuplicateKeyError).code === 11000
  ) {
    statusCode = 409;
    message = "Duplicate value detected";
    details = (err as MongoDuplicateKeyError).keyValue;
  } else if (err instanceof SyntaxError && "body" in err) {
    statusCode = 400;
    message = "Invalid JSON payload";
  } else if (err instanceof Error && err.name === "ZodError") {
    statusCode = 400;
    message = "Validation failed";
    details = err;
  } else if (err instanceof Error && err.message === "Not allowed by CORS") {
    statusCode = 403;
    message = "CORS policy does not allow this origin";
  } else if (err instanceof Error) {
    message = err.message || message;
  }

  const requestId = res.locals.requestId as string | undefined;

  const logPayload = {
    requestId,
    method: req.method,
    originalUrl: req.originalUrl,
    ip: req.ip,
    statusCode,
    error: serializeError(err),
  };

  if (statusCode >= 500) {
    logger.error("Request failed", logPayload);
  } else {
    logger.warn("Request rejected", logPayload);
  }

  res.status(statusCode).json({
    success: false,
    message,
    details: isProduction && statusCode >= 500 ? undefined : details,
    requestId,
  });
}