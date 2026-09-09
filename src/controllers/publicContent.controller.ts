import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { PublicContentService } from "../services/publicContent.service";

/**
 * Get all page content in one request.
 * This is the primary endpoint used by the frontend
 * to load the landing page, pricing page, etc.
 * GET /api/v1/public/content
 */
export const getFullPageContent = asyncHandler(
  async (_req: Request, res: Response) => {
    const content = await PublicContentService.getFullPageContent();

    res.status(200).json({
      success: true,
      data: content,
    });
  }
);

/**
 * Get hero section content only.
 * GET /api/v1/public/content/hero
 */
export const getHeroContent = asyncHandler(
  async (_req: Request, res: Response) => {
    const hero = await PublicContentService.getHeroContent();

    res.status(200).json({
      success: true,
      data: { hero },
    });
  }
);

/**
 * Get header content only.
 * GET /api/v1/public/content/header
 */
export const getHeaderContent = asyncHandler(
  async (_req: Request, res: Response) => {
    const header = await PublicContentService.getHeaderContent();

    res.status(200).json({
      success: true,
      data: { header },
    });
  }
);

/**
 * Get footer content only.
 * GET /api/v1/public/content/footer
 */
export const getFooterContent = asyncHandler(
  async (_req: Request, res: Response) => {
    const footer = await PublicContentService.getFooterContent();

    res.status(200).json({
      success: true,
      data: { footer },
    });
  }
);

/**
 * Get announcement banner.
 * GET /api/v1/public/content/announcement
 */
export const getAnnouncement = asyncHandler(
  async (_req: Request, res: Response) => {
    const announcement = await PublicContentService.getAnnouncement();

    res.status(200).json({
      success: true,
      data: { announcement },
    });
  }
);

/**
 * Get features section content.
 * GET /api/v1/public/content/features
 */
export const getFeatureContent = asyncHandler(
  async (_req: Request, res: Response) => {
    const features = await PublicContentService.getFeatureContent();

    res.status(200).json({
      success: true,
      data: { features },
    });
  }
);

/**
 * Get public pricing information.
 * No authentication required.
 * GET /api/v1/public/pricing
 */
export const getPublicPricing = asyncHandler(
  async (_req: Request, res: Response) => {
    const pricing = await PublicContentService.getPublicPricing();

    res.status(200).json({
      success: true,
      data: pricing,
    });
  }
);

/**
 * Get platform health status (public).
 * GET /api/v1/public/status
 */
export const getPublicStatus = asyncHandler(
  async (_req: Request, res: Response) => {
    const { PlatformSettings } = await import("../models/PlatformSettings");

    const maintenanceMode = await PlatformSettings.findOne({
      key: "maintenance_mode",
    }).lean();

    const registrationOpen = await PlatformSettings.findOne({
      key: "registration_open",
    }).lean();

    res.status(200).json({
      success: true,
      data: {
        maintenanceMode: maintenanceMode?.value === true,
        registrationOpen: registrationOpen?.value !== false,
        timestamp: new Date().toISOString(),
      },
    });
  }
);