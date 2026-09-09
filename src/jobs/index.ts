import { jobRunner, JobDefinition } from "../services/jobRunner.service";
import { runVerificationReminderJob } from "./verificationReminder.job";
import { runSubscriptionExpiryJob } from "./subscriptionExpiry.job";
import { runDeviceOfflineMarkerJob } from "./deviceOfflineMarker.job";
import { runTokenCleanupJob } from "./tokenCleanup.job";
import { logger } from "../utils/logger";

/**
 * Register all scheduled jobs.
 * Called once during server startup.
 */
export function registerAllJobs(): void {
  const jobs: JobDefinition[] = [
    {
      name: "verification_reminder",
      description:
        "Sends reminder emails to unverified accounts and restricts accounts after grace period",
      intervalMs: 30 * 60 * 1000, // Every 30 minutes
      handler: runVerificationReminderJob,
      enabled: true,
    },
    {
      name: "subscription_expiry",
      description:
        "Expires subscriptions that have passed their expiry date",
      intervalMs: 15 * 60 * 1000, // Every 15 minutes
      handler: runSubscriptionExpiryJob,
      enabled: true,
    },
    {
      name: "device_offline_marker",
      description:
        "Marks devices as offline if no heartbeat received within timeout",
      intervalMs: 2 * 60 * 1000, // Every 2 minutes
      handler: runDeviceOfflineMarkerJob,
      enabled: true,
    },
    {
      name: "token_cleanup",
      description:
        "Removes expired verification tokens and pairing codes",
      intervalMs: 60 * 60 * 1000, // Every 1 hour
      handler: runTokenCleanupJob,
      enabled: true,
    },
  ];

  for (const job of jobs) {
    jobRunner.registerJobDefinition(job);
  }

  logger.info(`Registered ${jobs.length} scheduled jobs`);
}

export { jobRunner };