import crypto from "node:crypto";
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiCredential } from "../models/ApiCredential";
import { ApiError } from "../utils/ApiError";
import { apiCredentialSchema } from "../validators/otp.validator";
import { SecurityService } from "../services/security.service";
import { OtpDailyUsage } from "../models/OtpDailyUsage";
import { SmsDailyUsage } from "../models/SmsDailyUsage";
import { SubscriptionService } from "../services/subscription.service";

export const createApiCredential = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized("Authentication required");
  const { name } = apiCredentialSchema.parse(req.body);
  const rawKey = `ml_live_${crypto.randomBytes(32).toString("base64url")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const credential = await ApiCredential.create({ userId: req.user.userId, name, keyPrefix: rawKey.slice(0, 16), keyHash, permissions: ["otp:create", "otp:verify"] });
  await SecurityService.recordAuditLog({ userId: req.user.userId, action: "API_CREDENTIAL_CREATED", entityType: "ApiCredential", entityId: credential._id.toString(), req });
  res.status(201).json({ success: true, message: "API credential created. Store the secret securely; it will not be shown again.", data: { id: credential._id, name, keyPrefix: credential.keyPrefix, apiKey: rawKey } });
});

export const listApiCredentials = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized("Authentication required");
  const credentials = await ApiCredential.find({ userId: req.user.userId }).select("name keyPrefix permissions isActive lastUsedAt revokedAt createdAt").sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: { credentials } });
});

export const revokeApiCredential = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized("Authentication required");
  const credential = await ApiCredential.findOneAndUpdate({ _id: req.params.credentialId, userId: req.user.userId, isActive: true }, { $set: { isActive: false, revokedAt: new Date() } }, { new: true });
  if (!credential) throw ApiError.notFound("API credential not found");
  await SecurityService.recordAuditLog({ userId: req.user.userId, action: "API_CREDENTIAL_REVOKED", entityType: "ApiCredential", entityId: credential._id.toString(), req });
  res.json({ success: true, message: "API credential revoked" });
});

export const getDeveloperUsage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized("Authentication required");
  const day = new Date().toISOString().slice(0, 10);
  const [otp, sms, limits] = await Promise.all([
    OtpDailyUsage.findOne({ userId: req.user.userId, day }).lean(),
    SmsDailyUsage.findOne({ userId: req.user.userId, day }).lean(),
    SubscriptionService.getUserLimits(req.user.userId),
  ]);
  res.json({ success: true, data: { day, otpRequests: otp?.requestCount || 0, otpLimit: limits.maxDailyOtpRequests, smsMessages: sms?.messageCount || 0, smsLimit: limits.maxDailyMessages, apiAccess: limits.apiAccess, otpEnabled: limits.otpEnabled } });
});