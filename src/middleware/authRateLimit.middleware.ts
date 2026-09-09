import { Request, Response, NextFunction } from "express";
import { getRedisSafe } from "../lib/redis";
import { ApiError } from "../utils/ApiError";
import { getClientIp } from "../utils/ip";
import { SecurityService } from "../services/security.service";

export const authRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const redis = getRedisSafe();
  if (!redis) return next();

  const ip = getClientIp(req);
  const key = `rate_limit:auth:${ip}`;
  const windowSec = 15 * 60; // 15 minutes
  const max = 30; // Max 30 authentication requests per 15 minutes

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSec);
    }

    if (current > max) {
      await SecurityService.recordSecurityEvent({
        eventType: "AUTH_RATE_LIMIT_EXCEEDED",
        severity: "high",
        req,
        description: `Auth rate limit exceeded for IP: ${ip}`,
      });
      
      throw ApiError.tooManyRequests("Too many authentication attempts. Please try again later.");
    }

    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next();
  }
};