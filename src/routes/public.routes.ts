import { Router } from "express";
import {
  getFullPageContent,
  getHeroContent,
  getHeaderContent,
  getFooterContent,
  getAnnouncement,
  getFeatureContent,
  getPublicPricing,
  getPublicStatus,
} from "../controllers/publicContent.controller";

const router = Router();

/**
 * Public routes - no authentication required.
 * These endpoints serve content to the frontend website.
 * Rate limited by the global rate limiter in app.ts.
 */

router.get("/content", getFullPageContent);
router.get("/content/hero", getHeroContent);
router.get("/content/header", getHeaderContent);
router.get("/content/footer", getFooterContent);
router.get("/content/announcement", getAnnouncement);
router.get("/content/features", getFeatureContent);
router.get("/pricing", getPublicPricing);
router.get("/status", getPublicStatus);

export default router;