import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { SmsJob } from "../models/SmsJob";
import { SmsCampaign } from "../models/SmsCampaign";
import { SmsQueueService } from "../services/smsQueue.service";
import {
  reportIncomingSmsSchema,
  reportJobStatusSchema,
} from "../validators/sms.validator";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import { IncomingSms } from "../models/IncomingSms";

/**
 * Fetch next SMS job for the device.
 * Called by the Android app to get the next message to send.
 * GET /api/v1/device-agent/sms/next
 * Authorization: DeviceToken <token>
 */
export const fetchNextJob = asyncHandler(
  async (req: Request, res: Response) => {
    const deviceInfo = req.device;

    if (!deviceInfo) {
      throw ApiError.unauthorized("Device authentication required");
    }

    const deviceId = deviceInfo.deviceId;

    if (deviceInfo.gatewayState === "off" || deviceInfo.status !== "active") {
      res.status(200).json({
        success: true,
        data: { job: null, waitMs: 0, message: "Gateway is off" },
      });
      return;
    }

    // Acquire device lock to prevent concurrent processing
    const hasLock = await SmsQueueService.acquireDeviceLock(deviceId);
    if (!hasLock) {
      res.status(200).json({
        success: true,
        data: {
          job: null,
          message: "Device is busy processing another job",
        },
      });
      return;
    }

    try {
      // Get next job from queue (respects delay)
      const queueResult = await SmsQueueService.getNextJobId(deviceId);

      if (!queueResult.jobId) {
        // Release lock if no job
        await SmsQueueService.releaseDeviceLock(deviceId);

        res.status(200).json({
          success: true,
          data: {
            job: null,
            waitMs: queueResult.waitMs || 0,
            message: queueResult.waitMs
              ? `Minimum delay not elapsed. Wait ${queueResult.waitMs}ms.`
              : "No jobs in queue",
          },
        });
        return;
      }

      // Fetch job details
      const job = await SmsJob.findById(queueResult.jobId);

      if (!job) {
        await SmsQueueService.releaseDeviceLock(deviceId);
        res.status(200).json({
          success: true,
          data: { job: null, message: "Job not found" },
        });
        return;
      }

      // Skip if already processed
      if (job.status !== "queued") {
        await SmsQueueService.releaseDeviceLock(deviceId);
        res.status(200).json({
          success: true,
          data: { job: null, message: "Job already processed" },
        });
        return;
      }

      // Update job status to processing
      job.status = "processing";
      job.lockedAt = new Date();
      job.lockedBy = deviceId;
      job.attempts += 1;
      await job.save();

      // Update campaign status to processing if not already
      await SmsCampaign.findByIdAndUpdate(job.campaignId, {
        $set: { status: "processing" },
        $setOnInsert: { startedAt: new Date() },
      });

      res.status(200).json({
        success: true,
        data: {
          job: {
            jobId: job._id.toString(),
            recipient: job.recipient,
            messageBody: job.messageBody,
            smsParts: job.smsParts,
            campaignId: job.campaignId.toString(),
          },
        },
      });
    } catch (error) {
      await SmsQueueService.releaseDeviceLock(deviceId);
      throw error;
    }
  }
);

/**
 * Report job status (sent or failed).
 * Called by the Android app after attempting to send.
 * POST /api/v1/device-agent/sms/report
 * Authorization: DeviceToken <token>
 */
export const reportJobStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const deviceInfo = req.device;

    if (!deviceInfo) {
      throw ApiError.unauthorized("Device authentication required");
    }

    const validatedData = reportJobStatusSchema.parse(req.body);
    const { jobId, status, failureReason } = validatedData;

    const job = await SmsJob.findById(jobId);

    if (!job) {
      throw ApiError.notFound("Job not found");
    }

    // Verify job belongs to this device
    if (job.deviceId.toString() !== deviceInfo.deviceId) {
      throw ApiError.forbidden("This job does not belong to your device");
    }

    // Prevent double reporting
    if (job.status === "sent" || job.status === "failed") {
      res.status(200).json({
        success: true,
        message: `Job already marked as ${job.status}`,
      });
      return;
    }

    if (status === "sent") {
      job.status = "sent";
      job.sentAt = new Date();
      job.failureReason = undefined;

      // Update campaign counters
      await SmsCampaign.findByIdAndUpdate(job.campaignId, {
        $inc: { successCount: 1, processedCount: 1 },
      });
    } else {
      job.status = "failed";
      job.failedAt = new Date();
      job.failureReason = failureReason || "Unknown error";

      // Update campaign counters
      await SmsCampaign.findByIdAndUpdate(job.campaignId, {
        $inc: { failedCount: 1, processedCount: 1 },
      });
    }

    await job.save();

    // Release device lock
    await SmsQueueService.releaseDeviceLock(deviceInfo.deviceId);

    // Check if campaign is complete
    const campaign = await SmsCampaign.findById(job.campaignId);
    if (campaign) {
      const remainingJobs = await SmsJob.countDocuments({
        campaignId: campaign._id,
        status: { $in: ["queued", "assigned", "processing", "sending"] },
      });

      if (remainingJobs === 0) {
        if (campaign.failedCount === 0) {
          campaign.status = "completed";
        } else if (campaign.successCount === 0) {
          campaign.status = "failed";
        } else {
          campaign.status = "partially_failed";
        }
        campaign.completedAt = new Date();
        await campaign.save();

        logger.info("Campaign completed", {
          campaignId: campaign._id.toString(),
          status: campaign.status,
          successCount: campaign.successCount,
          failedCount: campaign.failedCount,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Job status reported: ${status}`,
    });
  }
);

/**
 * Get queue status for the device.
 * GET /api/v1/device-agent/sms/queue-status
 * Authorization: DeviceToken <token>
 */
export const getQueueStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const deviceInfo = req.device;

    if (!deviceInfo) {
      throw ApiError.unauthorized("Device authentication required");
    }

    const queueLength = await SmsQueueService.getQueueLength(
      deviceInfo.deviceId
    );

    res.status(200).json({
      success: true,
      data: {
        deviceId: deviceInfo.deviceId,
        queueLength,
        minDelayMs: 3000,
      },
    });
  }
);

/**
 * Report an incoming SMS received on the device.
 * POST /api/v1/device-agent/sms/incoming
 * Authorization: DeviceToken <token>
 */
export const reportIncomingSms = asyncHandler(
  async (req: Request, res: Response) => {
    const deviceInfo = req.device;

    if (!deviceInfo) {
      throw ApiError.unauthorized("Device authentication required");
    }

    const data = reportIncomingSmsSchema.parse(req.body);

    const record = await IncomingSms.create({
      userId: deviceInfo.userId,
      deviceId: deviceInfo.deviceId,
      senderNumber: data.senderNumber,
      messageBody: data.messageBody,
      receivedAt: data.receivedAt ? new Date(data.receivedAt) : new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Incoming SMS recorded",
      data: { id: record._id.toString() },
    });
  }
);