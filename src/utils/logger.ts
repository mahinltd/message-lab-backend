import { env } from "../config/env";

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
} as const;

type LogLevel = keyof typeof logLevels;

const currentLevel: LogLevel = env.NODE_ENV === "production" ? "http" : "debug";

function shouldLog(level: LogLevel): boolean {
  return logLevels[level] <= logLevels[currentLevel];
}

function serializeMeta(meta?: unknown): unknown {
  if (!meta) return undefined;

  if (meta instanceof Error) {
    return {
      name: meta.name,
      message: meta.message,
      stack: env.NODE_ENV === "production" ? undefined : meta.stack,
    };
  }

  return meta;
}

function writeLog(level: LogLevel, message: string, meta?: unknown): void {
  if (!shouldLog(level)) return;

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    meta: serializeMeta(meta),
  };

  const output = JSON.stringify(logEntry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  error: (message: string, meta?: unknown) => writeLog("error", message, meta),
  warn: (message: string, meta?: unknown) => writeLog("warn", message, meta),
  info: (message: string, meta?: unknown) => writeLog("info", message, meta),
  http: (message: string, meta?: unknown) => writeLog("http", message, meta),
  debug: (message: string, meta?: unknown) => writeLog("debug", message, meta),
};