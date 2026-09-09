import { buildEmailLayout, buildButton } from "./base";

export function buildDeviceAlertEmail(params: {
  userName: string;
  alertType: "connected" | "disconnected" | "suspicious";
  deviceName: string;
  timestamp: string;
  ipAddress?: string;
  dashboardUrl: string;
}): string {
  const alertConfig = {
    connected: {
      title: "New Device Connected",
      message: "A new Android device has been connected to your Messages Lab account.",
      color: "#10b981",
    },
    disconnected: {
      title: "Device Disconnected",
      message: "A device has been disconnected from your Messages Lab account.",
      color: "#f59e0b",
    },
    suspicious: {
      title: "Suspicious Device Activity",
      message: "We detected unusual device activity on your account. Please review immediately.",
      color: "#ef4444",
    },
  };

  const config = alertConfig[params.alertType];

  const content = `
    <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">${config.title}</h2>
    <p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">
      Hi ${params.userName},
    </p>
    <div style="background-color:${config.color}15;border-left:4px solid ${config.color};padding:12px 16px;margin:16px 0;border-radius:4px;">
      <p style="margin:0;color:#4b5563;font-size:14px;">${config.message}</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8fc;border-radius:6px;padding:16px;margin:16px 0;">
      <tr>
        <td style="padding:8px 16px;color:#6b7280;font-size:13px;">Device</td>
        <td style="padding:8px 16px;color:#1f2937;font-size:13px;font-weight:600;">${params.deviceName}</td>
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
    ${params.alertType === "suspicious" ? `<p style="margin:12px 0;color:#ef4444;font-size:13px;">If you do not recognize this activity, please change your password and disconnect all devices immediately.</p>` : ""}
    ${buildButton("Manage Devices", params.dashboardUrl)}
  `;

  return buildEmailLayout(content);
}

export function getDeviceAlertEmailSubject(alertType: string): string {
  const subjects: Record<string, string> = {
    connected: "New device connected to your account",
    disconnected: "Device disconnected from your account",
    suspicious: "Security alert: Suspicious device activity",
  };

  return `${subjects[alertType] || "Device notification"} - Messages Lab`;
}