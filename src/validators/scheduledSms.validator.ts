import { z } from "zod";

export const createScheduledSmsSchema = z.object({
  deviceId: z.string().min(1).optional(),
  recipients: z.string().min(1).max(50000),
  messageBody: z.string().min(1).max(2000),
  campaignName: z.string().max(100).optional(),
  runAt: z.coerce.date().refine((value) => value.getTime() > Date.now(), "runAt must be in the future"),
});