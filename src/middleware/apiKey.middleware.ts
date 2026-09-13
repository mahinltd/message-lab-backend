import crypto from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { ApiCredential } from "../models/ApiCredential";
import { User } from "../models/User";
import { ApiError } from "../utils/ApiError";

export const authenticateApiKey = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawKey = req.header("x-api-key");
    if (!rawKey || rawKey.length < 32) throw ApiError.unauthorized("API key is required");
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const credential = await ApiCredential.findOne({ keyHash, isActive: true, revokedAt: null });
    if (!credential) throw ApiError.unauthorized("Invalid API key");
    const user = await User.findById(credential.userId).select("_id role isAccountDisabled");
    if (!user) throw ApiError.unauthorized("Invalid API key");
    if (user.isAccountDisabled) throw ApiError.forbidden("Your account has been disabled");
    credential.lastUsedAt = new Date();
    await credential.save();
    (req as Request & { apiClient?: { credentialId: string; userId: string; permissions: string[] } }).apiClient = {
      credentialId: credential._id.toString(),
      userId: credential.userId.toString(),
      permissions: credential.permissions,
    };
    next();
  } catch (error) {
    next(error);
  }
};