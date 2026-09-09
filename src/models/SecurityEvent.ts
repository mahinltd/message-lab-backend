import mongoose, { Document, Schema } from "mongoose";

export interface ISecurityEvent extends Document {
  eventType: string; // e.g., "RATE_LIMIT_EXCEEDED", "FAILED_LOGIN", "SUSPICIOUS_ACTIVITY"
  severity: "low" | "medium" | "high" | "critical";
  ipAddress?: string;
  userId?: mongoose.Types.ObjectId;
  userAgent?: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const securityEventSchema = new Schema<ISecurityEvent>(
  {
    eventType: { type: String, required: true },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
    ipAddress: { type: String, default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    userAgent: { type: String, default: null },
    description: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

securityEventSchema.index({ eventType: 1, createdAt: -1 });
securityEventSchema.index({ ipAddress: 1, createdAt: -1 });
securityEventSchema.index({ severity: 1, createdAt: -1 });

export const SecurityEvent = mongoose.model<ISecurityEvent>("SecurityEvent", securityEventSchema);