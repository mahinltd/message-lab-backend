import mongoose, { Document, Schema } from "mongoose";

export interface ISmsDailyUsage extends Document {
  userId: mongoose.Types.ObjectId;
  day: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const smsDailyUsageSchema = new Schema<ISmsDailyUsage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true },
    messageCount: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

smsDailyUsageSchema.index({ userId: 1, day: 1 }, { unique: true });

export const SmsDailyUsage = mongoose.model<ISmsDailyUsage>("SmsDailyUsage", smsDailyUsageSchema);