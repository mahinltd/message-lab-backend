import mongoose from "mongoose";
import { Request } from "express";
import { AuditLog } from "../models/AuditLog";
import { SecurityEvent } from "../models/SecurityEvent";
import { getClientIp } from "../utils/ip";
import { logger } from "../utils/logger";

export class SecurityService {
  static async recordAuditLog(params: {
    userId?: string | mongoose.Types.ObjectId;
    action: string;
    entityType: string;
    entityId?: string;
    req?: Request;
    metadata?: Record<string, any>;
  }) {
    try {
      await AuditLog.create({
        userId: params.userId ? new mongoose.Types.ObjectId(params.userId.toString()) : undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        ipAddress: params.req ? getClientIp(params.req) : undefined,
        userAgent: params.req ? params.req.headers["user-agent"] : undefined,
        metadata: params.metadata || {},
      });
    } catch (error) {
      // অডিট লগ ফেইল হলে যেন মেইন অ্যাপ্লিকেশন ক্র্যাশ না করে
      logger.error("Failed to record audit log", error);
    }
  }

  static async recordSecurityEvent(params: {
    eventType: string;
    severity: "low" | "medium" | "high" | "critical";
    req?: Request;
    userId?: string | mongoose.Types.ObjectId;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      await SecurityEvent.create({
        eventType: params.eventType,
        severity: params.severity,
        ipAddress: params.req ? getClientIp(params.req) : undefined,
        userAgent: params.req ? params.req.headers["user-agent"] : undefined,
        userId: params.userId ? new mongoose.Types.ObjectId(params.userId.toString()) : undefined,
        description: params.description,
        metadata: params.metadata || {},
      });
    } catch (error) {
      logger.error("Failed to record security event", error);
    }
  }
}