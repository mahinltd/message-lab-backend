import crypto from "crypto";
import mongoose from "mongoose";
import { VerificationToken } from "../models/VerificationToken";
import { User } from "../models/User";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { EmailService } from "./email.service";
import { SecurityService } from "./security.service";
import { getRedisSafe } from "../lib/redis";
import { logger } from "../utils/logger";
import { Request } from "express";

export class VerificationService {
  /**
   * Generate a secure verification token and send it via email.
   */
  static async sendEmailVerification(userId: mongoose.Types.ObjectId, req?: Request): Promise<void> {
    const user = await User.findById(userId);

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    if (user.isEmailVerified) {
      throw ApiError.badRequest("Email is already verified");
    }

    // Check resend cooldown using Redis
    const redis = getRedisSafe();
    const cooldownKey = `verification_cooldown:${userId.toString()}`;

    if (redis) {
      const cooldownExists = await redis.exists(cooldownKey);
      if (cooldownExists) {
        const ttl = await redis.ttl(cooldownKey);
        throw ApiError.tooManyRequests(
          `Please wait ${ttl} seconds before requesting a new verification email`
        );
      }
    }

    // Invalidate any existing unused tokens for this user
    await VerificationToken.updateMany(
      { userId, type: "email-verification", usedAt: null },
      { $set: { usedAt: new Date() } }
    );

    // Generate secure token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const expiryHours = env.EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    await VerificationToken.create({
      userId,
      token: tokenHash,
      type: "email-verification",
      expiresAt,
    });

    // Build verification URL
    const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;

    // Send email
    const emailSent = await EmailService.sendVerificationEmail(
      user.email,
      user.name,
      verificationUrl,
      expiryHours
    );

    if (!emailSent) {
      logger.warn("Verification email could not be sent", {
        userId: userId.toString(),
        email: user.email,
      });
    }

    // Set cooldown in Redis
    if (redis) {
      const cooldownMinutes = env.EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES;
      await redis.set(cooldownKey, "1", {
        ex: cooldownMinutes * 60,
      });
    }

    // Audit log
    if (req) {
      await SecurityService.recordAuditLog({
        userId,
        action: "VERIFICATION_EMAIL_SENT",
        entityType: "User",
        entityId: userId.toString(),
        req,
      });
    }
  }

  /**
   * Verify email using the token from the email link.
   */
  static async verifyEmail(rawToken: string, req?: Request): Promise<{ email: string; name: string }> {
    if (!rawToken || rawToken.trim().length === 0) {
      throw ApiError.badRequest("Verification token is required");
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const verificationToken = await VerificationToken.findOne({
      token: tokenHash,
      type: "email-verification",
      usedAt: null,
    });

    if (!verificationToken) {
      throw ApiError.badRequest("Invalid or expired verification token");
    }

    // Check expiry
    if (verificationToken.expiresAt < new Date()) {
      throw ApiError.badRequest("Verification token has expired. Please request a new one.");
    }

    // Mark token as used
    verificationToken.usedAt = new Date();
    await verificationToken.save();

    // Verify the user's email
    const user = await User.findById(verificationToken.userId);

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    if (user.isEmailVerified) {
      return { email: user.email, name: user.name };
    }

    user.isEmailVerified = true;
    await user.save();

    // Send welcome email
    const dashboardUrl = `${env.FRONTEND_URL}/dashboard`;
    await EmailService.sendWelcomeEmail(user.email, user.name, dashboardUrl);

    // Audit log
    if (req) {
      await SecurityService.recordAuditLog({
        userId: user._id,
        action: "EMAIL_VERIFIED",
        entityType: "User",
        entityId: user._id.toString(),
        req,
      });
    }

    logger.info("Email verified successfully", {
      userId: user._id.toString(),
      email: user.email,
    });

    return { email: user.email, name: user.name };
  }

  /**
   * Resend verification email (with cooldown protection).
   */
  static async resendVerificationEmail(email: string, req: Request): Promise<void> {
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // Do not reveal whether email exists (security best practice)
      return;
    }

    if (user.isEmailVerified) {
      throw ApiError.badRequest("This email is already verified. Please login.");
    }

    await this.sendEmailVerification(user._id, req);
  }
}