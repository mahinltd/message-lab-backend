import mongoose, { Document, Schema } from "mongoose";

export interface IPlanConfig extends Document {
  planId: string;
  name: string;
  displayName: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  maxRecipientsPerCampaign: number;
  maxDailyMessages: number;
  maxDevices: number;
  minSmsDelayMs: number;
  features: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const planConfigSchema = new Schema<IPlanConfig>(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    description: { type: String, default: null },
    priceMonthly: { type: Number, required: true, min: 0 },
    priceYearly: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "BDT", trim: true },
    maxRecipientsPerCampaign: { type: Number, required: true, min: 0 },
    maxDailyMessages: { type: Number, required: true, min: 0 },
    maxDevices: { type: Number, default: 1, min: 1 },
    minSmsDelayMs: { type: Number, default: 3000, min: 0 },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

planConfigSchema.index({ isActive: 1, sortOrder: 1 });

export const PlanConfig = mongoose.model<IPlanConfig>(
  "PlanConfig",
  planConfigSchema
);