import crypto from "crypto";
import { PlatformSettings } from "../models/PlatformSettings";
import { SecurityService } from "./security.service";

const DEFAULTS = {
  authWindowMs: 15 * 60 * 1000,
  loginCaptchaThreshold: 3,
  loginLockThreshold: 10,
  refreshLimit: 30,
  registerCaptchaThreshold: 2,
  forgotCaptchaThreshold: 2,
};

interface AuthSecuritySettings {
  authWindowMs: number;
  loginCaptchaThreshold: number;
  loginLockThreshold: number;
  refreshLimit: number;
  registerCaptchaThreshold: number;
  forgotCaptchaThreshold: number;
}

export interface LoginFailureState {
  ipFails: number;
  acctFails: number;
  captchaRequired: boolean;
  locked: boolean;
}

let cachedSettings: { value: AuthSecuritySettings; expiresAt: number } | null = null;

function asPositiveNumber(value: unknown, fallback: number): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function emailHash(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
}

async function getSettings(): Promise<AuthSecuritySettings> {
  if (cachedSettings && cachedSettings.expiresAt > Date.now()) {
    return cachedSettings.value;
  }

  const keys = [
    "auth_window_ms",
    "auth_login_captcha_threshold",
    "auth_login_lock_threshold",
    "auth_refresh_limit",
    "auth_register_captcha_threshold",
    "auth_forgot_captcha_threshold",
  ];
  const rows = await PlatformSettings.find({ key: { $in: keys }, category: "security" })
    .select("key value")
    .lean();
  const values = new Map(rows.map((row) => [row.key, row.value]));

  const value: AuthSecuritySettings = {
    authWindowMs: asPositiveNumber(values.get("auth_window_ms"), DEFAULTS.authWindowMs),
    loginCaptchaThreshold: asPositiveNumber(
      values.get("auth_login_captcha_threshold"),
      DEFAULTS.loginCaptchaThreshold
    ),
    loginLockThreshold: asPositiveNumber(
      values.get("auth_login_lock_threshold"),
      DEFAULTS.loginLockThreshold
    ),
    refreshLimit: asPositiveNumber(values.get("auth_refresh_limit"), DEFAULTS.refreshLimit),
    registerCaptchaThreshold: asPositiveNumber(
      values.get("auth_register_captcha_threshold"),
      DEFAULTS.registerCaptchaThreshold
    ),
    forgotCaptchaThreshold: asPositiveNumber(
      values.get("auth_forgot_captcha_threshold"),
      DEFAULTS.forgotCaptchaThreshold
    ),
  };

  cachedSettings = { value, expiresAt: Date.now() + 60_000 };
  return value;
}

function failureKeys(scope: string, ip: string, email: string) {
  return {
    ip: `rl:${scope}:fail:ip:${ip}`,
    account: `rl:${scope}:fail:acct:${emailHash(email)}`,
  };
}

async function getFailureState(
  scope: string,
  ip: string,
  email: string,
  captchaThreshold: number,
  lockThreshold?: number
): Promise<LoginFailureState> {
  const { getRedisSafe } = await import("../lib/redis");
  const redis = getRedisSafe();
  if (!redis) {
    return { ipFails: 0, acctFails: 0, captchaRequired: false, locked: false };
  }

  const keys = failureKeys(scope, ip, email);
  const [ipValue, accountValue] = await Promise.all([
    redis.get(keys.ip),
    redis.get(keys.account),
  ]);
  const ipFails = Number(ipValue) || 0;
  const acctFails = Number(accountValue) || 0;

  return {
    ipFails,
    acctFails,
    captchaRequired:
      acctFails >= captchaThreshold || ipFails >= captchaThreshold + 2,
    locked: lockThreshold !== undefined && ipFails >= lockThreshold,
  };
}

async function recordFailure(
  scope: string,
  ip: string,
  email: string,
  captchaThreshold: number,
  lockThreshold?: number
): Promise<LoginFailureState> {
  const { getRedisSafe } = await import("../lib/redis");
  const redis = getRedisSafe();
  if (!redis) {
    return { ipFails: 0, acctFails: 0, captchaRequired: false, locked: false };
  }

  const settings = await getSettings();
  const keys = failureKeys(scope, ip, email);
  const [ipFails, acctFails] = await Promise.all([
    redis.incr(keys.ip),
    redis.incr(keys.account),
  ]);
  await Promise.all([
    redis.expire(keys.ip, Math.ceil(settings.authWindowMs / 1000)),
    redis.expire(keys.account, Math.ceil(settings.authWindowMs / 1000)),
  ]);

  const state = await getFailureState(scope, ip, email, captchaThreshold, lockThreshold);
  if (state.captchaRequired && (acctFails === captchaThreshold || ipFails === captchaThreshold + 2)) {
    await SecurityService.recordSecurityEvent({
      eventType: "LOGIN_CAPTCHA_CHALLENGED",
      severity: "medium",
      description: `CAPTCHA challenge activated for ${scope}`,
      metadata: { ip, emailHash: emailHash(email), scope },
    });
  }
  return state;
}

async function resetFailures(scope: string, ip: string, email: string): Promise<void> {
  const { getRedisSafe } = await import("../lib/redis");
  const redis = getRedisSafe();
  if (!redis) return;
  const keys = failureKeys(scope, ip, email);
  await Promise.all([redis.del(keys.ip), redis.del(keys.account)]);
}

export class AuthSecurityService {
  static async getSettings(): Promise<AuthSecuritySettings> {
    return getSettings();
  }

  static async recordLoginFailure(ip: string, email: string): Promise<LoginFailureState> {
    const settings = await getSettings();
    return recordFailure(
      "login",
      ip,
      email,
      settings.loginCaptchaThreshold,
      settings.loginLockThreshold
    );
  }

  static async resetLoginFailures(ip: string, email: string): Promise<void> {
    return resetFailures("login", ip, email);
  }

  static async getLoginFailureState(ip: string, email: string): Promise<LoginFailureState> {
    const settings = await getSettings();
    return getFailureState(
      "login",
      ip,
      email,
      settings.loginCaptchaThreshold,
      settings.loginLockThreshold
    );
  }

  static async recordScopedFailure(
    scope: "register" | "forgot",
    ip: string,
    email: string
  ): Promise<LoginFailureState> {
    const settings = await getSettings();
    const threshold =
      scope === "register"
        ? settings.registerCaptchaThreshold
        : settings.forgotCaptchaThreshold;
    return recordFailure(scope, ip, email, threshold);
  }

  static async getScopedFailureState(
    scope: "register" | "forgot",
    ip: string,
    email: string
  ): Promise<LoginFailureState> {
    const settings = await getSettings();
    const threshold =
      scope === "register"
        ? settings.registerCaptchaThreshold
        : settings.forgotCaptchaThreshold;
    return getFailureState(scope, ip, email, threshold);
  }

  static async resetScopedFailures(
    scope: "register" | "forgot",
    ip: string,
    email: string
  ): Promise<void> {
    return resetFailures(scope, ip, email);
  }

  static async recordCaptchaFailure(
    req: { ip?: string },
    scope: string,
    email: string
  ): Promise<void> {
    await SecurityService.recordSecurityEvent({
      eventType: "LOGIN_CAPTCHA_FAILED",
      severity: "high",
      description: `Invalid CAPTCHA token for ${scope}`,
      metadata: { ip: req.ip, emailHash: emailHash(email), scope },
    });
  }

  static async recordLoginLocked(ip: string, email: string): Promise<void> {
    await SecurityService.recordSecurityEvent({
      eventType: "LOGIN_LOCKED",
      severity: "high",
      description: "Login hard lock threshold reached",
      metadata: { ip, emailHash: email },
    });
  }
}
