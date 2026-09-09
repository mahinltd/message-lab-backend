import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { User } from "../models/User";
import { ApiError } from "../utils/ApiError";

/**
 * Get current authenticated user profile.
 * Used by the frontend to restore user session on page reload.
 */
export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized("Authentication required");
  }

  const user = await User.findById(req.user.userId).select(
    "name email mobile role isEmailVerified isMobileVerified profilePicture createdAt lastLoginAt"
  );

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile || null,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isMobileVerified: user.isMobileVerified,
        profilePicture: user.profilePicture || null,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt || null,
      },
    },
  });
});