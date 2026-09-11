import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  mobile: z.string().regex(/^(\+?8801|01)[0-9]{9}$/, "Invalid Bangladeshi mobile number").optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  captchaToken: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
  captchaToken: z.string().min(1).optional(),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, "Google ID token is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  captchaToken: z.string().min(1).optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  captchaToken: z.string().min(1).optional(),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;