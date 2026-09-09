import { buildEmailLayout } from "./base";

export function buildAccountUpdateEmail(params: {
  userName: string;
  updateType: string;
  updateDetails: string;
  timestamp: string;
  ipAddress?: string;
}): string {
  const content = `
    <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">Account Update Notification</h2>
    <p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">
      Hi ${params.userName},
    </p>
    <p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">
      The following change was made to your Messages Lab account:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8fc;border-radius:6px;padding:16px;margin:16px 0;">
      <tr>
        <td style="padding:8px 16px;color:#6b7280;font-size:13px;">Change Type</td>
        <td style="padding:8px 16px;color:#1f2937;font-size:13px;font-weight:600;">${params.updateType}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px;color:#6b7280;font-size:13px;">Details</td>
        <td style="padding:8px 16px;color:#1f2937;font-size:13px;">${params.updateDetails}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px;color:#6b7280;font-size:13px;">Time</td>
        <td style="padding:8px 16px;color:#1f2937;font-size:13px;">${params.timestamp}</td>
      </tr>
      ${params.ipAddress ? `<tr>
        <td style="padding:8px 16px;color:#6b7280;font-size:13px;">IP Address</td>
        <td style="padding:8px 16px;color:#1f2937;font-size:13px;">${params.ipAddress}</td>
      </tr>` : ""}
    </table>
    <p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:1.6;">
      If you made this change, no further action is needed.
    </p>
    <p style="margin:0;color:#ef4444;font-size:13px;line-height:1.5;">
      If you did not make this change, please secure your account immediately by changing your password and contacting support.
    </p>
  `;

  return buildEmailLayout(content);
}

export function getAccountUpdateEmailSubject(updateType: string): string {
  return `Account updated: ${updateType} - Messages Lab`;
}