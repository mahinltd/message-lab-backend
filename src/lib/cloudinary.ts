import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let isConfigured = false;

export function initializeCloudinary(): void {
  if (
    env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET
  ) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });

    isConfigured = true;
    logger.info("Cloudinary client initialized");
    return;
  }

  logger.warn("Cloudinary is not configured. Image upload is disabled.");
}

export function getCloudinary() {
  if (!isConfigured) {
    throw new Error("Cloudinary is not initialized. Configure Cloudinary credentials.");
  }

  return cloudinary;
}

export function isCloudinaryConfigured(): boolean {
  return isConfigured;
}