import { Request, Response, NextFunction } from "express";
import { getRedisSafe } from "../lib/redis";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { getClientIp } from "../utils/ip";
import { SecurityService } from "../services/security.service";

export const globalRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const redis = getRedisSafe();
  
  // যদি Redis কনফিগার না থাকে (যেমন: লোকাল ডেভেলপমেন্টে), তবে রিকোয়েস্ট পাস করে দাও
  if (!redis) {
    return next();
  }

  const ip = getClientIp(req);
  const key = `rate_limit:global:${ip}`;
  const windowSec = Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000);
  const max = env.RATE_LIMIT_MAX;

  try {
    // Fixed Window Counter
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSec);
    }

    const ttl = await redis.ttl(key);
    const remaining = Math.max(0, max - current);
    
    // স্ট্যান্ডার্ড রেট লিমিট হেডার সেট করা
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Date.now() + (ttl > 0 ? ttl * 1000 : windowSec * 1000));

    if (current > max) {
      // রেট লিমিট ক্রস করলে সিকিউরিটি ইভেন্ট হিসেবে লগ করা (নন-ব্লকিং)
      SecurityService.recordSecurityEvent({
        eventType: "RATE_LIMIT_EXCEEDED",
        severity: "medium",
        req,
        description: `Global rate limit exceeded for IP: ${ip}`,
      }).catch(() => {});

      throw ApiError.tooManyRequests("Too many requests, please try again later.");
    }

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }
    // Redis ডাউন থাকলে অ্যাপ্লিকেশন যেন বন্ধ না হয়ে যায় (Fail Open strategy)
    console.error("Rate limiter Redis error", error);
    next();
  }
};