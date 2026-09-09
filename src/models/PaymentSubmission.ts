import mongoose, { Document, Schema } from "mongoose";

export type PaymentStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "expired";

export type PaymentMethod = "bkash" | "nagad" | "rocket";

export interface IPaymentSubmission extends Document {
  userId: mongoose.Types.ObjectId;
  planId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  senderNumber: string;
  transactionId: string;
  screenshotUrl?: string;
  note?: string;
  status: PaymentStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  rejectionReason?: string;
  subscriptionId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSubmissionSchema = new Schema<IPaymentSubmission>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    planId: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "BDT",
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ["bkash", "nagad", "rocket"],
      required: true,
    },
    senderNumber: {
      type: String,
      required: true,
      trim: true,
    },
    transactionId: {
      type: String,
      required: true,
      trim: true,
    },
    screenshotUrl: {
      type: String,
      default: null,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected", "expired"],
      default: "pending",
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
  },
  { timestamps: true }
);

paymentSubmissionSchema.index({ userId: 1, createdAt: -1 });
paymentSubmissionSchema.index({ transactionId: 1 });
paymentSubmissionSchema.index({ status: 1, createdAt: 1 });

export const PaymentSubmission = mongoose.model<IPaymentSubmission>(
  "PaymentSubmission",
  paymentSubmissionSchema
);