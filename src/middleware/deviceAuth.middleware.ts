import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { Device } from "../models/Device";
import { ApiError } from "../utils/ApiError";
import { getEffectiveDeviceStatus } from "../services/device.service";

/**
 * Device authentication middleware.
 * Validates the device token sent in the Authorization header.
 * Expected format: Authorization: DeviceToken <token>
 */
export const authenticateDevice = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("DeviceToken ")) {
      throw ApiError.unauthorized("Device token is required");
    }

    const rawToken = authHeader.split(" ")[1];

    if (!rawToken || rawToken.trim().length === 0) {
      throw ApiError.unauthorized("Device token is required");
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const device = await Device.findOne({ deviceTokenHash: tokenHash });

    if (!device) {
      throw ApiError.unauthorized("Invalid device token");
    }

    const status = getEffectiveDeviceStatus(device);

    const isGatewayEnable = req.path === "/gateway/enable";
    if (!isGatewayEnable && (status === "disabled" || status === "suspended")) {
      throw ApiError.forbidden(
        `Device is ${status}. Please reconnect or contact support.`
      );
    }

    // Attach device to request (type-safe via express.d.ts)
    req.device = {
      deviceId: device._id.toString(),
      userId: device.userId.toString(),
      deviceName: device.deviceName,
      status,
      gatewayState: device.gatewayState ?? "on",
    };

    next();
  } catch (error) {
    next(error);
  }
};