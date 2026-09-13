import mongoose, { Document, Schema } from "mongoose";

export type OtpStatus = "pending" | "verified" | "expired" | "failed";

export interface IOtpVerification extends Document {
  requestId: string;
  userId: mongoose.Types.ObjectId;
  apiCredentialId: mongoose.Types.ObjectId;
  recipient: string;
  otpHash: string;
  otpSalt: string;
  reference?: string | null;
  metadata?: Record<string, unknown>;
  status: OtpStatus;
  attempts: number;
  resendCount: number;
  expiresAt: Date;
  verifiedAt?: Date | null;
  smsCampaignId?: mongoose.Types.ObjectId | null;
  deviceId?: mongoose.Types.ObjectId | null;
  failureReason?: string | null;
  idempotencyKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const otpVerificationSchema = new Schema<IOtpVerification>(
  {
    requestId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    apiCredentialId: { type: Schema.Types.ObjectId, ref: "ApiCredential", required: true },
    recipient: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    otpSalt: { type: String, required: true },
    reference: { type: String, default: null, trim: true, maxlength: 100 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["pending", "verified", "expired", "failed"], default: "pending", index: true },
    attempts: { type: Number, default: 0, min: 0 },
    resendCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true, index: true },
    verifiedAt: { type: Date, default: null },
    smsCampaignId: { type: Schema.Types.ObjectId, ref: "SmsCampaign", default: null },
    deviceId: { type: Schema.Types.ObjectId, ref: "Device", default: null },
    failureReason: { type: String, default: null },
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: true },
);

otpVerificationSchema.index({ userId: 1, createdAt: -1 });
otpVerificationSchema.index({ recipient: 1, createdAt: -1 });
otpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });
otpVerificationSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

export const OtpVerification = mongoose.model<IOtpVerification>("OtpVerification", otpVerificationSchema);