import mongoose, { Document, Schema } from "mongoose";

export type DeviceStatus =
  | "active"
  | "offline"
  | "paused"
  | "disabled"
  | "suspended";
export type GatewayState = "on" | "off";

export interface IDeviceHeartbeat {
  batteryLevel?: number;
  isCharging?: boolean;
  networkType?: string;
  hasSim?: boolean;
  smsPermissionGranted?: boolean;
  isSmsCapable?: boolean;
  appVersion?: string;
  lastSeenAt: Date;
}

export interface IDevice extends Document {
  userId: mongoose.Types.ObjectId;
  clientDeviceId: string;
  deviceName: string;
  deviceModel?: string | null;
  androidVersion?: string | null;
  appVersion?: string | null;
  pairingIdempotencyKey?: string | null;
  deviceTokenHash: string;
  status: DeviceStatus;
  gatewayState: GatewayState;
  lastHeartbeat?: IDeviceHeartbeat | null;
  lastSeenAt?: Date | null;
  connectedAt: Date;
  disconnectedAt?: Date | null;
  disabledReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const heartbeatSchema = new Schema<IDeviceHeartbeat>(
  {
    batteryLevel: { type: Number, min: 0, max: 100 },
    isCharging: { type: Boolean },
    networkType: { type: String },
    hasSim: { type: Boolean },
    smsPermissionGranted: { type: Boolean },
    isSmsCapable: { type: Boolean },
    appVersion: { type: String },
    lastSeenAt: { type: Date, required: true },
  },
  { _id: false }
);

const deviceSchema = new Schema<IDevice>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientDeviceId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },
    deviceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    deviceModel: { type: String, trim: true, default: null },
    androidVersion: { type: String, trim: true, default: null },
    appVersion: { type: String, trim: true, default: null },
    pairingIdempotencyKey: { type: String, default: null },
    deviceTokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["active", "offline", "paused", "disabled", "suspended"],
      default: "active",
    },
    gatewayState: {
      type: String,
      enum: ["on", "off"],
      default: "on",
    },
    lastHeartbeat: { type: heartbeatSchema, default: null },
    lastSeenAt: { type: Date, default: null },
    connectedAt: { type: Date, default: Date.now },
    disconnectedAt: { type: Date, default: null },
    disabledReason: { type: String, default: null },
  },
  { timestamps: true }
);

deviceSchema.index({ userId: 1, status: 1 });
deviceSchema.index({ userId: 1, clientDeviceId: 1 }, { unique: true });
deviceSchema.index({ lastSeenAt: 1 });
deviceSchema.index(
  { pairingIdempotencyKey: 1 },
  { unique: true, sparse: true }
);

deviceSchema.pre("save", function () {
  if (this.pairingIdempotencyKey === null) {
    this.set("pairingIdempotencyKey", undefined as unknown as null);
  }
});

export const Device = mongoose.model<IDevice>("Device", deviceSchema);