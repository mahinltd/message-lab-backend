import { z } from "zod";

export const createOtpSchema = z.object({
  recipient: z.string().min(5).max(20),
  reference: z.string().max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const verifyOtpSchema = z.object({
  requestId: z.string().min(1).max(100),
  code: z.string().regex(/^\d{6}$/, "OTP must be six digits"),
});

export const apiCredentialSchema = z.object({
  name: z.string().min(1).max(100),
});