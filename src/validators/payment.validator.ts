import { z } from "zod";

export const submitPaymentSchema = z.object({
  planId: z.string().min(1, "Plan ID is required").toLowerCase().trim(),
  paymentMethod: z.enum(["bkash", "nagad", "rocket"], {
    message: "Payment method must be bkash, nagad, or rocket",
  }),
  senderNumber: z
    .string()
    .min(11, "Sender number must be at least 11 digits")
    .max(15, "Invalid sender number")
    .regex(/^[0-9+]+$/, "Sender number must contain only digits"),
  transactionId: z
    .string()
    .min(4, "Transaction ID is too short")
    .max(50, "Transaction ID is too long")
    .trim(),
  amount: z.number().positive("Amount must be positive"),
  note: z.string().max(500).optional().or(z.literal("")),
});

export const reviewPaymentSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  action: z.enum(["approve", "reject"], {
    message: "Action must be approve or reject",
  }),
  reviewNote: z.string().max(1000).optional().or(z.literal("")),
  rejectionReason: z.string().max(500).optional().or(z.literal("")),
  subscriptionDurationDays: z.number().int().min(1).max(365).optional(),
});

export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;
export type ReviewPaymentInput = z.infer<typeof reviewPaymentSchema>;