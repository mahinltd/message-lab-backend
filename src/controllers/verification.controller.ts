import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { VerificationService } from "../services/verification.service";

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

const resendEmailSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = verifyEmailSchema.parse(req.body);
  const result = await VerificationService.verifyEmail(token, req);

  res.status(200).json({
    success: true,
    message: "Email verified successfully. You can now login.",
    data: {
      email: result.email,
      name: result.name,
    },
  });
});

export const resendVerificationEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email } = resendEmailSchema.parse(req.body);
  await VerificationService.resendVerificationEmail(email, req);

  res.status(200).json({
    success: true,
    message: "If an unverified account exists with this email, a verification link has been sent.",
  });
});