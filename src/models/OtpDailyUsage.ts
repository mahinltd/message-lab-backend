import mongoose, { Document, Schema } from "mongoose";

export interface IOtpDailyUsage extends Document {
  userId: mongoose.Types.ObjectId;
  day: string;
  requestCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IOtpDailyUsage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true },
    requestCount: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

schema.index({ userId: 1, day: 1 }, { unique: true });

export const OtpDailyUsage = mongoose.model<IOtpDailyUsage>("OtpDailyUsage", schema);