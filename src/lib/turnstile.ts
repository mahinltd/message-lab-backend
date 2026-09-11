import { env } from "../config/env";

export interface TurnstileResult {
  success: boolean;
  errorCodes?: string[];
}

export async function verifyTurnstile(
  token: string,
  remoteIp: string
): Promise<TurnstileResult> {
  if (!env.TURNSTILE_SECRET_KEY) {
    return { success: false, errorCodes: ["missing-secret"] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: remoteIp,
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return { success: false, errorCodes: [`http-${response.status}`] };
    }

    const result = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    return {
      success: result.success === true,
      errorCodes: result["error-codes"],
    };
  } catch {
    return { success: false, errorCodes: ["verification-unavailable"] };
  } finally {
    clearTimeout(timeout);
  }
}