import { Redis } from "@upstash/redis";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let redisClient: Redis | null = null;

export function initializeRedis(): void {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

    logger.info("Upstash Redis client initialized");
    return;
  }

  logger.warn("Upstash Redis is not configured. Some features may be unavailable.");
}

export function getRedis(): Redis {
  if (!redisClient) {
    throw new Error("Redis client is not initialized. Configure Upstash Redis.");
  }

  return redisClient;
}

export function getRedisSafe(): Redis | null {
  return redisClient;
}

export async function checkRedisHealth(): Promise<
  "connected" | "not_configured" | "error"
> {
  if (!redisClient) {
    return "not_configured";
  }

  try {
    await redisClient.ping();
    return "connected";
  } catch (error) {
    logger.error("Redis health check failed", error);
    return "error";
  }
}