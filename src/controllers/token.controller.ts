import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { verifyRefreshToken, signAccessToken, signRefreshToken, TokenPayload } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";
import { User } from "../models/User";
import { SecurityService } from "../services/security.service";
import { isProduction } from "../config/env";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

/**
 * Refresh token endpoint.
 * Reads the refresh token from the HttpOnly cookie,
 * validates it, and issues a new token pair.
 */
export const refreshTokens = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw ApiError.unauthorized("Refresh token is missing. Please login again.");
  }

  const payload = verifyRefreshToken(refreshToken);

  // Verify user still exists and is active
  const user = await User.findById(payload.userId).select(
    "_id name email role isAccountDisabled"
  );

  if (!user) {
    res.clearCookie("refreshToken", COOKIE_OPTIONS);
    throw ApiError.unauthorized("User no longer exists. Please register again.");
  }

  if (user.isAccountDisabled) {
    res.clearCookie("refreshToken", COOKIE_OPTIONS);
    throw ApiError.forbidden("Your account has been disabled");
  }

  // Issue new token pair (rotation)
  const newPayload: TokenPayload = {
    userId: user._id.toString(),
    role: user.role,
  };

  const newAccessToken = signAccessToken(newPayload);
  const newRefreshToken = signRefreshToken(newPayload);

  // Set new refresh token in cookie (rotation)
  res.cookie("refreshToken", newRefreshToken, COOKIE_OPTIONS);

  // Audit log for token refresh
  await SecurityService.recordAuditLog({
    userId: user._id,
    action: "TOKEN_REFRESHED",
    entityType: "User",
    entityId: user._id.toString(),
    req,
  });

  res.status(200).json({
    success: true,
    message: "Tokens refreshed successfully",
    data: {
      accessToken: newAccessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});