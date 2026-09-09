import { z } from "zod";

export const sendBulkSmsSchema = z.object({
  campaignName: z.string().max(100).optional().or(z.literal("")),
  recipients: z
    .string()
    .min(1, "Recipients are required")
    .max(50000, "Recipient list is too long"),
  messageBody: z
    .string()
    .min(1, "Message body is required")
    .max(2000, "Message must not exceed 2000 characters"),
});

export const sendSingleSmsSchema = z.object({
  recipient: z
    .string()
    .min(1, "Recipient is required")
    .max(20, "Invalid recipient"),
  messageBody: z
    .string()
    .min(1, "Message body is required")
    .max(2000, "Message must not exceed 2000 characters"),
});

export const reportJobStatusSchema = z.object({
  jobId: z.string().min(1, "Job ID is required"),
  status: z.enum(["sent", "failed"]),
  failureReason: z.string().max(500).optional().or(z.literal("")),
});

export const fetchJobsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(1),
});

export type SendBulkSmsInput = z.infer<typeof sendBulkSmsSchema>;
export type SendSingleSmsInput = z.infer<typeof sendSingleSmsSchema>;
export type ReportJobStatusInput = z.infer<typeof reportJobStatusSchema>;
export type FetchJobsInput = z.infer<typeof fetchJobsSchema>;

export const reportIncomingSmsSchema = z.object({
  senderNumber: z.string().min(5, "Sender number required").max(20),
  messageBody: z.string().min(1, "Message body required").max(2000),
  receivedAt: z.string().optional(),
});

export type ReportIncomingSmsInput = z.infer<typeof reportIncomingSmsSchema>;