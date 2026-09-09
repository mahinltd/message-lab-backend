import mongoose from "mongoose";
import { SmsCampaign } from "../models/SmsCampaign";
import { SmsJob } from "../models/SmsJob";
import { Device } from "../models/Device";
import { ApiError } from "../utils/ApiError";
import { SecurityService } from "./security.service";
import { SmsQueueService } from "./smsQueue.service";
import { parseRecipientList, calculateSmsParts } from "../utils/phone";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { Request } from "express";
import { SendBulkSmsInput } from "../validators/sms.validator";

/**
 * Plan-based recipient limits.
 * Will be dynamic based on user subscription in the future.
 */
const PLAN_LIMITS: Record<string, number> = {
  free: env.FREE_PLAN_MAX_RECIPIENTS,
  pro: env.PRO_PLAN_MAX_RECIPIENTS,
  enterprise: 999999, // Effectively unlimited (subject to fair use)
};

const MAX_MESSAGE_LENGTH = 2000;

export class SmsService {
  /**
   * Create a bulk SMS campaign.
   * Validates recipients, checks plan limits, creates campaign + jobs,
   * and enqueues jobs to Redis.
   */
  static async createBulkCampaign(
    userId: string,
    deviceId: string,
    input: SendBulkSmsInput,
    req: Request
  ): Promise<{
    campaignId: string;
    totalRecipients: number;
    invalidCount: number;
    duplicateCount: number;
    estimatedSmsParts: number;
    estimatedTimeSeconds: number;
  }> {
    // Verify device belongs to user and is active
    const device = await Device.findOne({
      _id: deviceId,
      userId,
      status: "active",
    });

    if (!device) {
      throw ApiError.badRequest(
        "No active device found. Please connect a device first."
      );
    }

    // Parse and validate recipients
    const parsed = parseRecipientList(input.recipients);

    if (parsed.invalid.length > 0) {
      logger.warn("Invalid recipients detected", {
        userId,
        invalidCount: parsed.invalid.length,
        samples: parsed.invalid.slice(0, 5),
      });
    }

    if (parsed.valid.length === 0) {
      throw ApiError.badRequest(
        "No valid recipients found. Please check the phone numbers."
      );
    }

    // Check plan limit (default: free)
    const userPlan = "free"; // Will be dynamic after plan system is built
    const maxRecipients = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;

    if (parsed.valid.length > maxRecipients) {
      throw ApiError.forbidden(
        `Your current plan allows up to ${maxRecipients} recipients per campaign. You have ${parsed.valid.length} valid recipients. Please upgrade your plan.`
      );
    }

    // Calculate SMS parts
    const smsInfo = calculateSmsParts(input.messageBody);
    const totalSmsParts = parsed.valid.length * smsInfo.parts;

    // Create campaign
    const campaign = await SmsCampaign.create({
      userId,
      deviceId,
      campaignName: input.campaignName || undefined,
      messageBody: input.messageBody,
      totalRecipients: parsed.valid.length,
      status: "queued",
      planAtCreation: userPlan,
      minDelayMs: env.SMS_MIN_DELAY_MS,
      smsPartsPerMessage: smsInfo.parts,
      encoding: smsInfo.encoding,
    });

    // Create individual jobs for each recipient
    const jobs = parsed.valid.map((recipient, index) => ({
      campaignId: campaign._id,
      userId,
      deviceId,
      recipient,
      originalRecipient: input.recipients
        .split(/[,\n;]+/)
        .map((n) => n.trim())
        .filter((n) => n.length > 0)[index] || recipient,
      messageBody: input.messageBody,
      status: "queued" as const,
      smsParts: smsInfo.parts,
    }));

    await SmsJob.insertMany(jobs);

    // Enqueue all job IDs to Redis
    const createdJobs = await SmsJob.find({ campaignId: campaign._id }).select("_id");
    const jobIds = createdJobs.map((j) => j._id.toString());

    await SmsQueueService.enqueueJobs(deviceId, jobIds);

    // Estimate time: each job takes minDelay + ~1s processing
    const estimatedTimeSeconds =
      parsed.valid.length * (env.SMS_MIN_DELAY_MS / 1000 + 1);

    // Audit log
    await SecurityService.recordAuditLog({
      userId: new mongoose.Types.ObjectId(userId),
      action: "SMS_CAMPAIGN_CREATED",
      entityType: "SmsCampaign",
      entityId: campaign._id.toString(),
      req,
      metadata: {
        totalRecipients: parsed.valid.length,
        invalidCount: parsed.invalid.length,
        duplicateCount: parsed.duplicates.length,
        encoding: smsInfo.encoding,
      },
    });

    logger.info("SMS campaign created", {
      userId,
      campaignId: campaign._id.toString(),
      recipients: parsed.valid.length,
      encoding: smsInfo.encoding,
    });

    return {
      campaignId: campaign._id.toString(),
      totalRecipients: parsed.valid.length,
      invalidCount: parsed.invalid.length,
      duplicateCount: parsed.duplicates.length,
      estimatedSmsParts: totalSmsParts,
      estimatedTimeSeconds: Math.ceil(estimatedTimeSeconds),
    };
  }

  /**
   * Get campaign details with job summary.
   */
  static async getCampaignById(
    userId: string,
    campaignId: string
  ): Promise<any> {
    const campaign = await SmsCampaign.findOne({
      _id: campaignId,
      userId,
    }).lean();

    if (!campaign) {
      throw ApiError.notFound("Campaign not found");
    }

    // Get job status breakdown
    const jobSummary = await SmsJob.aggregate([
      { $match: { campaignId: new mongoose.Types.ObjectId(campaignId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const statusBreakdown: Record<string, number> = {};
    for (const item of jobSummary) {
      statusBreakdown[item._id] = item.count;
    }

    return {
      ...campaign,
      jobStatusBreakdown: statusBreakdown,
    };
  }

  /**
   * Get all campaigns for a user.
   */
  static async getUserCampaigns(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ campaigns: any[]; total: number }> {
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      SmsCampaign.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SmsCampaign.countDocuments({ userId }),
    ]);

    return { campaigns, total };
  }

  /**
   * Cancel a campaign.
   * Only cancels jobs that have not been sent yet.
   */
  static async cancelCampaign(
    userId: string,
    campaignId: string,
    req: Request
  ): Promise<{ cancelledJobs: number }> {
    const campaign = await SmsCampaign.findOne({
      _id: campaignId,
      userId,
    });

    if (!campaign) {
      throw ApiError.notFound("Campaign not found");
    }

    if (
      campaign.status === "completed" ||
      campaign.status === "cancelled" ||
      campaign.status === "failed"
    ) {
      throw ApiError.badRequest(
        `Campaign is already ${campaign.status}. Cannot cancel.`
      );
    }

    // Cancel all unsent jobs
    const cancelResult = await SmsJob.updateMany(
      {
        campaignId: campaign._id,
        status: { $in: ["queued", "assigned"] },
      },
      {
        $set: { status: "cancelled" },
      }
    );

    // Remove from Redis queue
    await SmsQueueService.clearDeviceQueue(campaign.deviceId.toString());

    // Update campaign status
    campaign.status = "cancelled";
    campaign.cancelledAt = new Date();
    campaign.cancelReason = "Cancelled by user";
    await campaign.save();

    // Audit log
    await SecurityService.recordAuditLog({
      userId: new mongoose.Types.ObjectId(userId),
      action: "SMS_CAMPAIGN_CANCELLED",
      entityType: "SmsCampaign",
      entityId: campaign._id.toString(),
      req,
      metadata: { cancelledJobs: cancelResult.modifiedCount },
    });

    logger.info("SMS campaign cancelled", {
      userId,
      campaignId,
      cancelledJobs: cancelResult.modifiedCount,
    });

    return { cancelledJobs: cancelResult.modifiedCount };
  }

  /**
   * Get campaign jobs with pagination.
   */
  static async getCampaignJobs(
    userId: string,
    campaignId: string,
    page: number = 1,
    limit: number = 50,
    status?: string
  ): Promise<{ jobs: any[]; total: number }> {
    const campaign = await SmsCampaign.findOne({
      _id: campaignId,
      userId,
    }).select("_id");

    if (!campaign) {
      throw ApiError.notFound("Campaign not found");
    }

    const skip = (page - 1) * limit;

    const filter: any = { campaignId: campaign._id };
    if (status) {
      filter.status = status;
    }

    const [jobs, total] = await Promise.all([
      SmsJob.find(filter)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .select("-messageBody")
        .lean(),
      SmsJob.countDocuments(filter),
    ]);

    return { jobs, total };
  }
}