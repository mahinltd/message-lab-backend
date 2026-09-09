import mongoose, { Document, Schema } from "mongoose";

export interface IPlatformSettings extends Document {
  key: string;
  value: any;
  valueType: "string" | "number" | "boolean" | "json";
  description?: string;
  category: string;
  updatedAt: Date;
  createdAt: Date;
}

const platformSettingsSchema = new Schema<IPlatformSettings>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    valueType: {
      type: String,
      enum: ["string", "number", "boolean", "json"],
      default: "string",
    },
    description: { type: String, default: null },
    category: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

platformSettingsSchema.index({ category: 1 });

export const PlatformSettings = mongoose.model<IPlatformSettings>(
  "PlatformSettings",
  platformSettingsSchema
);