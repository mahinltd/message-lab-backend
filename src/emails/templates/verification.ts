import { buildEmailLayout, buildButton } from "./base";

export function buildVerificationEmail(params: {
  userName: string;
  verificationUrl: string;
  expiryHours: number;
}): string {
  const content = `
    <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">Verify Your Email Address</h2>
    <p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">
      Hi ${params.userName},
    </p>
    <p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">
      Thank you for registering with Messages Lab. Please click the button below to verify your email address and activate your account.
    </p>
    ${buildButton("Verify Email Address", params.verificationUrl)}
    <p style="margin:0 0 12px;color:#6b7280;font-size:13px;line-height:1.5;">
      If the button does not work, copy and paste the following link into your browser:
    </p>
    <p style="margin:0 0 20px;word-break:break-all;">
      <a href="${params.verificationUrl}" style="color:#6366f1;font-size:13px;">${params.verificationUrl}</a>
    </p>
    <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;line-height:1.5;">
      This link will expire in ${params.expiryHours} hours.
    </p>
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
      If you did not create an account with Messages Lab, you can safely ignore this email.
    </p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />
    <p style="margin:0;color:#9ca3af;font-size:12px;">
      For your security, please do not share this link with anyone.
    </p>
  `;

  return buildEmailLayout(content);
}

export function getVerificationEmailSubject(): string {
  return "Verify your email address - Messages Lab";
}