import { getRedisSafe } from "../lib/redis";
import { env } from "../config/env";
import { logger } from "../utils/logger";

/**
 * SMS Queue Service using Upstash Redis.
 * Manages device-specific queues and enforces minimum delay between sends.
 */

const QUEUE_PREFIX = "sms:queue:";
const LAST_SEND_PREFIX = "sms:last_send:";
const DEVICE_LOCK_PREFIX = "sms:device_lock:";

export class SmsQueueService {
  /**
   * Enqueue job IDs to a device's queue.
   */
  static async enqueueJobs(deviceId: string, jobIds: string[]): Promise<void> {
    const redis = getRedisSafe();
    if (!redis) {
      logger.warn("Redis not configured. Jobs not enqueued.", {
        deviceId,
        jobCount: jobIds.length,
      });
      return;
    }

    const queueKey = `${QUEUE_PREFIX}${deviceId}`;

    // Push all job IDs to the list (RPUSH for FIFO)
    await redis.rpush(queueKey, ...jobIds);

    logger.info("Jobs enqueued", {
      deviceId,
      jobCount: jobIds.length,
      queueKey,
    });
  }

  /**
   * Get the next job ID from a device's queue.
   * Respects the minimum delay between sends.
   * Returns null if queue is empty or delay has not elapsed.
   */
  static async getNextJobId(
    deviceId: string
  ): Promise<{ jobId: string | null; waitMs?: number }> {
    const redis = getRedisSafe();
    if (!redis) return { jobId: null };

    const lastSendKey = `${LAST_SEND_PREFIX}${deviceId}`;
    const queueKey = `${QUEUE_PREFIX}${deviceId}`;

    // Check minimum delay
    const lastSendStr = await redis.get(lastSendKey);

    if (lastSendStr) {
      const lastSendTime = parseInt(String(lastSendStr), 10);
      const elapsed = Date.now() - lastSendTime;
      const minDelay = env.SMS_MIN_DELAY_MS;

      if (elapsed < minDelay) {
        const waitMs = minDelay - elapsed;
        return { jobId: null, waitMs };
      }
    }

    // Pop the first job from the queue (LPOP for FIFO)
    const jobId = await redis.lpop(queueKey);

    if (!jobId) {
      return { jobId: null };
    }

    // Record send timestamp
    await redis.set(lastSendKey, String(Date.now()), {
      ex: Math.ceil(env.SMS_MIN_DELAY_MS / 1000) + 60,
    });

    return { jobId: String(jobId) };
  }

  /**
   * Get queue length for a device.
   */
  static async getQueueLength(deviceId: string): Promise<number> {
    const redis = getRedisSafe();
    if (!redis) return 0;

    const queueKey = `${QUEUE_PREFIX}${deviceId}`;
    const length = await redis.llen(queueKey);
    return Number(length) || 0;
  }

  /**
   * Clear a device's queue (used when cancelling campaigns).
   */
  static async clearDeviceQueue(deviceId: string): Promise<void> {
    const redis = getRedisSafe();
    if (!redis) return;

    const queueKey = `${QUEUE_PREFIX}${deviceId}`;
    await redis.del(queueKey);

    logger.info("Device queue cleared", { deviceId });
  }

  /**
   * Acquire a processing lock for a device.
   * Prevents concurrent job processing on the same device.
   */
  static async acquireDeviceLock(
    deviceId: string,
    lockDurationMs: number = 30000
  ): Promise<boolean> {
    const redis = getRedisSafe();
    if (!redis) return true; // No Redis = no lock (dev mode)

    const lockKey = `${DEVICE_LOCK_PREFIX}${deviceId}`;

    // SET NX with expiry
    const result = await redis.set(lockKey, "1", {
      nx: true,
      px: lockDurationMs,
    });

    return result === "OK";
  }

  /**
   * Release the processing lock for a device.
   */
  static async releaseDeviceLock(deviceId: string): Promise<void> {
    const redis = getRedisSafe();
    if (!redis) return;

    const lockKey = `${DEVICE_LOCK_PREFIX}${deviceId}`;
    await redis.del(lockKey);
  }
}