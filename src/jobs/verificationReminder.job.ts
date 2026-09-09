import mongoose from "mongoose";
import { User } from "../models/User";
import { VerificationToken } from "../models/VerificationToken";
import { EmailService } from "../services/email.service";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { JobResult } from "../services/jobRunner.service";
import { getRedisSafe } from "../lib/redis";

/**
 * Verification Reminder Job
 *
 * Finds users who registered but have not verified their email.
 * Sends reminder emails based on the following schedule:
 * - 1 hour after registration (first reminder)
 * - 24 hours after registration (second reminder)
 * - 48 hours after registration (final warning)
 *
 * After the grace period (configurable), unverified accounts
 * may be restricted or disabled.
 */

const REMINDER_KEY_PREFIX = "verification_reminder_sent:";

export async function runVerificationReminderJob(): Promise<JobResult> {
  try {
    const redis = getRedisSafe();
    const now = new Date();

    // Find unverified users created within the last 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const unverifiedUsers = await User.find({
      isEmailVerified: false,
      isAccountDisabled: false,
      createdAt: { $gte: sevenDaysAgo },
    }).select("_id email name createdAt");

    if (unverifiedUsers.length === 0) {
      return {
        success: true,
        message: "No unverified users found",
        affectedCount: 0,
      };
    }

    let remindersSent = 0;
    let accountsRestricted = 0;

    for (const user of unverifiedUsers) {
      const userId = user._id.toString();
      const hoursSinceRegistration =
        (now.getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60);

      // Determine which reminder to send
      let reminderLevel: "first" | "second" | "final" | null = null;

      if (hoursSinceRegistration >= 48) {
        reminderLevel = "final";
      } else if (hoursSinceRegistration >= 24) {
        reminderLevel = "second";
      } else if (hoursSinceRegistration >= 1) {
        reminderLevel = "first";
      }

      if (!reminderLevel) continue;

      // Check if this reminder level was already sent
      if (redis) {
        const reminderKey = `${REMINDER_KEY_PREFIX}${userId}:${reminderLevel}`;
        const alreadySent = await redis.exists(reminderKey);
        if (alreadySent) continue;
      }

      // Generate a new verification link
      const crypto = await import("crypto");
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      const expiryHours = env.EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS;
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

      // Invalidate old unused tokens
      await VerificationToken.updateMany(
        { userId: user._id, type: "email-verification", usedAt: null },
        { $set: { usedAt: new Date() } }
      );

      await VerificationToken.create({
        userId: user._id,
        token: tokenHash,
        type: "email-verification",
        expiresAt,
      });

      const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;

      // Send reminder email
      const emailSent = await EmailService.sendVerificationEmail(
        user.email,
        user.name,
        verificationUrl,
        expiryHours
      );

      if (emailSent) {
        remindersSent++;

        // Mark reminder as sent in Redis
        if (redis) {
          const reminderKey = `${REMINDER_KEY_PREFIX}${userId}:${reminderLevel}`;
          await redis.set(reminderKey, "1", {
            ex: 7 * 24 * 60 * 60, // 7 days
          });
        }

        logger.debug(`Verification reminder sent (${reminderLevel})`, {
          userId,
          email: user.email,
        });
      }

      // Restrict account after grace period (72 hours)
      const GRACE_PERIOD_HOURS = 72;
      if (hoursSinceRegistration >= GRACE_PERIOD_HOURS) {
        user.isAccountDisabled = true;
        await user.save();
        accountsRestricted++;

        logger.info("Unverified account restricted after grace period", {
          userId,
          email: user.email,
          hoursSinceRegistration: Math.round(hoursSinceRegistration),
        });
      }
    }

    return {
      success: true,
      message: `Processed ${unverifiedUsers.length} unverified users`,
      affectedCount: remindersSent,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return {
      success: false,
      message: "Verification reminder job failed",
      error: errorMessage,
    };
  }
}