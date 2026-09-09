/**
 * Base HTML email layout shared across all email templates.
 * Provides consistent branding, responsive design, and footer.
 */

export function buildEmailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Messages Lab</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e;padding:24px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Messages Lab</h1>
              <p style="margin:4px 0 0;color:#a0a0b8;font-size:13px;">Your Personal SMS Gateway</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f8fc;padding:24px 40px;text-align:center;border-top:1px solid #e8e8f0;">
              <p style="margin:0;color:#6b7280;font-size:12px;">
                You received this email because you have an account with Messages Lab.
              </p>
              <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">
                &copy; ${new Date().getFullYear()} Messages Lab. All rights reserved.
              </p>
              <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">
                <a href="https://messagelab.tech" style="color:#6366f1;text-decoration:none;">messagelab.tech</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildButton(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
  <tr>
    <td style="border-radius:6px;background-color:#6366f1;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:6px;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;
}