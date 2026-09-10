import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { DeviceService } from "../services/device.service";
import {
  pairDeviceSchema,
  heartbeatSchema,
} from "../validators/device.validator";
import { ApiError } from "../utils/ApiError";

/**
 * Pair a new device using the 6-digit code.
 * Called by the Android app.
 * POST /api/v1/device-agent/pair
 */
export const pairDevice = asyncHandler(
  async (req: Request, res: Response) => {
    const validatedData = pairDeviceSchema.parse(req.body);

    const result = await DeviceService.pairDevice(validatedData, req);

    res.status(201).json({
      success: true,
      message:
        "Device paired successfully. Store the device token securely.",
      data: {
        deviceToken: result.deviceToken,
        deviceId: result.deviceId,
        userId: result.userId,
        deviceName: result.deviceName,
        alreadyPaired: result.alreadyPaired,
      },
    });
  }
);

/**
 * Send heartbeat from the Android device.
 * POST /api/v1/device-agent/heartbeat
 * Authorization: DeviceToken <token>
 */
export const sendHeartbeat = asyncHandler(
  async (req: Request, res: Response) => {
    const deviceInfo = req.device;

    if (!deviceInfo) {
      throw ApiError.unauthorized("Device authentication required");
    }

    const validatedData = heartbeatSchema.parse(req.body);

    const result = await DeviceService.processHeartbeat(
      deviceInfo.deviceId,
      validatedData
    );

    res.status(200).json({
      success: true,
      message: "Heartbeat received",
      data: {
        status: result.status,
        serverTime: new Date().toISOString(),
      },
    });
  }
);

/**
 * Get device status.
 * GET /api/v1/device-agent/status
 * Authorization: DeviceToken <token>
 */
export const getDeviceStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const deviceInfo = req.device;

    if (!deviceInfo) {
      throw ApiError.unauthorized("Device authentication required");
    }

    res.status(200).json({
      success: true,
      data: {
        deviceId: deviceInfo.deviceId,
        userId: deviceInfo.userId,
        deviceName: deviceInfo.deviceName,
        status: deviceInfo.status,
      },
    });
  }
);

/**
 * Self-disconnect (called by the app).
 * POST /api/v1/device-agent/disconnect
 * Authorization: DeviceToken <token>
 */
export const selfDisconnect = asyncHandler(
  async (req: Request, res: Response) => {
    const deviceInfo = req.device;

    if (!deviceInfo) {
      throw ApiError.unauthorized("Device authentication required");
    }

    await DeviceService.disconnectDevice(
      deviceInfo.userId,
      deviceInfo.deviceId,
      req
    );

    res.status(200).json({
      success: true,
      message: "Device disconnected successfully",
    });
  }
);