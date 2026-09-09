import crypto from "crypto";
import mongoose from "mongoose";
import QRCode from "qrcode";
import { Device, IDevice } from "../models/Device";
import { DevicePairingCode } from "../models/DevicePairingCode";
import { ApiError } from "../utils/ApiError";
import { SecurityService } from "./security.service";
import { EmailService } from "./email.service";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { Request } from "express";
import { PairDeviceInput, HeartbeatInput } from "../validators/device.validator";

const MAX_DEVICES_PER_USER = 1;

export interface PairingCodeResult {
  code: string;
  expiresAt: Date;
  qrCodeDataUrl: string;
}

export class DeviceService {
  /**
   * Generate a 6-digit pairing code and QR code for the user.
   * Invalidates any previous unused codes.
   */
  static async generatePairingCode(
    userId: mongoose.Types.ObjectId,
    deviceName: string,
    req: Request
  ): Promise<PairingCodeResult> {
    // Check device limit
    const activeDeviceCount = await Device.countDocuments({
      userId,
      status: { $in: ["active", "offline"] },
    });

    if (activeDeviceCount >= MAX_DEVICES_PER_USER) {
      throw ApiError.forbidden(
        `Device limit reached. Maximum ${MAX_DEVICES_PER_USER} device(s) allowed on your current plan. Please disconnect an existing device first.`
      );
    }

    // Invalidate previous unused codes
    await DevicePairingCode.updateMany(
      { userId, usedAt: null },
      { $set: { usedAt: new Date() } }
    );

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await DevicePairingCode.create({
      userId,
      code,
      expiresAt,
    });

    // Generate QR code containing pairing data
    const qrPayload = JSON.stringify({
      type: "MESSAGELAB_PAIRING",
      code,
      userId: userId.toString(),
      deviceName,
      expiresAt: expiresAt.toISOString(),
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 300,
      margin: 2,
      color: {
        dark: "#1a1a2e",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });

    await SecurityService.recordAuditLog({
      userId,
      action: "DEVICE_PAIRING_CODE_GENERATED",
      entityType: "Device",
      req,
      metadata: { deviceName },
    });

    return { code, expiresAt, qrCodeDataUrl };
  }

  /**
   * Verify pairing code and register the device.
   * Returns a raw device token (shown only once to the app).
   */
  static async pairDevice(
    input: PairDeviceInput,
    req: Request
  ): Promise<{
    deviceToken: string;
    deviceId: string;
    userId: string;
    deviceName: string;
  }> {
    const pairingRecord = await DevicePairingCode.findOne({
      code: input.pairingCode,
      usedAt: null,
    });

    if (!pairingRecord) {
      await SecurityService.recordSecurityEvent({
        eventType: "INVALID_DEVICE_PAIRING_CODE",
        severity: "medium",
        req,
        description: `Invalid pairing code attempt: ${input.pairingCode}`,
      });

      throw ApiError.badRequest("Invalid pairing code");
    }

    if (pairingRecord.expiresAt < new Date()) {
      throw ApiError.badRequest(
        "Pairing code has expired. Please generate a new one."
      );
    }

    // Check device limit for the pairing code owner
    const activeDeviceCount = await Device.countDocuments({
      userId: pairingRecord.userId,
      status: { $in: ["active", "offline"] },
    });

    if (activeDeviceCount >= MAX_DEVICES_PER_USER) {
      throw ApiError.forbidden(
        "Device limit reached for this account. Please disconnect an existing device first."
      );
    }

    // Generate device token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // Create device record
    const device: IDevice = await Device.create({
      userId: pairingRecord.userId,
      deviceName: input.deviceName,
      deviceModel: input.deviceModel || undefined,
      androidVersion: input.androidVersion || undefined,
      appVersion: input.appVersion || undefined,
      deviceTokenHash: tokenHash,
      status: "active",
      connectedAt: new Date(),
      lastSeenAt: new Date(),
      lastHeartbeat: {
        lastSeenAt: new Date(),
      },
    });

    // Mark pairing code as used
    pairingRecord.usedAt = new Date();
    pairingRecord.deviceId = device._id;
    await pairingRecord.save();

    // Audit log
    await SecurityService.recordAuditLog({
      userId: pairingRecord.userId,
      action: "DEVICE_CONNECTED",
      entityType: "Device",
      entityId: device._id.toString(),
      req,
      metadata: {
        deviceName: input.deviceName,
        deviceModel: input.deviceModel,
        androidVersion: input.androidVersion,
      },
    });

    // Send device connection email notification
    const UserModel = mongoose.model("User");
    const user = await UserModel.findById(pairingRecord.userId);
    if (user) {
      await EmailService.sendDeviceAlertEmail(
        user.email,
        user.name,
        "connected",
        input.deviceName,
        `${env.FRONTEND_URL}/dashboard/devices`,
        req.ip
      );
    }

    logger.info("Device connected successfully", {
      userId: pairingRecord.userId.toString(),
      deviceId: device._id.toString(),
      deviceName: input.deviceName,
    });

    return {
      deviceToken: rawToken,
      deviceId: device._id.toString(),
      userId: pairingRecord.userId.toString(),
      deviceName: device.deviceName,
    };
  }

  /**
   * Process heartbeat from the Android device.
   */
  static async processHeartbeat(
    deviceId: string,
    input: HeartbeatInput
  ): Promise<{ status: string }> {
    const now = new Date();

    const device = await Device.findByIdAndUpdate(
      deviceId,
      {
        lastSeenAt: now,
        "lastHeartbeat.batteryLevel": input.batteryLevel,
        "lastHeartbeat.isCharging": input.isCharging,
        "lastHeartbeat.networkType": input.networkType,
        "lastHeartbeat.hasSim": input.hasSim,
        "lastHeartbeat.smsPermissionGranted": input.smsPermissionGranted,
        "lastHeartbeat.isSmsCapable": input.isSmsCapable,
        "lastHeartbeat.appVersion": input.appVersion,
        "lastHeartbeat.lastSeenAt": now,
        status: "active",
      },
      { new: true }
    );

    if (!device) {
      throw ApiError.notFound("Device not found");
    }

    return { status: device.status };
  }

  /**
   * Disconnect a device (user-initiated).
   */
  static async disconnectDevice(
    userId: string,
    deviceId: string,
    req: Request
  ): Promise<void> {
    const device = await Device.findOne({
      _id: deviceId,
      userId,
    });

    if (!device) {
      throw ApiError.notFound(
        "Device not found or does not belong to this account"
      );
    }

    device.status = "disabled";
    device.disconnectedAt = new Date();
    device.disabledReason = "Disconnected by user";
    await device.save();

    await SecurityService.recordAuditLog({
      userId: new mongoose.Types.ObjectId(userId),
      action: "DEVICE_DISCONNECTED",
      entityType: "Device",
      entityId: device._id.toString(),
      req,
      metadata: { deviceName: device.deviceName },
    });

    logger.info("Device disconnected", {
      userId,
      deviceId,
      deviceName: device.deviceName,
    });
  }

  /**
   * Get all devices for a user.
   */
  static async getUserDevices(userId: string): Promise<IDevice[]> {
    return Device.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  /**
   * Get a single device by ID (with ownership check).
   */
  static async getDeviceById(
    userId: string,
    deviceId: string
  ): Promise<IDevice | null> {
    return Device.findOne({ _id: deviceId, userId }).lean();
  }

  /**
   * Mark stale devices as offline.
   * Devices without heartbeat for more than 5 minutes are considered offline.
   */
  static async markStaleDevicesOffline(): Promise<number> {
    const threshold = new Date(Date.now() - 5 * 60 * 1000);

    const result = await Device.updateMany(
      {
        status: "active",
        lastSeenAt: { $lt: threshold },
      },
      {
        $set: { status: "offline" },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info("Marked stale devices as offline", {
        count: result.modifiedCount,
      });
    }

    return result.modifiedCount;
  }
}