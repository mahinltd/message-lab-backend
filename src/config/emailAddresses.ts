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
    label: "Messages Lab Verification",
  },
  "password-reset": {
    from: env.EMAIL_FROM_VERIFY,
    label: "Messages Lab Security",
  },
  "account-update": {
    from: env.EMAIL_FROM_UPDATE,
    label: "Messages Lab Updates",
  },
  "security-alert": {
    from: env.EMAIL_FROM_UPDATE,
    label: "Messages Lab Security",
  },
  payment: {
    from: env.EMAIL_FROM_BILLING,
    label: "Messages Lab Billing",
  },
  subscription: {
    from: env.EMAIL_FROM_BILLING,
    label: "Messages Lab Billing",
  },
  notification: {
    from: env.EMAIL_FROM_NO_REPLY,
    label: "Messages Lab",
  },
  support: {
    from: env.EMAIL_FROM_SUPPORT,
    label: "Messages Lab Support",
  },
  "device-alert": {
    from: env.EMAIL_FROM_UPDATE,
    label: "Messages Lab Device",
  },
};

export function getEmailSender(category: EmailCategory): string {
  const config = senderMap[category];
  return `${config.label} <${config.from}>`;
}

export function getEmailSenderConfig(category: EmailCategory): EmailSenderConfig {
  return senderMap[category];
}