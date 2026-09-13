import mongoose, { Document, Schema } from "mongoose";

export type ScheduledSmsStatus = "pending" | "processing" | "queued" | "sent" | "failed" | "cancelled";

export interface IScheduledSms extends Document {
  userId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  recipients: string;
  messageBody: string;
  campaignName?: string | null;
  runAt: Date;
  status: ScheduledSmsStatus;
  campaignId?: mongoose.Types.ObjectId | null;
  failureReason?: string | null;
  idempotencyKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const scheduledSmsSchema = new Schema<IScheduledSms>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  deviceId: { type: Schema.Types.ObjectId, ref: "Device", required: true },
  recipients: { type: String, required: true, maxlength: 50000 },
  messageBody: { type: String, required: true, maxlength: 2000 },
  campaignName: { type: String, default: null, maxlength: 100 },
  runAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ["pending", "processing", "queued", "sent", "failed", "cancelled"], default: "pending", index: true },
  campaignId: { type: Schema.Types.ObjectId, ref: "SmsCampaign", default: null },
  failureReason: { type: String, default: null },
  idempotencyKey: { type: String, default: null },
}, { timestamps: true });

scheduledSmsSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
scheduledSmsSchema.index({ status: 1, runAt: 1 });

export const ScheduledSms = mongoose.model<IScheduledSms>("ScheduledSms", scheduledSmsSchema);