import { buildEmailLayout, buildButton } from "./base";

export function buildPaymentUpdateEmail(params: {
  userName: string;
  status: "submitted" | "under-review" | "approved" | "rejected";
  planName: string;
  amount: string;
  paymentMethod: string;
  transactionId: string;
  submittedAt: string;
  rejectionReason?: string;
  dashboardUrl: string;
}): string {
  const statusConfig = {
    submitted: {
      label: "Payment Submitted",
      color: "#f59e0b",
      message: "Your payment has been received and is pending verification.",
    },
    "under-review": {
      label: "Under Review",
      color: "#3b82f6",
      message: "Our team is verifying your payment. This usually takes a few hours.",
    },
    approved: {
      label: "Payment Approved",
      color: "#10b981",
      message: "Your payment has been verified and your subscription is now active!",
    },
    rejected: {
      label: "Payment Rejected",
      color: "#ef4444",
      message: "Unfortunately, we could not verify your payment.",
    },
  };

  const config = statusConfig[params.status];

  const content = `
    <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;">Payment Update</h2>
    <p style="margin:0 0 12px;color:#4b5563;font-size:15px;line-height:1.6;">
      Hi ${params.userName},
    </p>
    <div style="background-color:${config.color}15;border-left:4px solid ${config.color};padding:12px 16px;margin:16px 0;border-radius:4px;">
      <p style="margin:0;color:${config.color};font-size:14px;font-weight:600;">${config.label}</p>
      <p style="margin:4px 0 0;color:#4b5563;font-size:13px;">${config.message}</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8fc;border-radius:6px;padding:16px;margin:16px 0;">
      <tr>
        <td style="padding:8px 16px;color:#6b7280;font-size:13px;">Plan</td>
        <td style="padding:8px 16px;color:#1f2937;font-size:13px;font-weight:600;">${params.planName}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px;color:#6b7280;font-size:13px;">Amount</td>
        <td style="padding:8px 16px;color:#1f2937;font-size:13px;">${params.amount}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px;color:#6b7280;font-size:13px;">Payment Method</td>
        <td style="padding:8px 16px;color:#1f2937;font-size:13px;">${params.paymentMethod}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px;color:#6b7280;font-size:13px;">Transaction ID</td>
        <td style="padding:8px 16px;color:#1f2937;font-size:13px;font-family:monospace;">${params.transactionId}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px;color:#6b7280;font-size:13px;">Submitted</td>
        <td style="padding:8px 16px;color:#1f2937;font-size:13px;">${params.submittedAt}</td>
      </tr>
    </table>
    ${params.rejectionReason ? `<p style="margin:12px 0;color:#ef4444;font-size:13px;"><strong>Reason:</strong> ${params.rejectionReason}</p>` : ""}
    ${buildButton("View Dashboard", params.dashboardUrl)}
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
      If you have questions about this payment, please contact our support team.
    </p>
  `;

  return buildEmailLayout(content);
}

export function getPaymentUpdateEmailSubject(status: string): string {
  const labels: Record<string, string> = {
    submitted: "Payment received - Pending verification",
    "under-review": "Payment under review",
    approved: "Payment approved - Subscription active",
    rejected: "Payment verification failed",
  };

  return `${labels[status] || "Payment update"} - Messages Lab`;
}