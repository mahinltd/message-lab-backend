import { buildEmailLayout, buildButton } from "./base";

export function buildPasswordResetEmail(params: {
  userName: string;
  resetUrl: string;
  expiryMinutes: number;
}): string {
  const content = `
    <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">Reset Your Password</h2>
    <p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">
      Hi ${params.userName},
    </p>
    <p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">
      We received a request to reset your password. Click the button below to choose a new password.
    </p>
    ${buildButton("Reset Password", params.resetUrl)}
    <p style="margin:0 0 12px;color:#6b7280;font-size:13px;line-height:1.5;">
      If the button does not work, copy and paste the following link into your browser:
    </p>
    <p style="margin:0 0 20px;word-break:break-all;">
      <a href="${params.resetUrl}" style="color:#6366f1;font-size:13px;">${params.resetUrl}</a>
    </p>
    <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;line-height:1.5;">
      This link will expire in ${params.expiryMinutes} minutes.
    </p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />
    <p style="margin:0;color:#ef4444;font-size:12px;line-height:1.5;">
      If you did not request a password reset, please ignore this email. Your password will remain unchanged. If you suspect unauthorized access, contact support immediately.
    </p>
  `;

  return buildEmailLayout(content);
}

export function getPasswordResetEmailSubject(): string {
  return "Reset your password - Messages Lab";
}