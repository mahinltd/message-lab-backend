import { buildEmailLayout, buildButton } from "./base";

export function buildWelcomeEmail(params: {
  userName: string;
  dashboardUrl: string;
}): string {
  const content = `
    <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">Welcome to Messages Lab!</h2>
    <p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">
      Hi ${params.userName},
    </p>
    <p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">
      Your email has been verified and your account is now active. You can now connect your Android device and start sending SMS through your personal gateway.
    </p>
    ${buildButton("Go to Dashboard", params.dashboardUrl)}
    <p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">
      Here are your next steps:
    </p>
    <ol style="margin:0 0 20px;padding-left:20px;color:#4b5563;font-size:14px;line-height:2;">
      <li>Install the Messages Lab Android app</li>
      <li>Connect your device to your account</li>
      <li>Send your first SMS from the dashboard</li>
    </ol>
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
      If you have any questions, feel free to reach out to our support team.
    </p>
  `;

  return buildEmailLayout(content);
}

export function getWelcomeEmailSubject(): string {
  return "Welcome to Messages Lab - Account Activated";
}