import { Request, Response, NextFunction } from "express";
import { getRedisSafe } from "../lib/redis";
import { ApiError } from "../utils/ApiError";
import { getClientIp } from "../utils/ip";
import { AuthSecurityService } from "../services/authSecurity.service";





interface AuthLimiterOptions {
  windowMs: number;
  max: number | (() => Promise<number>);
  keyPrefix: string;
  countOnlyFailures: boolean;
}

export function createAuthLimiter(options: AuthLimiterOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const redis = getRedisSafe();
    if (!redis) {
      next();
      return;
    }

    const key = `${options.keyPrefix}:${getClientIp(req)}`;
    try {
      const max =
        typeof options.max === "function" ? await options.max() : options.max;
      const current = Number(await redis.get(key)) || 0;
      if (current >= max) {
        const ttl = Number(await redis.ttl(key));
        const retryAfterSeconds = Math.max(1, ttl > 0 ? ttl : Math.ceil(options.windowMs / 1000));
        res.setHeader("Retry-After", retryAfterSeconds);
        res.status(429).json({
          success: false,
          message: "Too many authentication requests. Please try again later.",
          retryAfterSeconds,
        });
        return;
      }

      if (options.countOnlyFailures) {
        res.once("finish", async () => {
          if (res.statusCode < 400) return;
          const nextCount = await redis.incr(key);
          if (nextCount === 1) {
            await redis.expire(key, Math.ceil(options.windowMs / 1000));
          }
        });
      } else {
        const nextCount = await redis.incr(key);
        if (nextCount === 1) {
          await redis.expire(key, Math.ceil(options.windowMs / 1000));
        }
      }

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
        return;
      }
      next();
    }
  };
}

export const loginLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "rl:login:ceiling",
  countOnlyFailures: true,
});

export const registerLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: "rl:register",
  countOnlyFailures: false,
});

export const forgotLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: "rl:forgot",
  countOnlyFailures: false,
});

export const refreshLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: async () => (await AuthSecurityService.getSettings()).refreshLimit,
  keyPrefix: "rl:refresh",
  countOnlyFailures: false,
});

export const authRateLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "rl:verification",
  countOnlyFailures: false,
});
