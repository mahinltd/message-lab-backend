import { SubscriptionService } from "../services/subscription.service";
import { JobResult } from "../services/jobRunner.service";

/**
 * Subscription Expiry Job
 *
 * Checks for subscriptions that have passed their expiry date
 * and marks them as expired. Users automatically fall back
 * to the Free plan when their paid subscription expires.
 */
export async function runSubscriptionExpiryJob(): Promise<JobResult> {
  try {
    const expiredCount =
      await SubscriptionService.expireOverdueSubscriptions();

    return {
      success: true,
      message: `Expired ${expiredCount} overdue subscription(s)`,
      affectedCount: expiredCount,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return {
      success: false,
      message: "Subscription expiry job failed",
      error: errorMessage,
    };
  }
}