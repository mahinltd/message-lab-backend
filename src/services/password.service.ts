import crypto from "crypto";
import { User } from "../models/User";
import { VerificationToken } from "../models/VerificationToken";
import { ApiError } from "../utils/ApiError";
import { EmailService } from "./email.service";
import { SecurityService } from "./security.service";
import { hashPassword } from "../utils/password";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { Request } from "express";

const RESET_TOKEN_EXPIRY_MINUTES = 30;

export class PasswordService {
  /**
   * Request a password reset email.
   * Always returns success to prevent email enumeration.
   */
  static async requestReset(email: string, req: Request): Promise<void> {
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      logger.info("Password reset requested for unknown email", { email });
      return;
    }

    // Google-only accounts cannot reset via email
    if (!user.authProviders.local || !user.passwordHash) {
      return;
    }

    // Invalidate previous unused reset tokens
    await VerificationToken.updateMany(
      { userId: user._id, type: "password-reset", usedAt: null },
      { $set: { usedAt: new Date() } }
    );

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    await VerificationToken.create({
      userId: user._id,
      token: tokenHash,
      type: "password-reset",
      expiresAt: new Date(
        Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000
      ),
    });

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    await EmailService.sendPasswordResetEmail(
      user.email,
      user.name,
      resetUrl,
      RESET_TOKEN_EXPIRY_MINUTES
    );

    await SecurityService.recordAuditLog({
      userId: user._id,
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "User",
      entityId: user._id.toString(),
      req,
    });
  }

  /**
   * Reset the password using a valid token.
   */
  static async resetPassword(
    token: string,
    newPassword: string,
    req: Request
  ): Promise<void> {
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const record = await VerificationToken.findOne({
      token: tokenHash,
      type: "password-reset",
      usedAt: null,
    });

    if (!record) {
      throw ApiError.badRequest("Invalid or expired reset token");
    }

    if (record.expiresAt < new Date()) {
      throw ApiError.badRequest(
        "Reset token has expired. Please request a new one."
      );
    }

    const user = await User.findById(record.userId);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    record.usedAt = new Date();
    await record.save();

    await SecurityService.recordAuditLog({
      userId: user._id,
      action: "PASSWORD_RESET_COMPLETED",
      entityType: "User",
      entityId: user._id.toString(),
      req,
    });

    // Security notification
    await EmailService.sendAccountUpdateEmail(
      user.email,
      user.name,
      "Password Changed",
      "Your password was recently changed. If this wasn't you, contact support immediately.",
      req.ip
    );
  }
}