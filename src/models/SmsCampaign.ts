import mongoose, { Document, Schema } from "mongoose";

export type CampaignStatus =
  | "queued"
  | "processing"
  | "paused"
  | "completed"
  | "partially_failed"
  | "failed"
  | "cancelled";

export interface ISmsCampaign extends Document {
  userId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  campaignName?: string;
  messageBody: string;
  totalRecipients: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  status: CampaignStatus;
  planAtCreation: string;
  minDelayMs: number;
  smsPartsPerMessage: number;
  encoding: string;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const smsCampaignSchema = new Schema<ISmsCampaign>(
  {
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
    campaignName: { type: String, trim: true, default: null },
    messageBody: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    totalRecipients: {
      type: Number,
      required: true,
      min: 1,
    },
    processedCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        "queued",
        "processing",
        "paused",
        "completed",
        "partially_failed",
        "failed",
        "cancelled",
      ],
      default: "queued",
    },
    planAtCreation: { type: String, default: "free" },
    minDelayMs: { type: Number, default: 3000 },
    smsPartsPerMessage: { type: Number, default: 1 },
    encoding: { type: String, default: "gsm7" },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },
  },
  { timestamps: true }
);

smsCampaignSchema.index({ userId: 1, createdAt: -1 });
smsCampaignSchema.index({ status: 1 });
smsCampaignSchema.index({ deviceId: 1, status: 1 });

export const SmsCampaign = mongoose.model<ISmsCampaign>(
  "SmsCampaign",
  smsCampaignSchema
);