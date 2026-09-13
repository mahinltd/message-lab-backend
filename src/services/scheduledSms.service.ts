import mongoose from "mongoose";
import { Request } from "express";
import { ScheduledSms } from "../models/ScheduledSms";
import { Device } from "../models/Device";
import { SmsService } from "./sms.service";
import { ApiError } from "../utils/ApiError";

export class ScheduledSmsService {
  static async create(userId: string, input: { deviceId?: string; recipients: string; messageBody: string; campaignName?: string; runAt: Date }, req: Request, idempotencyKey?: string) {
    const device = await Device.findOne({ ...(input.deviceId ? { _id: input.deviceId } : {}), userId, status: { $in: ["active", "offline"] } });
    if (!device) throw ApiError.badRequest("The selected device is not available");
    if (idempotencyKey) {
      const existing = await ScheduledSms.findOne({ userId, idempotencyKey }).lean();
      if (existing) return existing;
    }
    return ScheduledSms.create({ ...input, userId, deviceId: device._id, idempotencyKey: idempotencyKey || null, status: "pending" });
  }

  static async list(userId: string) {
    return ScheduledSms.find({ userId }).sort({ runAt: 1 }).limit(100).lean();
  }

  static async cancel(userId: string, id: string) {
    const result = await ScheduledSms.findOneAndUpdate({ _id: id, userId, status: "pending" }, { $set: { status: "cancelled" } }, { new: true });
    if (!result) throw ApiError.notFound("Scheduled message not found or already processed");
    return result;
  }

  static async runDue(): Promise<number> {
    let count = 0;
    while (true) {
      const scheduled = await ScheduledSms.findOneAndUpdate({ status: "pending", runAt: { $lte: new Date() } }, { $set: { status: "processing" } }, { new: true, sort: { runAt: 1 } });
      if (!scheduled) break;
      try {
        const campaign = await SmsService.createBulkCampaign(scheduled.userId.toString(), scheduled.deviceId.toString(), { campaignName: scheduled.campaignName || "Scheduled SMS", recipients: scheduled.recipients, messageBody: scheduled.messageBody }, {} as Request, scheduled.idempotencyKey || undefined);
        await ScheduledSms.updateOne({ _id: scheduled._id }, { $set: { status: "queued", campaignId: new mongoose.Types.ObjectId(campaign.campaignId) } });
      } catch (error) {
        await ScheduledSms.updateOne({ _id: scheduled._id }, { $set: { status: "failed", failureReason: error instanceof Error ? error.message : "Scheduled SMS failed" } });
      }
      count += 1;
    }
    return count;
  }
}