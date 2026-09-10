import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { DeviceService } from "../services/device.service";
import { generatePairingCodeSchema } from "../validators/device.validator";
import { ApiError } from "../utils/ApiError";

/**
 * Generate a new device pairing code with QR code.
 * POST /api/v1/devices/pairing-code
 */
export const generatePairingCode = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const { deviceName } = generatePairingCodeSchema.parse(req.body);
    const userId = req.user.userId;

    const result = await DeviceService.generatePairingCode(
      userId as any,
      deviceName,
      req
    );

    res.status(201).json({
      success: true,
      message:
        "Pairing code generated. Scan the QR code or enter the code in the Messages Lab Android app.",
      data: {
        code: result.code,
        qrCodeDataUrl: result.qrCodeDataUrl,
        expiresAt: result.expiresAt,
        expiresInMinutes: 10,
      },
    });
  }
);

/**
 * Get all devices for the current user.
 * GET /api/v1/devices
 */
export const getMyDevices = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const devices = await DeviceService.getUserDevices(req.user.userId);
    const dashboardDevices = devices.map((device) => ({
      ...device,
      isOnline: device.status === "active",
    }));

    res.status(200).json({
      success: true,
      data: {
        devices: dashboardDevices,
        total: dashboardDevices.length,
      },
    });
  }
);

/**
 * Get a specific device.
 * GET /api/v1/devices/:deviceId
 */
export const getDeviceById = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const deviceId = String(req.params.deviceId);

    const device = await DeviceService.getDeviceById(
      req.user.userId,
      deviceId
    );

    if (!device) {
      throw ApiError.notFound("Device not found");
    }

    res.status(200).json({
      success: true,
      data: { device: { ...device, isOnline: device.status === "active" } },
    });
  }
);

/**
 * Disconnect a device.
 * DELETE /api/v1/devices/:deviceId
 */
export const disconnectDevice = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const deviceId = String(req.params.deviceId);

    await DeviceService.disconnectDevice(req.user.userId, deviceId, req);

    res.status(200).json({
      success: true,
      message: "Device disconnected successfully",
    });
  }
);