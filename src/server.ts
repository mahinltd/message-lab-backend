import http from "http";

import app from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./lib/mongodb";
import { initializeRedis } from "./lib/redis";
import { initializeResend } from "./lib/resend";
import { initializeCloudinary } from "./lib/cloudinary";
import { seedDefaultContent } from "./seed/defaultContent";
import { registerAllJobs, jobRunner } from "./jobs";
import { logger } from "./utils/logger";

const server = http.createServer(app);

let isShuttingDown = false;

async function startServer(): Promise<void> {
  try {
    initializeRedis();
    initializeResend();
    initializeCloudinary();

    await connectDatabase();

    // Seed default content on startup
    await seedDefaultContent();

    // Register and start scheduled jobs
    registerAllJobs();

    server.listen(env.PORT, () => {
      logger.info(`Messages Lab backend is running on port ${env.PORT}`, {
        environment: env.NODE_ENV,
        frontendUrl: env.FRONTEND_URL,
      });
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

function gracefulShutdown(signal: string): void {
  if (isShuttingDown) return;

  isShuttingDown = true;

  logger.info(`${signal} received. Starting graceful shutdown.`);

  // Stop all scheduled jobs first
  jobRunner.stopAllJobs();

  server.close(async () => {
    try {
      await disconnectDatabase();
      logger.info("Graceful shutdown completed.");
      process.exit(0);
    } catch (error) {
      logger.error("Error during graceful shutdown", error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("Forced shutdown because graceful shutdown timed out.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Promise rejection detected", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception detected", error);
  process.exit(1);
});

startServer();