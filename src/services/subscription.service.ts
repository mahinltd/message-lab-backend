import mongoose from "mongoose";
import { Subscription } from "../models/Subscription";
import { PlanConfig } from "../models/PlanConfig";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";

/**
 * Subscription lifecycle management service.
 */
export class SubscriptionService {
  /**
   * Get the active subscription for a user.
   * Returns null if no active subscription exists.
   */
  static async getActiveSubscription(
    userId: string
  ): Promise<any | null> {
    const subscription = await Subscription.findOne({
      userId,
      status: "active",
      expiresAt: { $gt: new Date() },
    }).lean();

    return subscription;
  }

  /**
   * Get the current effective plan for a user.
   * If no active paid subscription, returns "free".
   */
  static async getCurrentPlanId(userId: string): Promise<string> {
    const activeSub = await this.getActiveSubscription(userId);

    if (activeSub) {
      return activeSub.planId;
    }

    return "free";
  }

  /**
   * Get plan configuration by planId.
   */
  static async getPlanConfig(planId: string): Promise<any> {
    const plan = await PlanConfig.findOne({
      planId: planId.toLowerCase(),
      isActive: true,
    }).lean();

    if (!plan) {
      throw ApiError.notFound(`Plan "${planId}" not found or inactive`);
    }

    return plan;
  }

  /**
   * Create or renew a subscription after payment approval.
   */
  static async activateSubscription(
    userId: string,
    planId: string,
    paymentSubmissionId: string,
    durationDays: number = 30
  ): Promise<any> {
    const plan = await this.getPlanConfig(planId);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Check if user already has an active subscription for the same plan
    const existingSub = await Subscription.findOne({
      userId,
      planId,
      status: "active",
      expiresAt: { $gt: now },
    });

    if (existingSub) {
      // Extend existing subscription
      existingSub.expiresAt = new Date(
        existingSub.expiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000
      );
      existingSub.paymentSubmissionId = new mongoose.Types.ObjectId(
        paymentSubmissionId
      );
      await existingSub.save();

      logger.info("Subscription extended", {
        userId,
        planId,
        newExpiry: existingSub.expiresAt,
      });

      return existingSub;
    }

    // Expire any other active subscriptions (plan change)
    await Subscription.updateMany(
      {
        userId,
        status: "active",
      },
      {
        $set: { status: "cancelled", cancelledAt: now, cancelReason: "Plan changed" },
      }
    );

    // Create new subscription
    const subscription = await Subscription.create({
      userId,
      planId: plan.planId,
      planName: plan.displayName,
      status: "active",
      startedAt: now,
      expiresAt,
      paymentSubmissionId: new mongoose.Types.ObjectId(paymentSubmissionId),
      autoRenew: false,
    });

    logger.info("Subscription activated", {
      userId,
      planId,
      expiresAt,
    });

    return subscription;
  }

  /**
   * Get all subscriptions for a user (history).
   */
  static async getUserSubscriptions(userId: string): Promise<any[]> {
    return Subscription.find({ userId })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get subscription limits for a user based on current plan.
   */
  static async getUserLimits(userId: string): Promise<{
    planId: string;
    planName: string;
    maxRecipientsPerCampaign: number;
    maxDailyMessages: number;
    maxDevices: number;
    minSmsDelayMs: number;
  }> {
    const planId = await this.getCurrentPlanId(userId);
    const plan = await this.getPlanConfig(planId);

    return {
      planId: plan.planId,
      planName: plan.displayName,
      maxRecipientsPerCampaign: plan.maxRecipientsPerCampaign,
      maxDailyMessages: plan.maxDailyMessages,
      maxDevices: plan.maxDevices,
      minSmsDelayMs: plan.minSmsDelayMs,
    };
  }

  /**
   * Expire all subscriptions that have passed their expiry date.
   * Should be run periodically (cron or admin trigger).
   */
  static async expireOverdueSubscriptions(): Promise<number> {
    const now = new Date();

    const result = await Subscription.updateMany(
      {
        status: "active",
        expiresAt: { $lt: now },
      },
      {
        $set: { status: "expired" },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info("Expired overdue subscriptions", {
        count: result.modifiedCount,
      });
    }

    return result.modifiedCount;
  }
}