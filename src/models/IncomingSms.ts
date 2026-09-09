import mongoose, { Document, Schema } from "mongoose";

export interface IIncomingSms extends Document {
  userId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  senderNumber: string;
  messageBody: string;
  receivedAt: Date;
  isRead: boolean;
  createdAt: Date;
}

const incomingSmsSchema = new Schema<IIncomingSms>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceId: { type: Schema.Types.ObjectId, ref: "Device", required: true },
    senderNumber: { type: String, required: true },
    messageBody: { type: String, required: true, maxlength: 2000 },
    receivedAt: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

incomingSmsSchema.index({ userId: 1, receivedAt: -1 });

export const IncomingSms = mongoose.model<IIncomingSms>("IncomingSms", incomingSmsSchema);