import crypto from "node:crypto";
import mongoose from "mongoose";
import { OtpVerification } from "../models/OtpVerification";
import { Device } from "../models/Device";
import { ApiError } from "../utils/ApiError";
import { SubscriptionService } from "./subscription.service";
import { SmsService } from "./sms.service";
import { SecurityService } from "./security.service";
import { Request } from "express";
import { OtpDailyUsage } from "../models/OtpDailyUsage";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_PHONE_REQUESTS_PER_DAY = 5;
const MAX_RESENDS = 3;

function hashCode(code: string, salt: string): Buffer {
  return crypto.createHash("sha256").update(`${salt}:${code}`).digest();
}

function createCode() {
  const code = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString("hex");
  return { code, salt, otpHash: hashCode(code, salt).toString("hex") };
}

export class OtpService {
  private static async reserveQuota(userId: string, limit: number) {
    const day = new Date().toISOString().slice(0, 10);
    try {
      const updated = await OtpDailyUsage.findOneAndUpdate({ userId, day, $expr: { $lte: [{ $add: ["$requestCount", 1] }, limit] } }, { $inc: { requestCount: 1 } }, { new: true });
      if (updated) return;
      await OtpDailyUsage.create({ userId, day, requestCount: 1 });
    } catch (error: unknown) {
      if ((error as { code?: number })?.code !== 11000) throw error;
      const updated = await OtpDailyUsage.findOneAndUpdate({ userId, day, $expr: { $lte: [{ $add: ["$requestCount", 1] }, limit] } }, { $inc: { requestCount: 1 } }, { new: true });
      if (!updated) throw ApiError.forbidden("Your daily OTP request limit has been reached");
    }
  }

  private static async getDevice(userId: string) {
    const device = await Device.findOne({ userId, status: "active", lastSeenAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } });
    if (!device) throw ApiError.badRequest("No active gateway device is available");
    return device;
  }

  static async create(userId: string, credentialId: string, input: { recipient: string; reference?: string; metadata?: Record<string, unknown> }, req: Request, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existing = await OtpVerification.findOne({ userId, idempotencyKey }).lean();
      if (existing) return { requestId: existing.requestId, expiresAt: existing.expiresAt, status: existing.status };
    }
    const limits = await SubscriptionService.getUserLimits(userId);
    if (!limits.apiAccess || !limits.otpEnabled || limits.maxDailyOtpRequests <= 0) throw ApiError.forbidden("OTP API access is not enabled for your plan");
    const phoneRequests = await OtpVerification.countDocuments({ userId, recipient: input.recipient, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    if (phoneRequests >= MAX_PHONE_REQUESTS_PER_DAY) throw ApiError.tooManyRequests("Too many OTP requests for this phone number");
    const device = await this.getDevice(userId);
    await this.reserveQuota(userId, limits.maxDailyOtpRequests);
    const { code, salt, otpHash } = createCode();
    const requestId = `otp_${crypto.randomBytes(18).toString("base64url")}`;
    const record = await OtpVerification.create({ requestId, userId, apiCredentialId: credentialId, recipient: input.recipient, otpHash, otpSalt: salt, reference: input.reference || null, metadata: input.metadata || {}, expiresAt: new Date(Date.now() + OTP_TTL_MS), deviceId: device._id, idempotencyKey: idempotencyKey || null });
    try {
      const campaign = await SmsService.createBulkCampaign(userId, device._id.toString(), { campaignName: "OTP Verification", recipients: input.recipient, messageBody: `Your MessageLab verification code is ${code}. It expires in 5 minutes.` }, req);
      record.smsCampaignId = new mongoose.Types.ObjectId(campaign.campaignId);
      await record.save();
    } catch (error) {
      record.status = "failed";
      record.failureReason = "SMS could not be queued";
      await record.save();
      throw error;
    }
    await SecurityService.recordAuditLog({ userId, action: "OTP_CREATED", entityType: "OtpVerification", entityId: record._id.toString(), req, metadata: { requestId } });
    return { requestId, expiresAt: record.expiresAt, status: record.status };
  }

  static async resend(userId: string, requestId: string, req: Request) {
    const record = await OtpVerification.findOne({ requestId, userId });
    if (!record) throw ApiError.notFound("Verification request not found");
    if (record.status === "verified" || record.status === "failed") throw ApiError.badRequest("This verification request cannot be resent");
    if (record.resendCount >= MAX_RESENDS) throw ApiError.tooManyRequests("Maximum OTP resend attempts reached");
    const recentPhoneRequests = await OtpVerification.countDocuments({ userId, recipient: record.recipient, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    if (recentPhoneRequests >= MAX_PHONE_REQUESTS_PER_DAY) throw ApiError.tooManyRequests("Too many OTP requests for this phone number");
    const limits = await SubscriptionService.getUserLimits(userId);
    if (!limits.apiAccess || !limits.otpEnabled || limits.maxDailyOtpRequests <= 0) throw ApiError.forbidden("OTP API access is not enabled for your plan");
    const device = await this.getDevice(userId);
    await this.reserveQuota(userId, limits.maxDailyOtpRequests);
    const { code, salt, otpHash } = createCode();
    const campaign = await SmsService.createBulkCampaign(userId, device._id.toString(), { campaignName: "OTP Verification", recipients: record.recipient, messageBody: `Your MessageLab verification code is ${code}. It expires in 5 minutes.` }, req);
    record.otpHash = otpHash;
    record.otpSalt = salt;
    record.expiresAt = new Date(Date.now() + OTP_TTL_MS);
    record.status = "pending";
    record.attempts = 0;
    record.resendCount += 1;
    record.smsCampaignId = new mongoose.Types.ObjectId(campaign.campaignId);
    record.deviceId = device._id;
    await record.save();
    await SecurityService.recordAuditLog({ userId, action: "OTP_RESENT", entityType: "OtpVerification", entityId: record._id.toString(), req, metadata: { requestId } });
    return { requestId, expiresAt: record.expiresAt, resendCount: record.resendCount, status: record.status };
  }

  static async status(userId: string, requestId: string) {
    const record = await OtpVerification.findOne({ requestId, userId }).lean();
    if (!record) throw ApiError.notFound("Verification request not found");
    let deliveryStatus = "created";
    if (record.smsCampaignId) {
      const campaign = await SmsService.getCampaignById(userId, record.smsCampaignId.toString());
      deliveryStatus = campaign.status;
    }
    return { requestId, status: record.status, deliveryStatus, expiresAt: record.expiresAt, attempts: record.attempts, resendCount: record.resendCount };
  }

  static async verify(userId: string, requestId: string, code: string, req: Request) {
    const record = await OtpVerification.findOne({ requestId, userId });
    if (!record) throw ApiError.notFound("Verification request not found");
    if (record.status !== "pending") return { verified: record.status === "verified", status: record.status };
    if (record.expiresAt <= new Date()) {
      record.status = "expired";
      await record.save();
      return { verified: false, status: "expired" };
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      record.status = "failed";
      record.failureReason = "Maximum verification attempts exceeded";
      await record.save();
      return { verified: false, status: "failed" };
    }
    record.attempts += 1;
    const expected = Buffer.from(record.otpHash, "hex");
    const actual = hashCode(code, record.otpSalt);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      if (record.attempts >= MAX_ATTEMPTS) record.status = "failed";
      await record.save();
      return { verified: false, status: record.status, attemptsRemaining: Math.max(0, MAX_ATTEMPTS - record.attempts) };
    }
    record.status = "verified";
    record.verifiedAt = new Date();
    await record.save();
    await SecurityService.recordAuditLog({ userId, action: "OTP_VERIFIED", entityType: "OtpVerification", entityId: record._id.toString(), req, metadata: { requestId } });
    return { verified: true, status: "verified" };
  }
}