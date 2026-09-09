import { SiteContent } from "../models/SiteContent";
import { PlanConfig } from "../models/PlanConfig";
import { logger } from "../utils/logger";

/**
 * In-memory cache for public content.
 * Content rarely changes, so caching reduces database load
 * and improves response time for the frontend.
 */

interface CacheEntry {
  data: any;
  cachedAt: number;
}

const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getFromCache(key: string): any | null {
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache(key: string, data: any): void {
  cache.set(key, {
    data,
    cachedAt: Date.now(),
  });
}

export function invalidateCache(): void {
  cache.clear();
  logger.info("Public content cache invalidated");
}

export class PublicContentService {
  /**
   * Get all hero section content.
   */
  static async getHeroContent(): Promise<any> {
    const cacheKey = "hero_content";
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const heroItems = await SiteContent.find({
      category: "hero",
      isActive: true,
    })
      .select("key title body metadata")
      .lean();

    const hero: Record<string, any> = {};
    for (const item of heroItems) {
      hero[item.key] = {
        title: item.title,
        body: item.body,
        metadata: item.metadata,
      };
    }

    setCache(cacheKey, hero);
    return hero;
  }

  /**
   * Get header content.
   */
  static async getHeaderContent(): Promise<any> {
    const cacheKey = "header_content";
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const headerItems = await SiteContent.find({
      category: "header",
      isActive: true,
    })
      .select("key title body metadata")
      .lean();

    const header: Record<string, any> = {};
    for (const item of headerItems) {
      header[item.key] = {
        title: item.title,
        body: item.body,
        metadata: item.metadata,
      };
    }

    setCache(cacheKey, header);
    return header;
  }

  /**
   * Get footer content.
   */
  static async getFooterContent(): Promise<any> {
    const cacheKey = "footer_content";
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const footerItems = await SiteContent.find({
      category: "footer",
      isActive: true,
    })
      .select("key title body metadata")
      .lean();

    const footer: Record<string, any> = {};
    for (const item of footerItems) {
      footer[item.key] = {
        title: item.title,
        body: item.body,
        metadata: item.metadata,
      };
    }

    setCache(cacheKey, footer);
    return footer;
  }

  /**
   * Get announcement banner (if active).
   */
  static async getAnnouncement(): Promise<any | null> {
    const cacheKey = "announcement";
    const cached = getFromCache(cacheKey);
    if (cached !== null && cached !== undefined) return cached;

    const announcement = await SiteContent.findOne({
      key: "announcement_banner",
      category: "announcement",
      isActive: true,
    })
      .select("key title body metadata")
      .lean();

    const result = announcement
      ? {
          title: announcement.title,
          body: announcement.body,
          metadata: announcement.metadata,
        }
      : null;

    setCache(cacheKey, result);
    return result;
  }

  /**
   * Get feature section content.
   */
  static async getFeatureContent(): Promise<any[]> {
    const cacheKey = "feature_content";
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const features = await SiteContent.find({
      category: "features",
      isActive: true,
    })
      .sort({ key: 1 })
      .select("key title body metadata")
      .lean();

    const result = features.map((f) => ({
      key: f.key,
      title: f.title,
      body: f.body,
      metadata: f.metadata,
    }));

    setCache(cacheKey, result);
    return result;
  }

  /**
   * Get public pricing information (active plans only).
   */
  static async getPublicPricing(): Promise<any> {
    const cacheKey = "public_pricing";
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    // Get pricing section content
    const pricingContent = await SiteContent.find({
      category: "pricing",
      isActive: true,
    })
      .select("key title body metadata")
      .lean();

    const sectionContent: Record<string, any> = {};
    for (const item of pricingContent) {
      sectionContent[item.key] = {
        title: item.title,
        body: item.body,
      };
    }

    // Get active plans
    const plans = await PlanConfig.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .select(
        "planId displayName description priceMonthly priceYearly currency maxRecipientsPerCampaign maxDailyMessages maxDevices features"
      )
      .lean();

    const result = {
      sectionContent,
      plans,
    };

    setCache(cacheKey, result);
    return result;
  }

  /**
   * Get all public site content in one call.
   * Used by the frontend to load the entire page at once.
   */
  static async getFullPageContent(): Promise<any> {
    const [hero, header, footer, announcement, features, pricing] =
      await Promise.all([
        this.getHeroContent(),
        this.getHeaderContent(),
        this.getFooterContent(),
        this.getAnnouncement(),
        this.getFeatureContent(),
        this.getPublicPricing(),
      ]);

    return {
      hero,
      header,
      footer,
      announcement,
      features,
      pricing,
    };
  }
}