import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { User } from "../models/User";
import { Device } from "../models/Device";
import { Subscription } from "../models/Subscription";
import { PaymentSubmission } from "../models/PaymentSubmission";
import { AuditLog } from "../models/AuditLog";
import { ApiError } from "../utils/ApiError";
import { SecurityService } from "../services/security.service";
import { EmailService } from "../services/email.service";
import { env } from "../config/env";

/**
 * Validation schemas for admin user operations.
 */
const updateRoleSchema = z.object({
  role: z.enum(["user", "admin"], {
    message: "Role must be 'user' or 'admin'",
  }),
});

const updateAccountStatusSchema = z.object({
  isDisabled: z.boolean(),
  reason: z.string().max(500).optional().or(z.literal("")),
});

/**
 * Get all users with pagination, search, and filters.
 * GET /api/v1/admin/users
 */
export const getAllUsers = asyncHandler(
  async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const search = (req.query.search as string)?.trim() || "";
    const role = req.query.role as string | undefined;
    const isVerified = req.query.isVerified as string | undefined;
    const isDisabled = req.query.isDisabled as string | undefined;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as string) === "asc" ? 1 : -1;

    // Build filter
    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    if (role && ["user", "admin"].includes(role)) {
      filter.role = role;
    }

    if (isVerified === "true") {
      filter.isEmailVerified = true;
    } else if (isVerified === "false") {
      filter.isEmailVerified = false;
    }

    if (isDisabled === "true") {
      filter.isAccountDisabled = true;
    } else if (isDisabled === "false") {
      filter.isAccountDisabled = false;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .select(
          "name email mobile role isEmailVerified isMobileVerified isAccountDisabled profilePicture createdAt lastLoginAt"
        )
        .lean(),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }
);

/**
 * Get detailed information about a specific user.
 * Includes devices, subscriptions, payments, and recent audit logs.
 * GET /api/v1/admin/users/:userId
 */
export const getUserDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = String(req.params.userId);

    const user = await User.findById(userId)
      .select("-passwordHash")
      .lean();

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    // Fetch related data in parallel
    const [devices, subscriptions, payments, recentAuditLogs] =
      await Promise.all([
        Device.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        Subscription.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        PaymentSubmission.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        AuditLog.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
      ]);

    res.status(200).json({
      success: true,
      data: {
        user,
        devices,
        subscriptions,
        payments,
        recentAuditLogs,
      },
    });
  }
);

/**
 * Update user role (user <-> admin).
 * PATCH /api/v1/admin/users/:userId/role
 */
export const updateUserRole = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const targetUserId = String(req.params.userId);
    const { role } = updateRoleSchema.parse(req.body);

    // Prevent admin from changing their own role
    if (req.user.userId === targetUserId) {
      throw ApiError.badRequest(
        "You cannot change your own role. Please ask another admin."
      );
    }

    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      throw ApiError.notFound("User not found");
    }

    const previousRole = targetUser.role;
    targetUser.role = role;
    await targetUser.save();

    // Audit log
    await SecurityService.recordAuditLog({
      userId: req.user.userId as any,
      action: "USER_ROLE_CHANGED",
      entityType: "User",
      entityId: targetUserId,
      req,
      metadata: {
        targetEmail: targetUser.email,
        previousRole,
        newRole: role,
      },
    });

    // Notify the user about role change
    await EmailService.sendAccountUpdateEmail(
      targetUser.email,
      targetUser.name,
      "Role Changed",
      `Your account role has been changed from "${previousRole}" to "${role}".`,
      req.ip
    );

    res.status(200).json({
      success: true,
      message: `User role updated to "${role}"`,
      data: {
        userId: targetUserId,
        email: targetUser.email,
        previousRole,
        newRole: role,
      },
    });
  }
);

/**
 * Enable or disable a user account.
 * PATCH /api/v1/admin/users/:userId/status
 */
export const updateUserStatus = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const targetUserId = String(req.params.userId);
    const { isDisabled, reason } = updateAccountStatusSchema.parse(req.body);

    // Prevent admin from disabling their own account
    if (req.user.userId === targetUserId) {
      throw ApiError.badRequest(
        "You cannot disable your own account."
      );
    }

    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      throw ApiError.notFound("User not found");
    }

    targetUser.isAccountDisabled = isDisabled;
    await targetUser.save();

    // Audit log
    await SecurityService.recordAuditLog({
      userId: req.user.userId as any,
      action: isDisabled ? "USER_ACCOUNT_DISABLED" : "USER_ACCOUNT_ENABLED",
      entityType: "User",
      entityId: targetUserId,
      req,
      metadata: {
        targetEmail: targetUser.email,
        reason: reason || "No reason provided",
      },
    });

    // Notify the user
    const statusText = isDisabled ? "disabled" : "re-enabled";
    await EmailService.sendAccountUpdateEmail(
      targetUser.email,
      targetUser.name,
      isDisabled ? "Account Disabled" : "Account Re-enabled",
      `Your account has been ${statusText}. ${
        reason ? `Reason: ${reason}` : ""
      }`,
      req.ip
    );

    res.status(200).json({
      success: true,
      message: `User account ${isDisabled ? "disabled" : "enabled"} successfully`,
      data: {
        userId: targetUserId,
        email: targetUser.email,
        isAccountDisabled: isDisabled,
      },
    });
  }
);

/**
 * Manually verify a user's email (admin override).
 * POST /api/v1/admin/users/:userId/verify-email
 */
export const verifyUserEmail = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const targetUserId = String(req.params.userId);

    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      throw ApiError.notFound("User not found");
    }

    if (targetUser.isEmailVerified) {
      throw ApiError.badRequest("User email is already verified");
    }

    targetUser.isEmailVerified = true;
    await targetUser.save();

    // Audit log
    await SecurityService.recordAuditLog({
      userId: req.user.userId as any,
      action: "EMAIL_VERIFIED_BY_ADMIN",
      entityType: "User",
      entityId: targetUserId,
      req,
      metadata: { targetEmail: targetUser.email },
    });

    await EmailService.sendWelcomeEmail(
      targetUser.email,
      targetUser.name,
      `${env.FRONTEND_URL}/dashboard`
    );

    res.status(200).json({
      success: true,
      message: "User email verified successfully",
      data: {
        userId: targetUserId,
        email: targetUser.email,
      },
    });
  }
);

/**
 * Get user statistics for admin dashboard.
 * GET /api/v1/admin/users/stats
 */
export const getUserStats = asyncHandler(
  async (_req: Request, res: Response) => {
    const [
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      disabledUsers,
      adminUsers,
      usersLast24h,
      usersLast7d,
      usersLast30d,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isEmailVerified: true }),
      User.countDocuments({ isEmailVerified: false }),
      User.countDocuments({ isAccountDisabled: true }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      User.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      User.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    // Active subscriptions count
    const activeSubscriptions = await Subscription.countDocuments({
      status: "active",
      expiresAt: { $gt: new Date() },
    });

    // Connected devices count
    const connectedDevices = await Device.countDocuments({
      status: "active",
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        verifiedUsers,
        unverifiedUsers,
        disabledUsers,
        adminUsers,
        activeSubscriptions,
        connectedDevices,
        registrationTrend: {
          last24h: usersLast24h,
          last7d: usersLast7d,
          last30d: usersLast30d,
        },
      },
    });
  }
);

/**
 * Get recent registrations.
 * GET /api/v1/admin/users/recent
 */
export const getRecentRegistrations = asyncHandler(
  async (_req: Request, res: Response) => {
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select(
        "name email mobile isEmailVerified isAccountDisabled createdAt"
      )
      .lean();

    res.status(200).json({
      success: true,
      data: {
        users,
      },
    });
  }
);