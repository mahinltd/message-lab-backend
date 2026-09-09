import mongoose, { Document, Schema } from "mongoose";

export interface ISiteContent extends Document {
  key: string;
  category: string;
  title?: string;
  body?: string;
  metadata?: Record<string, any>;
  isActive: boolean;
  updatedAt: Date;
  createdAt: Date;
}

const siteContentSchema = new Schema<ISiteContent>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    title: { type: String, trim: true, default: null },
    body: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

siteContentSchema.index({ category: 1, isActive: 1 });

export const SiteContent = mongoose.model<ISiteContent>(
  "SiteContent",
  siteContentSchema
);