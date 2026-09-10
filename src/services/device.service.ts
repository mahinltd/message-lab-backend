import crypto from "crypto";
import mongoose from "mongoose";
import QRCode from "qrcode";
import { Device, IDevice, DeviceStatus } from "../models/Device";
import { DevicePairingCode } from "../models/DevicePairingCode";
import { IncomingSms } from "../models/IncomingSms";
import { ApiError } from "../utils/ApiError";
import { SecurityService } from "./security.service";
import { EmailService } from "./email.service";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { Request } from "express";
import { PairDeviceInput, HeartbeatInput } from "../validators/device.validator";

const MAX_DEVICES_PER_USER = 1;
const DEVICE_OFFLINE_TIMEOUT_MS = 5 * 60 * 1000;

export function getEffectiveDeviceStatus(
  device: Pick<IDevice, "status" | "lastSeenAt">
): DeviceStatus {
  if (
    device.status === "active" &&
    (!device.lastSeenAt ||
      device.lastSeenAt.getTime() < Date.now() - DEVICE_OFFLINE_TIMEOUT_MS)
  ) {
    return "offline";
  }

  return device.status;
}

export interface PairingCodeResult {
  code: string;
  expiresAt: Date;
  qrCodeDataUrl: string;
}

export interface PairDeviceResult {
  deviceToken: string;
  deviceId: string;
  userId: string;
  deviceName: string;
  alreadyPaired: boolean;
  resumed?: boolean;
  status?: DeviceStatus;
  gatewayState?: "on" | "off";
}

export interface ResumeCodeResult {
  code: string;
  expiresAt: Date;
  qrCodeDataUrl: string;
}

function generateDeviceToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return { rawToken, tokenHash };
}

export class DeviceService {
  private static async buildQrCode(
    code: string,
    userId: mongoose.Types.ObjectId,
    deviceName: string,
    expiresAt: Date,
    targetDeviceId?: string
  ): Promise<string> {
    const qrPayload = JSON.stringify({
      type: "MESSAGELAB_PAIRING",
      code,
      userId: userId.toString(),
      deviceName,
      expiresAt: expiresAt.toISOString(),
      ...(targetDeviceId ? { targetDeviceId } : {}),
    });

    return QRCode.toDataURL(qrPayload, {
      width: 300,
      margin: 2,
      color: { dark: "#1a1a2e", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  }

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
      status: { $in: ["active", "offline", "paused"] },
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
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await DevicePairingCode.create({
      userId,
      code,
      expiresAt,
    });

    const qrCodeDataUrl = await this.buildQrCode(
      code,
      userId,
      deviceName,
      expiresAt
    );

    await SecurityService.recordAuditLog({
      userId,
      action: "DEVICE_PAIRING_CODE_GENERATED",
      entityType: "Device",
      req,
      metadata: { deviceName },
    });

    return { code, expiresAt, qrCodeDataUrl };
  }

  static async generateResumeCode(
    userId: string,
    deviceId: string,
    req: Request
  ): Promise<ResumeCodeResult> {
    const device = await Device.findOne({ _id: deviceId, userId });
    if (!device) throw ApiError.notFound("Device not found");
    if (device.status !== "disabled") {
      throw ApiError.conflict("Only disabled devices can be resumed");
    }

    await DevicePairingCode.updateMany(
      { userId, targetDeviceId: device._id, usedAt: null },
      { $set: { usedAt: new Date() } }
    );

    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await DevicePairingCode.create({
      userId,
      code,
      targetDeviceId: device._id,
      expiresAt,
    });

    const qrCodeDataUrl = await this.buildQrCode(
      code,
      new mongoose.Types.ObjectId(userId),
      device.deviceName,
      expiresAt,
      device._id.toString()
    );

    await SecurityService.recordAuditLog({
      userId: new mongoose.Types.ObjectId(userId),
      action: "DEVICE_RESUME_CODE_GENERATED",
      entityType: "Device",
      entityId: device._id.toString(),
      req,
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
  ): Promise<PairDeviceResult> {
    const now = new Date();

    const replayDevice = async (device: IDevice): Promise<PairDeviceResult> => {
      const { rawToken, tokenHash } = generateDeviceToken();
      device.deviceTokenHash = tokenHash;
      device.clientDeviceId = input.clientDeviceId;
      device.deviceName = input.deviceName;
      device.deviceModel = input.deviceModel || null;
      device.androidVersion = input.androidVersion || null;
      device.appVersion = input.appVersion || null;
      device.pairingIdempotencyKey = input.idempotencyKey || null;
      device.status = "active";
      device.gatewayState = "on";
      device.lastSeenAt = now;
      device.disconnectedAt = null;
      await device.save();

      logger.info("Idempotent device pairing replay returned existing device", {
        deviceId: device._id.toString(),
        userId: device.userId.toString(),
        idempotencyKey: input.idempotencyKey,
      });

      return {
        deviceToken: rawToken,
        deviceId: device._id.toString(),
        userId: device.userId.toString(),
        deviceName: device.deviceName,
        alreadyPaired: true,
      };
    };

    if (input.idempotencyKey) {
      const existingDevice = await Device.findOne({
        pairingIdempotencyKey: input.idempotencyKey,
      });

      if (existingDevice) {
        return replayDevice(existingDevice);
      }
    }

    const pairingRecord = await DevicePairingCode.findOneAndUpdate(
      {
        code: input.pairingCode,
        usedAt: null,
        expiresAt: { $gt: now },
      },
      {
        $set: {
          usedAt: now,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      },
      { new: true }
    );

    if (!pairingRecord) {
      const existingCode = await DevicePairingCode.findOne({
        code: input.pairingCode,
      });

      if (!existingCode) {
        await SecurityService.recordSecurityEvent({
          eventType: "INVALID_DEVICE_PAIRING_CODE",
          severity: "medium",
          req,
          description: `Invalid pairing code attempt: ${input.pairingCode}`,
        });

        throw ApiError.badRequest("Invalid pairing code");
      }

      if (existingCode.expiresAt <= now) {
        throw ApiError.badRequest(
          "Pairing code has expired. Please generate a new one."
        );
      }

      if (
        input.idempotencyKey &&
        existingCode.usedAt &&
        existingCode.idempotencyKey === input.idempotencyKey
      ) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const device = await Device.findOne({
            pairingIdempotencyKey: input.idempotencyKey,
          });

          if (device) {
            return replayDevice(device);
          }

          if (attempt < 4) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
      }

      if (
        existingCode.usedAt &&
        input.idempotencyKey &&
        existingCode.idempotencyKey !== input.idempotencyKey
      ) {
        throw ApiError.conflict("Pairing code has already been used");
      }

      throw ApiError.badRequest("Invalid pairing code");
    }

    let device: IDevice | null = null;

    try {
      const { rawToken, tokenHash } = generateDeviceToken();

      if (pairingRecord.targetDeviceId) {
        const targetDevice = await Device.findOne({
          _id: pairingRecord.targetDeviceId,
          userId: pairingRecord.userId,
        });
        if (!targetDevice) throw ApiError.notFound("Resume target device not found");
        if (targetDevice.status === "suspended") {
          throw ApiError.forbidden("Device suspended by administrator");
        }

        targetDevice.deviceTokenHash = tokenHash;
        targetDevice.deviceName = input.deviceName;
        targetDevice.deviceModel = input.deviceModel || null;
        targetDevice.androidVersion = input.androidVersion || null;
        targetDevice.appVersion = input.appVersion || null;
        targetDevice.status = "active";
        targetDevice.gatewayState = "on";
        targetDevice.connectedAt = now;
        targetDevice.lastSeenAt = now;
        targetDevice.disconnectedAt = null;
        targetDevice.disabledReason = null;
        targetDevice.lastHeartbeat = {
          ...(targetDevice.lastHeartbeat || {}),
          lastSeenAt: now,
        };
        await targetDevice.save();

        await SecurityService.recordAuditLog({
          userId: pairingRecord.userId,
          action: "DEVICE_RECONNECTED",
          entityType: "Device",
          entityId: targetDevice._id.toString(),
          req,
        });

        return {
          deviceToken: rawToken,
          deviceId: targetDevice._id.toString(),
          userId: targetDevice.userId.toString(),
          deviceName: targetDevice.deviceName,
          alreadyPaired: true,
          resumed: true,
        };
      }

      const existingDevice = await Device.findOne({
        userId: pairingRecord.userId,
        clientDeviceId: input.clientDeviceId,
      });

      if (existingDevice) {
        if (existingDevice.status === "suspended") {
          throw ApiError.forbidden(
            "Device is suspended. Please contact support."
          );
        }

        existingDevice.deviceTokenHash = tokenHash;
        existingDevice.deviceName = input.deviceName;
        existingDevice.deviceModel = input.deviceModel || null;
        existingDevice.androidVersion = input.androidVersion || null;
        existingDevice.appVersion = input.appVersion || null;
        existingDevice.pairingIdempotencyKey = input.idempotencyKey || null;
        existingDevice.status = "active";
        existingDevice.gatewayState = "on";
        existingDevice.connectedAt = now;
        existingDevice.lastSeenAt = now;
        existingDevice.disconnectedAt = null;
        existingDevice.disabledReason = null;
        await existingDevice.save();

        pairingRecord.deviceId = existingDevice._id;
        await pairingRecord.save();

        return {
          deviceToken: rawToken,
          deviceId: existingDevice._id.toString(),
          userId: pairingRecord.userId.toString(),
          deviceName: existingDevice.deviceName,
          alreadyPaired: true,
        };
      }

      // Check device limit only after this request atomically claims the code.
      const activeDeviceCount = await Device.countDocuments({
        userId: pairingRecord.userId,
        status: { $in: ["active", "offline", "paused"] },
      });

      if (activeDeviceCount >= MAX_DEVICES_PER_USER) {
        throw ApiError.forbidden(
          "Device limit reached for this account. Please disconnect an existing device first."
        );
      }

      device = await Device.create({
        userId: pairingRecord.userId,
        clientDeviceId: input.clientDeviceId,
        deviceName: input.deviceName,
        deviceModel: input.deviceModel || undefined,
        androidVersion: input.androidVersion || undefined,
        appVersion: input.appVersion || undefined,
        pairingIdempotencyKey: input.idempotencyKey || undefined,
        deviceTokenHash: tokenHash,
        status: "active",
        gatewayState: "on",
        connectedAt: now,
        lastSeenAt: now,
        lastHeartbeat: {
          lastSeenAt: now,
        },
      });

      pairingRecord.deviceId = device._id;
      await pairingRecord.save();

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
          idempotencyKey: input.idempotencyKey,
        },
      });

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
        alreadyPaired: false,
      };
    } catch (error) {
      await DevicePairingCode.updateOne(
        {
          _id: pairingRecord._id,
          usedAt: now,
          idempotencyKey: input.idempotencyKey ?? null,
        },
        {
          $set: { usedAt: null, idempotencyKey: null },
          $unset: { deviceId: 1 },
        }
      );

      if (device) {
        await Device.deleteOne({ _id: device._id });
      }

      throw error;
    }
  }

  /**
   * Process heartbeat from the Android device.
   */
  static async processHeartbeat(
    deviceId: string,
    input: HeartbeatInput
  ): Promise<{ status: string }> {
    const now = new Date();

    const currentDevice = await Device.findById(deviceId);
    if (!currentDevice) throw ApiError.notFound("Device not found");
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
        status: currentDevice.gatewayState === "off" ? "paused" : "active",
      },
      { new: true }
    );

    if (!device) {
      throw ApiError.notFound("Device not found");
    }

    return { status: device.status };
  }

  static async enableGateway(deviceId: string, req: Request): Promise<PairDeviceResult> {
    const device = await Device.findById(deviceId);
    if (!device) throw ApiError.notFound("Device not found");
    if (device.status === "suspended") {
      throw ApiError.forbidden("Device suspended by administrator");
    }
    if (device.status === "disabled") {
      throw ApiError.forbidden(
        "Device was disconnected from the web dashboard. Reconnect using a resume code."
      );
    }

    const { rawToken, tokenHash } = generateDeviceToken();
    const now = new Date();
    device.deviceTokenHash = tokenHash;
    device.gatewayState = "on";
    device.status = "active";
    device.disconnectedAt = null;
    device.disabledReason = null;
    device.lastSeenAt = now;
    device.lastHeartbeat = {
      ...(device.lastHeartbeat || {}),
      lastSeenAt: now,
    };
    await device.save();

    await SecurityService.recordAuditLog({
      userId: device.userId,
      action: "DEVICE_GATEWAY_ENABLED",
      entityType: "Device",
      entityId: device._id.toString(),
      req,
    });

    return {
      deviceToken: rawToken,
      deviceId: device._id.toString(),
      userId: device.userId.toString(),
      deviceName: device.deviceName,
      status: "active",
      alreadyPaired: true,
      gatewayState: "on",
      resumed: true,
    };
  }

  static async disableGateway(deviceId: string, req: Request): Promise<void> {
    const device = await Device.findById(deviceId);
    if (!device) throw ApiError.notFound("Device not found");
    if (device.status === "suspended") {
      throw ApiError.forbidden("Device suspended by administrator");
    }

    device.gatewayState = "off";
    device.status = "paused";
    await device.save();
    await SecurityService.recordAuditLog({
      userId: device.userId,
      action: "DEVICE_GATEWAY_DISABLED",
      entityType: "Device",
      entityId: device._id.toString(),
      req,
    });
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
    device.gatewayState = "off";
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

    const user = await mongoose.model("User").findById(userId);
    if (user) {
      const emailSent = await EmailService.sendDeviceAlertEmail(
        user.email,
        user.name,
        "disconnected",
        device.deviceName,
        `${env.FRONTEND_URL}/dashboard/devices`,
        req.ip
      );

      if (!emailSent) {
        logger.warn("Device disconnection email could not be sent", {
          deviceId,
          userId,
          email: user.email,
        });
      }
    }

    logger.info("Device disconnected", {
      userId,
      deviceId,
      deviceName: device.deviceName,
    });
  }

  static async deleteDisabledDevice(
    userId: string,
    deviceId: string,
    req: Request
  ): Promise<void> {
    const device = await Device.findOne({ _id: deviceId, userId });
    if (!device) throw ApiError.notFound("Device not found");
    if (device.status !== "disabled") {
      throw ApiError.conflict("Only disabled devices can be deleted");
    }

    await IncomingSms.deleteMany({ deviceId: device._id });
    await DevicePairingCode.deleteMany({
      $or: [{ deviceId: device._id }, { targetDeviceId: device._id }],
    });
    await Device.deleteOne({ _id: device._id });
    await SecurityService.recordAuditLog({
      userId: new mongoose.Types.ObjectId(userId),
      action: "DEVICE_DELETED",
      entityType: "Device",
      entityId: deviceId,
      req,
    });
  }

  /**
   * Get all devices for a user.
   */
  static async getUserDevices(userId: string): Promise<IDevice[]> {
    const devices = await Device.find({ userId }).sort({ createdAt: -1 }).lean();
    return devices.map((device) => ({
      ...device,
      gatewayState: device.gatewayState ?? "on",
      status: getEffectiveDeviceStatus(device),
    })) as unknown as IDevice[];
  }

  /**
   * Get a single device by ID (with ownership check).
   */
  static async getDeviceById(
    userId: string,
    deviceId: string
  ): Promise<IDevice | null> {
    const device = await Device.findOne({ _id: deviceId, userId }).lean();
    return device
      ? ({
          ...device,
          gatewayState: device.gatewayState ?? "on",
          status: getEffectiveDeviceStatus(device),
        } as unknown as IDevice)
      : null;
  }

  /**
   * Mark stale devices as offline.
   * Devices without heartbeat for more than 5 minutes are considered offline.
   */
  static async markStaleDevicesOffline(): Promise<number> {
    const threshold = new Date(Date.now() - DEVICE_OFFLINE_TIMEOUT_MS);

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