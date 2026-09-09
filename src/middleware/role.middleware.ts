import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

type UserRole = "user" | "admin";

/**
 * Role-based authorization middleware.
 * Must be used AFTER the authenticate middleware.
 *
 * Usage:
 *   router.get("/admin-only", authenticate, requireRole("admin"), handler);
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized("Authentication required"));
      return;
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      next(
        ApiError.forbidden(
          "You do not have permission to access this resource"
        )
      );
      return;
    }

    next();
  };
};