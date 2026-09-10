import { z } from "zod";

export const generatePairingCodeSchema = z.object({
  deviceName: z
    .string()
    .min(2, "Device name must be at least 2 characters")
    .max(100, "Device name must not exceed 100 characters")
    .trim(),
});

export const pairDeviceSchema = z.object({
  pairingCode: z
    .string()
    .length(6, "Pairing code must be exactly 6 digits")
    .regex(/^[0-9]{6}$/, "Pairing code must contain only digits"),
  deviceName: z
    .string()
    .min(2, "Device name must be at least 2 characters")
    .max(100)
    .trim(),
  deviceModel: z.string().max(100).optional().or(z.literal("")),
  androidVersion: z.string().max(50).optional().or(z.literal("")),
  appVersion: z.string().max(50).optional().or(z.literal("")),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

export const heartbeatSchema = z.object({
  batteryLevel: z.number().min(0).max(100).optional(),
  isCharging: z.boolean().optional(),
  networkType: z.string().max(50).optional(),
  hasSim: z.boolean().optional(),
  smsPermissionGranted: z.boolean().optional(),
  isSmsCapable: z.boolean().optional(),
  appVersion: z.string().max(50).optional(),
});

export type GeneratePairingCodeInput = z.infer<typeof generatePairingCodeSchema>;
export type PairDeviceInput = z.infer<typeof pairDeviceSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;