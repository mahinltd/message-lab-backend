import dotenv from "dotenv";
import { setServers } from "node:dns";
import { z } from "zod";

dotenv.config();

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);

const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(32).optional()
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional()
);

const envSchema = z.object({
  NODE_ENV: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["development", "test", "production"]).default("development")
  ),

  PORT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(5000)
  ),

  API_URL: z.string().url().default("http://localhost:5000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_URL: optionalUrl,

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGO_DNS_SERVERS: optionalString,

  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  COOKIE_SECRET: optionalSecret,
  JWT_ACCESS_SECRET: optionalSecret,
  JWT_REFRESH_SECRET: optionalSecret,

  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  UPSTASH_REDIS_URL: optionalString,

  RESEND_API_KEY: optionalString,
  TURNSTILE_SECRET_KEY: optionalString,

  // Separate email addresses for different purposes
  EMAIL_FROM_VERIFY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().email().default("verify@messagelab.tech")
  ),
  EMAIL_FROM_NO_REPLY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().email().default("no-reply@messagelab.tech")
  ),
  EMAIL_FROM_UPDATE: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().email().default("update@messagelab.tech")
  ),
  EMAIL_FROM_BILLING: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().email().default("billing@messagelab.tech")
  ),
  EMAIL_FROM_SUPPORT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().email().default("support@messagelab.tech")
  ),

  EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(24)
  ),
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(5)
  ),

  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  CLOUDINARY_FOLDER: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().default("message-lab")
  ),

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_CALLBACK_URL: optionalUrl,

  SMS_MIN_DELAY_MS: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(0).default(3000)
  ),

  FREE_PLAN_MAX_RECIPIENTS: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(0).default(10)
  ),

  PRO_PLAN_MAX_RECIPIENTS: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(0).default(20)
  ),

  RATE_LIMIT_WINDOW_MS: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(15 * 60 * 1000)
  ),

  RATE_LIMIT_MAX: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(300)
  ),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables:");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsedEnv.data.MONGO_DNS_SERVERS) {
  setServers(
    parsedEnv.data.MONGO_DNS_SERVERS.split(",")
      .map((server) => server.trim())
      .filter(Boolean)
  );
}

export const env = parsedEnv.data;
export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";