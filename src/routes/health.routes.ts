import { Router } from "express";
import { env } from "../config/env";
import { getDatabaseStatus } from "../lib/mongodb";
import { checkRedisHealth } from "../lib/redis";
import { isResendConfigured } from "../lib/resend";
import { isCloudinaryConfigured } from "../lib/cloudinary";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const redisStatus = await checkRedisHealth();

    res.status(200).json({
      success: true,
      data: {
        service: "messages-lab-backend",
        status: "ok",
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
        dependencies: {
          mongodb: getDatabaseStatus(),
          redis: redisStatus,
          email: isResendConfigured() ? "configured" : "not_configured",
          cloudinary: isCloudinaryConfigured() ? "configured" : "not_configured",
        },
      },
    });
  })
);

export default router;