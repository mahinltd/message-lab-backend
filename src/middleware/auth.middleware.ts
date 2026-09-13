import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";
import { User } from "../models/User";

/**
 * Authentication middleware.
 * Verifies the Bearer access token from the Authorization header
 * and attaches the authenticated user to req.user.
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Access token is required");
    }

    const token = authHeader.split(" ")[1];

    if (!token || token.trim().length === 0) {
      throw ApiError.unauthorized("Access token is required");
    }

    const payload = verifyAccessToken(token);

    // Verify user still exists and is not disabled
    const user = await User.findById(payload.userId).select(
      "_id role isAccountDisabled"
    );

    if (!user) {
      throw ApiError.unauthorized("User no longer exists");
    }

    if (user.isAccountDisabled) {
      throw ApiError.forbidden("Your account has been disabled");
    }

    // The database is authoritative for authorization. The token only proves
    // identity; its role may be stale after an admin promotion or demotion.
    req.user = {
      userId: user._id.toString(),
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};