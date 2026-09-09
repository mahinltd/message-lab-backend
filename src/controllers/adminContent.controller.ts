import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { SiteContent } from "../models/SiteContent";
import { ApiError } from "../utils/ApiError";
import { SecurityService } from "../services/security.service";
import { updateContentSchema } from "../validators/admin.validator";
import { invalidateCache } from "../services/publicContent.service";
import { Request as ExpressRequest } from "express";

/**
 * Get all site content grouped by category.
 * GET /api/v1/admin/content
 */
export const getAllContent = asyncHandler(
  async (req: Request, res: Response) => {
    const category = req.query.category as string | undefined;
    const isActive = req.query.isActive as string | undefined;

    const filter: any = {};
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const contents = await SiteContent.find(filter)
      .sort({ category: 1, key: 1 })
      .lean();

    // Group by category
    const grouped: Record<string, any[]> = {};
    for (const content of contents) {
      if (!grouped[content.category]) {
        grouped[content.category] = [];
      }
      grouped[content.category].push(content);
    }

    res.status(200).json({
      success: true,
      data: {
        contents,
        grouped,
        total: contents.length,
      },
    });
  }
);

/**
 * Get a single content by key.
 * GET /api/v1/admin/content/:key
 */
export const getContentByKey = asyncHandler(
  async (req: Request, res: Response) => {
    const key = String(req.params.key).toLowerCase().trim();

    const content = await SiteContent.findOne({ key }).lean();

    if (!content) {
      throw ApiError.notFound("Content not found");
    }

    res.status(200).json({
      success: true,
      data: { content },
    });
  }
);

/**
 * Create or update site content (upsert).
 * POST /api/v1/admin/content
 */
export const upsertContent = asyncHandler(
  async (req: Request, res: Response) => {
    const validatedData = updateContentSchema.parse(req.body);

    const content = await SiteContent.findOneAndUpdate(
      { key: validatedData.key },
      {
        $set: {
          category: validatedData.category,
          title: validatedData.title ?? null,
          body: validatedData.body ?? null,
          metadata: validatedData.metadata ?? {},
          isActive: validatedData.isActive ?? true,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    // Invalidate public content cache
    invalidateCache();

    await SecurityService.recordAuditLog({
      userId: (req as any).user?.userId,
      action: "SITE_CONTENT_UPDATED",
      entityType: "SiteContent",
      entityId: content._id.toString(),
      req: req as ExpressRequest,
      metadata: { key: content.key, category: content.category },
    });

    res.status(200).json({
      success: true,
      message: "Content saved successfully",
      data: { content },
    });
  }
);

/**
 * Delete site content.
 * DELETE /api/v1/admin/content/:key
 */
export const deleteContent = asyncHandler(
  async (req: Request, res: Response) => {
    const key = String(req.params.key).toLowerCase().trim();

    const content = await SiteContent.findOneAndDelete({ key });

    if (!content) {
      throw ApiError.notFound("Content not found");
    }

    // Invalidate public content cache
    invalidateCache();

    await SecurityService.recordAuditLog({
      userId: (req as any).user?.userId,
      action: "SITE_CONTENT_DELETED",
      entityType: "SiteContent",
      entityId: content._id.toString(),
      req: req as ExpressRequest,
      metadata: { key: content.key },
    });

    res.status(200).json({
      success: true,
      message: "Content deleted successfully",
    });
  }
);