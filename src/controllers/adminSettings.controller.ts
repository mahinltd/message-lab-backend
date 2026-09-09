import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { PlatformSettings } from "../models/PlatformSettings";
import { ApiError } from "../utils/ApiError";
import { SecurityService } from "../services/security.service";
import { updateSettingSchema } from "../validators/admin.validator";
import { Request as ExpressRequest } from "express";

/**
 * Get all platform settings.
 * GET /api/v1/admin/settings
 */
export const getAllSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const category = req.query.category as string | undefined;

    const filter: any = {};
    if (category) filter.category = category;

    const settings = await PlatformSettings.find(filter)
      .sort({ category: 1, key: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        settings,
        total: settings.length,
      },
    });
  }
);

/**
 * Get a single setting by key.
 * GET /api/v1/admin/settings/:key
 */
export const getSettingByKey = asyncHandler(
  async (req: Request, res: Response) => {
    const key = String(req.params.key).toLowerCase().trim();

    const setting = await PlatformSettings.findOne({ key }).lean();

    if (!setting) {
      throw ApiError.notFound("Setting not found");
    }

    res.status(200).json({
      success: true,
      data: { setting },
    });
  }
);

/**
 * Create or update a setting (upsert).
 * POST /api/v1/admin/settings
 */
export const upsertSetting = asyncHandler(
  async (req: Request, res: Response) => {
    const validatedData = updateSettingSchema.parse(req.body);

    const setting = await PlatformSettings.findOneAndUpdate(
      { key: validatedData.key },
      {
        $set: {
          value: validatedData.value,
          valueType: validatedData.valueType ?? "string",
          description: validatedData.description ?? null,
          category: validatedData.category,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    await SecurityService.recordAuditLog({
      userId: (req as any).user?.userId,
      action: "PLATFORM_SETTING_UPDATED",
      entityType: "PlatformSettings",
      entityId: setting._id.toString(),
      req: req as ExpressRequest,
      metadata: { key: setting.key, category: setting.category },
    });

    res.status(200).json({
      success: true,
      message: "Setting saved successfully",
      data: { setting },
    });
  }
);

/**
 * Delete a setting.
 * DELETE /api/v1/admin/settings/:key
 */
export const deleteSetting = asyncHandler(
  async (req: Request, res: Response) => {
    const key = String(req.params.key).toLowerCase().trim();

    const setting = await PlatformSettings.findOneAndDelete({ key });

    if (!setting) {
      throw ApiError.notFound("Setting not found");
    }

    await SecurityService.recordAuditLog({
      userId: (req as any).user?.userId,
      action: "PLATFORM_SETTING_DELETED",
      entityType: "PlatformSettings",
      entityId: setting._id.toString(),
      req: req as ExpressRequest,
    });

    res.status(200).json({
      success: true,
      message: "Setting deleted successfully",
    });
  }
);

/**
 * Bulk update multiple settings at once.
 * POST /api/v1/admin/settings/bulk
 */
export const bulkUpdateSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const settingsArray = req.body.settings;

    if (!Array.isArray(settingsArray)) {
      throw ApiError.badRequest("Request body must contain a 'settings' array");
    }

    const results = [];

    for (const item of settingsArray) {
      const validatedData = updateSettingSchema.parse(item);

      const setting = await PlatformSettings.findOneAndUpdate(
        { key: validatedData.key },
        {
          $set: {
            value: validatedData.value,
            valueType: validatedData.valueType ?? "string",
            description: validatedData.description ?? null,
            category: validatedData.category,
          },
        },
        { new: true, upsert: true, runValidators: true }
      );

      results.push(setting);
    }

    await SecurityService.recordAuditLog({
      userId: (req as any).user?.userId,
      action: "PLATFORM_SETTINGS_BULK_UPDATED",
      entityType: "PlatformSettings",
      req: req as ExpressRequest,
      metadata: { count: results.length },
    });

    res.status(200).json({
      success: true,
      message: `${results.length} setting(s) updated successfully`,
      data: { settings: results },
    });
  }
);