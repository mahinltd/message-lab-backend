import { env } from "./env";

/**
 * Central registry of all email sender addresses used across the platform.
 * Each email type uses a dedicated sender address for better deliverability,
 * tracking, and user trust.
 */

export type EmailCategory =
  | "verification"
  | "password-reset"
  | "account-update"
  | "security-alert"
  | "payment"
  | "subscription"
  | "notification"
  | "support"
  | "device-alert";

interface EmailSenderConfig {
  from: string;
  label: string;
}

const senderMap: Record<EmailCategory, EmailSenderConfig> = {
  verification: {
    from: env.EMAIL_FROM_VERIFY,
    label: "MessageLab Verification",
  },
  "password-reset": {
    from: env.EMAIL_FROM_VERIFY,
    label: "MessageLab Security",
  },
  "account-update": {
    from: env.EMAIL_FROM_UPDATE,
    label: "MessageLab Updates",
  },
  "security-alert": {
    from: env.EMAIL_FROM_UPDATE,
    label: "MessageLab Security",
  },
  payment: {
    from: env.EMAIL_FROM_BILLING,
    label: "MessageLab Billing",
  },
  subscription: {
    from: env.EMAIL_FROM_BILLING,
    label: "MessageLab Billing",
  },
  notification: {
    from: env.EMAIL_FROM_NO_REPLY,
    label: "MessageLab",
  },
  support: {
    from: env.EMAIL_FROM_SUPPORT,
    label: "MessageLab Support",
  },
  "device-alert": {
    from: env.EMAIL_FROM_UPDATE,
    label: "MessageLab Device",
  },
};

export function getEmailSender(category: EmailCategory): string {
  const config = senderMap[category];
  return `${config.label} <${config.from}>`;
}

export function getEmailSenderConfig(category: EmailCategory): EmailSenderConfig {
  return senderMap[category];
}