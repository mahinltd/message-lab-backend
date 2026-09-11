import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AuthService } from "../services/auth.service";
import { PasswordService } from "../services/password.service";
import { User } from "../models/User";
import { comparePassword, hashPassword } from "../utils/password";
import { SecurityService } from "../services/security.service";
import { ApiError } from "../utils/ApiError";
import {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validator";
import { isProduction } from "../config/env";
import { getClientIp } from "../utils/ip";
import { AuthSecurityService } from "../services/authSecurity.service";
import { verifyTurnstile } from "../lib/turnstile";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = registerSchema.parse(req.body);
  const ip = getClientIp(req);
  const state = await AuthSecurityService.getScopedFailureState(
    "register",
    ip,
    validatedData.email
  );
  if (state.captchaRequired) {
    const verification = validatedData.captchaToken
      ? await verifyTurnstile(validatedData.captchaToken, ip)
      : { success: false };
    if (!verification.success) {
      if (validatedData.captchaToken) {
        await AuthSecurityService.recordCaptchaFailure(req, "register", validatedData.email);
      }
      res.status(428).json({
        success: false,
        code: "CAPTCHA_REQUIRED",
        message: "CAPTCHA verification is required.",
      });
      return;
    }
  }

  try {
    const result = await AuthService.register(validatedData, req);
    await AuthSecurityService.resetScopedFailures("register", ip, validatedData.email);

    // Do NOT set refresh token cookie - user must verify email first
    res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email to verify your account.",
      data: {
        user: result.user,
        requiresVerification: result.requiresVerification,
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
      await AuthSecurityService.recordScopedFailure("register", ip, validatedData.email);
    }
    throw error;
  }
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = loginSchema.parse(req.body);
  const ip = getClientIp(req);
  const state = await AuthSecurityService.getLoginFailureState(ip, validatedData.email);

  if (state.locked) {
    await AuthSecurityService.recordLoginLocked(ip, validatedData.email);
    const settings = await AuthSecurityService.getSettings();
    const retryAfterSeconds = Math.ceil(settings.authWindowMs / 1000);
    res.setHeader("Retry-After", retryAfterSeconds);
    res.status(429).json({
      success: false,
      message: "Too many failed login attempts. Please try again later.",
      retryAfterSeconds,
    });
    return;
  }

  if (state.captchaRequired) {
    const verification = validatedData.captchaToken
      ? await verifyTurnstile(validatedData.captchaToken, ip)
      : { success: false };
    if (!verification.success) {
      if (validatedData.captchaToken) {
        await AuthSecurityService.recordCaptchaFailure(req, "login", validatedData.email);
      }
      res.status(428).json({
        success: false,
        code: "CAPTCHA_REQUIRED",
        message: "CAPTCHA verification is required.",
      });
      return;
    }
  }

  try {
    const result = await AuthService.login(validatedData, req);
    await AuthSecurityService.resetLoginFailures(ip, validatedData.email);

    res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      const newState = await AuthSecurityService.recordLoginFailure(
        ip,
        validatedData.email
      );
      res.status(401).json({
        success: false,
        message: error.message,
        failedAttempts: newState.ipFails,
        captchaRequired: newState.captchaRequired,
      });
      return;
    }
    throw error;
  }
});

export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = googleLoginSchema.parse(req.body);
  const result = await AuthService.handleGoogleLogin(idToken, req);

  res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);

  res.status(200).json({
    success: true,
    message: "Google login successful",
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  res.clearCookie("refreshToken", COOKIE_OPTIONS);

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

/**
 * Request password reset email.
 * POST /api/v1/auth/forgot-password
 */
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, captchaToken } = forgotPasswordSchema.parse(req.body);
    const ip = getClientIp(req);
    const accountExists = Boolean(await User.exists({ email }));
    const state = await AuthSecurityService.getScopedFailureState("forgot", ip, email);
    if (state.captchaRequired) {
      const verification = captchaToken
        ? await verifyTurnstile(captchaToken, ip)
        : { success: false };
      if (!verification.success) {
        if (captchaToken) {
          await AuthSecurityService.recordCaptchaFailure(req, "forgot", email);
        }
        res.status(428).json({
          success: false,
          code: "CAPTCHA_REQUIRED",
          message: "CAPTCHA verification is required.",
        });
        return;
      }
    }

    await PasswordService.requestReset(email, req);
    if (accountExists) {
      await AuthSecurityService.resetScopedFailures("forgot", ip, email);
    } else {
      await AuthSecurityService.recordScopedFailure("forgot", ip, email);
    }

    res.status(200).json({
      success: true,
      message:
        "If an account exists with this email, a password reset link has been sent.",
    });
  }
);

/**
 * Reset password with token.
 * POST /api/v1/auth/reset-password
 */
export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    await PasswordService.resetPassword(token, newPassword, req);

    res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now login.",
    });
  }
);

const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  mobile: z
    .string()
    .refine((val) => /^(\+?8801|01)[0-9]{9}$/.test(val.replace(/[\s-]/g, "")), {
      message: "Invalid Bangladeshi mobile number",
    })
    .optional()
    .or(z.literal("")),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * Update current user's profile.
 * PUT /api/v1/auth/profile
 */
export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized("Authentication required");

    const data = updateProfileSchema.parse(req.body);
    const user = await User.findById(req.user.userId);
    if (!user) throw ApiError.notFound("User not found");

    const updates: Record<string, string | null> = {};
    if (data.name) updates.name = data.name;
    if (data.mobile !== undefined) updates.mobile = data.mobile || null;

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest("No fields to update");
    }

    Object.assign(user, updates);
    await user.save();

    await SecurityService.recordAuditLog({
      userId: user._id,
      action: "PROFILE_UPDATED",
      entityType: "User",
      entityId: user._id.toString(),
      req,
      metadata: { fields: Object.keys(updates) },
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          profilePicture: user.profilePicture,
        },
      },
    });
  }
);

/**
 * Change current user's password.
 * PUT /api/v1/auth/change-password
 */
export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized("Authentication required");

    const data = changePasswordSchema.parse(req.body);
    const user = await User.findById(req.user.userId);

    if (!user) throw ApiError.notFound("User not found");
    if (!user.passwordHash || !user.authProviders.local) {
      throw ApiError.badRequest(
        "This account uses Google login. Password cannot be changed here."
      );
    }

    const isValid = await comparePassword(data.currentPassword, user.passwordHash);
    if (!isValid) {
      await SecurityService.recordSecurityEvent({
        eventType: "PASSWORD_CHANGE_FAILED",
        severity: "medium",
        req,
        userId: user._id,
        description: "Incorrect current password during password change attempt",
      });
      throw ApiError.unauthorized("Current password is incorrect");
    }

    user.passwordHash = await hashPassword(data.newPassword);
    await user.save();

    await SecurityService.recordAuditLog({
      userId: user._id,
      action: "PASSWORD_CHANGED",
      entityType: "User",
      entityId: user._id.toString(),
      req,
    });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  }
);