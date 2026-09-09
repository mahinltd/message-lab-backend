import { Resend } from "resend";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let resendClient: Resend | null = null;

export function initializeResend(): void {
  if (env.RESEND_API_KEY) {
    resendClient = new Resend(env.RESEND_API_KEY);
    logger.info("Resend email client initialized");
    return;
  }

  logger.warn("RESEND_API_KEY is not configured. Email sending is disabled.");
}

export function getResend(): Resend {
  if (!resendClient) {
    throw new Error("Resend client is not initialized. Set RESEND_API_KEY.");
  }

  return resendClient;
}

export function getResendSafe(): Resend | null {
  return resendClient;
}

export function isResendConfigured(): boolean {
  return Boolean(resendClient);
}

export function getFromAddress(type: "no-reply" | "update"): string {
  const address =
    type === "no-reply" ? env.EMAIL_FROM_NO_REPLY : env.EMAIL_FROM_UPDATE;

  return `Messages Lab <${address}>`;
}