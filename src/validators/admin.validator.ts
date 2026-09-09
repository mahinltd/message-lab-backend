import { z } from "zod";

export const updateContentSchema = z.object({
  key: z.string().min(1).max(100).toLowerCase().trim(),
  category: z.string().min(1).max(50).trim(),
  title: z.string().max(500).optional().nullable(),
  body: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
});

export const updatePlanSchema = z.object({
  planId: z.string().min(1).max(50).toLowerCase().trim(),
  name: z.string().min(1).max(100).trim(),
  displayName: z.string().min(1).max(100).trim(),
  description: z.string().max(1000).optional().nullable(),
  priceMonthly: z.number().min(0),
  priceYearly: z.number().min(0).optional(),
  currency: z.string().max(10).optional(),
  maxRecipientsPerCampaign: z.number().int().min(0),
  maxDailyMessages: z.number().int().min(0),
  maxDevices: z.number().int().min(1).optional(),
  minSmsDelayMs: z.number().int().min(0).optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateSettingSchema = z.object({
  key: z.string().min(1).max(100).toLowerCase().trim(),
  value: z.any(),
  valueType: z.enum(["string", "number", "boolean", "json"]).optional(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().min(1).max(50).trim(),
});

export type UpdateContentInput = z.infer<typeof updateContentSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;