import mongoose, { Document, Schema } from "mongoose";

export interface IDevicePairingCode extends Document {
  userId: mongoose.Types.ObjectId;
  code: string;
  expiresAt: Date;
  usedAt?: Date;
  idempotencyKey?: string | null;
  deviceId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const devicePairingCodeSchema = new Schema<IDevicePairingCode>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      length: 6,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    idempotencyKey: {
      type: String,
      default: null,
    },
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

devicePairingCodeSchema.index({ userId: 1, usedAt: 1 });
devicePairingCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const DevicePairingCode = mongoose.model<IDevicePairingCode>(
  "DevicePairingCode",
  devicePairingCodeSchema
);