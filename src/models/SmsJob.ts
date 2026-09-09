import mongoose, { Document, Schema } from "mongoose";

export type SmsJobStatus =
  | "queued"
  | "assigned"
  | "processing"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

export interface ISmsJob extends Document {
  campaignId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  recipient: string;
  originalRecipient: string;
  messageBody: string;
  status: SmsJobStatus;
  failureReason?: string;
  attempts: number;
  maxAttempts: number;
  smsParts: number;
  lockedAt?: Date;
  lockedBy?: string;
  sentAt?: Date;
  failedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const smsJobSchema = new Schema<ISmsJob>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "SmsCampaign",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },
    recipient: {
      type: String,
      required: true,
    },
    originalRecipient: {
      type: String,
      required: true,
    },
    messageBody: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: [
        "queued",
        "assigned",
        "processing",
        "sending",
        "sent",
        "failed",
        "cancelled",
      ],
      default: "queued",
    },
    failureReason: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    smsParts: { type: Number, default: 1 },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    sentAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

smsJobSchema.index({ campaignId: 1, status: 1 });
smsJobSchema.index({ deviceId: 1, status: 1 });
smsJobSchema.index({ userId: 1, createdAt: -1 });
smsJobSchema.index({ status: 1, createdAt: 1 });

export const SmsJob = mongoose.model<ISmsJob>("SmsJob", smsJobSchema);