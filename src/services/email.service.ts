import { getResendSafe, getResend } from "../lib/resend";
import { getEmailSender, EmailCategory } from "../config/emailAddresses";
import { logger } from "../utils/logger";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  category: EmailCategory;
  replyTo?: string;
}

interface EmailLogEntry {
  to: string;
  subject: string;
  category: EmailCategory;
  status: "sent" | "failed" | "not_configured";
  error?: string;
  timestamp: string;
}

export class EmailService {
  static async sendEmail(params: SendEmailParams): Promise<boolean> {
    const resend = getResendSafe();

    if (!resend) {
      logger.warn("Email service not configured. Email not sent.", {
        to: params.to,
        subject: params.subject,
        category: params.category,
      });
      return false;
    }

    try {
      const from = getEmailSender(params.category);

      const { error } = await resend.emails.send({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        replyTo: params.replyTo,
      });

      if (error) {
        logger.error("Failed to send email via Resend", {
          to: params.to,
          subject: params.subject,
          category: params.category,
          error: error.message,
        });
        return false;
      }

      logger.info("Email sent successfully", {
        to: params.to,
        subject: params.subject,
        category: params.category,
      });

      return true;
    } catch (error) {
      logger.error("Unexpected error while sending email", {
        to: params.to,
        subject: params.subject,
        category: params.category,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  static async sendVerificationEmail(
    to: string,
    userName: string,
    verificationUrl: string,
    expiryHours: number
  ): Promise<boolean> {
    const { buildVerificationEmail, getVerificationEmailSubject } = await import(
      "../emails/templates/verification"
    );

    const html = buildVerificationEmail({ userName, verificationUrl, expiryHours });
    const subject = getVerificationEmailSubject();

    return this.sendEmail({
      to,
      subject,
      html,
      category: "verification",
    });
  }

  static async sendWelcomeEmail(
    to: string,
    userName: string,
    dashboardUrl: string
  ): Promise<boolean> {
    const { buildWelcomeEmail, getWelcomeEmailSubject } = await import(
      "../emails/templates/welcome"
    );

    const html = buildWelcomeEmail({ userName, dashboardUrl });
    const subject = getWelcomeEmailSubject();

    return this.sendEmail({
      to,
      subject,
      html,
      category: "notification",
    });
  }

  static async sendPasswordResetEmail(
    to: string,
    userName: string,
    resetUrl: string,
    expiryMinutes: number
  ): Promise<boolean> {
    const { buildPasswordResetEmail, getPasswordResetEmailSubject } = await import(
      "../emails/templates/passwordReset"
    );

    const html = buildPasswordResetEmail({ userName, resetUrl, expiryMinutes });
    const subject = getPasswordResetEmailSubject();

    return this.sendEmail({
      to,
      subject,
      html,
      category: "password-reset",
    });
  }

  static async sendAccountUpdateEmail(
    to: string,
    userName: string,
    updateType: string,
    updateDetails: string,
    ipAddress?: string
  ): Promise<boolean> {
    const { buildAccountUpdateEmail, getAccountUpdateEmailSubject } = await import(
      "../emails/templates/accountUpdate"
    );

    const html = buildAccountUpdateEmail({
      userName,
      updateType,
      updateDetails,
      timestamp: new Date().toISOString(),
      ipAddress,
    });
    const subject = getAccountUpdateEmailSubject(updateType);

    return this.sendEmail({
      to,
      subject,
      html,
      category: "account-update",
    });
  }

  static async sendPaymentUpdateEmail(
    to: string,
    userName: string,
    status: "submitted" | "under-review" | "approved" | "rejected",
    planName: string,
    amount: string,
    paymentMethod: string,
    transactionId: string,
    submittedAt: string,
    rejectionReason: string | undefined,
    dashboardUrl: string
  ): Promise<boolean> {
    const { buildPaymentUpdateEmail, getPaymentUpdateEmailSubject } = await import(
      "../emails/templates/paymentUpdate"
    );

    const html = buildPaymentUpdateEmail({
      userName,
      status,
      planName,
      amount,
      paymentMethod,
      transactionId,
      submittedAt,
      rejectionReason,
      dashboardUrl,
    });
    const subject = getPaymentUpdateEmailSubject(status);

    return this.sendEmail({
      to,
      subject,
      html,
      category: "notification",
    });
  }

  static async sendDeviceAlertEmail(
    to: string,
    userName: string,
    alertType: "connected" | "disconnected" | "suspicious",
    deviceName: string,
    dashboardUrl: string,
    ipAddress?: string
  ): Promise<boolean> {
    const { buildDeviceAlertEmail, getDeviceAlertEmailSubject } = await import(
      "../emails/templates/deviceAlert"
    );

    const html = buildDeviceAlertEmail({
      userName,
      alertType,
      deviceName,
      timestamp: new Date().toISOString(),
      ipAddress,
      dashboardUrl,
    });
    const subject = getDeviceAlertEmailSubject(alertType);

    return this.sendEmail({
      to,
      subject,
      html,
      category: "device-alert",
    });
  }
}