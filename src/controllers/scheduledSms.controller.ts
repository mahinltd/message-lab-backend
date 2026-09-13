import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { createScheduledSmsSchema } from "../validators/scheduledSms.validator";
import { ScheduledSmsService } from "../services/scheduledSms.service";

export const createScheduledSms = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized("Authentication required");
  const input = createScheduledSmsSchema.parse(req.body);
  const result = await ScheduledSmsService.create(req.user.userId, input, req, req.header("Idempotency-Key") || undefined);
  res.status(201).json({ success: true, data: result });
});

export const listScheduledSms = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized("Authentication required");
  res.json({ success: true, data: { schedules: await ScheduledSmsService.list(req.user.userId) } });
});

export const cancelScheduledSms = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized("Authentication required");
  res.json({ success: true, data: await ScheduledSmsService.cancel(req.user.userId, String(req.params.scheduleId)) });
});