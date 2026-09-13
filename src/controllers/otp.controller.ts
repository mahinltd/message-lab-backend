import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { createOtpSchema, verifyOtpSchema } from "../validators/otp.validator";
import { OtpService } from "../services/otp.service";

type ApiRequest = Request & { apiClient?: { credentialId: string; userId: string; permissions: string[] } };

export const createOtp = asyncHandler(async (req: ApiRequest, res: Response) => {
  if (!req.apiClient || !req.apiClient.permissions.includes("otp:create")) throw ApiError.forbidden("OTP creation is not permitted for this API key");
  const input = createOtpSchema.parse(req.body);
  const result = await OtpService.create(req.apiClient.userId, req.apiClient.credentialId, input, req, req.header("Idempotency-Key") || undefined);
  res.status(201).json({ success: true, data: result });
});

export const verifyOtp = asyncHandler(async (req: ApiRequest, res: Response) => {
  if (!req.apiClient || !req.apiClient.permissions.includes("otp:verify")) throw ApiError.forbidden("OTP verification is not permitted for this API key");
  const input = verifyOtpSchema.parse(req.body);
  const result = await OtpService.verify(req.apiClient.userId, input.requestId, input.code, req);
  res.json({ success: true, data: result });
});

export const resendOtp = asyncHandler(async (req: ApiRequest, res: Response) => {
  if (!req.apiClient || !req.apiClient.permissions.includes("otp:create")) throw ApiError.forbidden("OTP resend is not permitted for this API key");
  const result = await OtpService.resend(req.apiClient.userId, String(req.params.requestId), req);
  res.json({ success: true, data: result });
});

export const getOtpStatus = asyncHandler(async (req: ApiRequest, res: Response) => {
  if (!req.apiClient || !req.apiClient.permissions.includes("otp:verify")) throw ApiError.forbidden("OTP status is not permitted for this API key");
  const result = await OtpService.status(req.apiClient.userId, String(req.params.requestId));
  res.json({ success: true, data: result });
});