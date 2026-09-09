import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { SmsService } from "../services/sms.service";
import { sendBulkSmsSchema } from "../validators/sms.validator";
import { ApiError } from "../utils/ApiError";
import { Device } from "../models/Device";
import { IncomingSms } from "../models/IncomingSms";

/**
 * Send bulk SMS (create campaign).
 * POST /api/v1/sms/bulk
 */
export const sendBulkSms = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const validatedData = sendBulkSmsSchema.parse(req.body);
    const userId = req.user.userId;

    // Find user's active device
    const device = await Device.findOne({
      userId,
      status: "active",
    });

    if (!device) {
      throw ApiError.badRequest(
        "No active device found. Please connect a device first."
      );
    }

    const result = await SmsService.createBulkCampaign(
      userId,
      device._id.toString(),
      validatedData,
      req
    );

    res.status(201).json({
      success: true,
      message: "SMS campaign created and queued for sending",
      data: result,
    });
  }
);

/**
 * Get all campaigns for the current user.
 * GET /api/v1/sms/campaigns
 */
export const getMyCampaigns = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await SmsService.getUserCampaigns(
      req.user.userId,
      page,
      limit
    );

    res.status(200).json({
      success: true,
      data: {
        campaigns: result.campaigns,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit),
        },
      },
    });
  }
);

/**
 * Get campaign details.
 * GET /api/v1/sms/campaigns/:campaignId
 */
export const getCampaign = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const campaignId = String(req.params.campaignId);

    const campaign = await SmsService.getCampaignById(
      req.user.userId,
      campaignId
    );

    res.status(200).json({
      success: true,
      data: { campaign },
    });
  }
);

/**
 * Get campaign jobs.
 * GET /api/v1/sms/campaigns/:campaignId/jobs
 */
export const getCampaignJobs = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const campaignId = String(req.params.campaignId);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const status = req.query.status as string | undefined;

    const result = await SmsService.getCampaignJobs(
      req.user.userId,
      campaignId,
      page,
      limit,
      status
    );

    res.status(200).json({
      success: true,
      data: {
        jobs: result.jobs,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit),
        },
      },
    });
  }
);

/**
 * Cancel a campaign.
 * POST /api/v1/sms/campaigns/:campaignId/cancel
 */
export const cancelCampaign = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const campaignId = String(req.params.campaignId);

    const result = await SmsService.cancelCampaign(
      req.user.userId,
      campaignId,
      req
    );

    res.status(200).json({
      success: true,
      message: "Campaign cancelled successfully",
      data: result,
    });
  }
);

/**
 * Get incoming SMS inbox.
 * GET /api/v1/sms/inbox
 */
export const getInbox = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized("Authentication required");

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    IncomingSms.find({ userId: req.user.userId })
      .sort({ receivedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    IncomingSms.countDocuments({ userId: req.user.userId }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

/**
 * Get unread incoming count.
 * GET /api/v1/sms/inbox/unread-count
 */
export const getInboxUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized("Authentication required");
  const unread = await IncomingSms.countDocuments({
    userId: req.user.userId,
    isRead: false,
  });
  res.status(200).json({ success: true, data: { unread } });
});

/**
 * Mark one incoming message as read.
 * POST /api/v1/sms/inbox/:id/read
 */
export const markInboxRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized("Authentication required");
  const id = String(req.params.id);
  await IncomingSms.updateOne(
    { _id: id, userId: req.user.userId },
    { $set: { isRead: true } }
  );
  res.status(200).json({ success: true });
});

/**
 * Mark all incoming messages as read.
 * POST /api/v1/sms/inbox/read-all
 */
export const markAllInboxRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized("Authentication required");
  await IncomingSms.updateMany(
    { userId: req.user.userId, isRead: false },
    { $set: { isRead: true } }
  );
  res.status(200).json({ success: true });
});