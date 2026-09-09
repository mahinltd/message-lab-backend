import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { PlanConfig } from "../models/PlanConfig";
import { ApiError } from "../utils/ApiError";
import { SecurityService } from "../services/security.service";
import { updatePlanSchema } from "../validators/admin.validator";
import { Request as ExpressRequest } from "express";

/**
 * Get all plans.
 * GET /api/v1/admin/plans
 */
export const getAllPlans = asyncHandler(
  async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === "true";

    const filter: any = {};
    if (!includeInactive) filter.isActive = true;

    const plans = await PlanConfig.find(filter)
      .sort({ sortOrder: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        plans,
        total: plans.length,
      },
    });
  }
);

/**
 * Get a single plan by planId.
 * GET /api/v1/admin/plans/:planId
 */
export const getPlanById = asyncHandler(
  async (req: Request, res: Response) => {
    const planId = String(req.params.planId).toLowerCase().trim();

    const plan = await PlanConfig.findOne({ planId }).lean();

    if (!plan) {
      throw ApiError.notFound("Plan not found");
    }

    res.status(200).json({
      success: true,
      data: { plan },
    });
  }
);

/**
 * Create or update a plan (upsert).
 * POST /api/v1/admin/plans
 */
export const upsertPlan = asyncHandler(
  async (req: Request, res: Response) => {
    const validatedData = updatePlanSchema.parse(req.body);

    const plan = await PlanConfig.findOneAndUpdate(
      { planId: validatedData.planId },
      {
        $set: {
          name: validatedData.name,
          displayName: validatedData.displayName,
          description: validatedData.description ?? null,
          priceMonthly: validatedData.priceMonthly,
          priceYearly: validatedData.priceYearly ?? 0,
          currency: validatedData.currency ?? "BDT",
          maxRecipientsPerCampaign: validatedData.maxRecipientsPerCampaign,
          maxDailyMessages: validatedData.maxDailyMessages,
          maxDevices: validatedData.maxDevices ?? 1,
          minSmsDelayMs: validatedData.minSmsDelayMs ?? 3000,
          features: validatedData.features ?? [],
          isActive: validatedData.isActive ?? true,
          sortOrder: validatedData.sortOrder ?? 0,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    await SecurityService.recordAuditLog({
      userId: (req as any).user?.userId,
      action: "PLAN_CONFIG_UPDATED",
      entityType: "PlanConfig",
      entityId: plan._id.toString(),
      req: req as ExpressRequest,
      metadata: {
        planId: plan.planId,
        name: plan.name,
        maxRecipients: plan.maxRecipientsPerCampaign,
      },
    });

    res.status(200).json({
      success: true,
      message: "Plan saved successfully",
      data: { plan },
    });
  }
);

/**
 * Toggle plan active status.
 * PATCH /api/v1/admin/plans/:planId/toggle
 */
export const togglePlanStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const planId = String(req.params.planId).toLowerCase().trim();

    const plan = await PlanConfig.findOne({ planId });

    if (!plan) {
      throw ApiError.notFound("Plan not found");
    }

    plan.isActive = !plan.isActive;
    await plan.save();

    await SecurityService.recordAuditLog({
      userId: (req as any).user?.userId,
      action: plan.isActive ? "PLAN_ACTIVATED" : "PLAN_DEACTIVATED",
      entityType: "PlanConfig",
      entityId: plan._id.toString(),
      req: req as ExpressRequest,
    });

    res.status(200).json({
      success: true,
      message: `Plan ${plan.isActive ? "activated" : "deactivated"} successfully`,
      data: { plan },
    });
  }
);

/**
 * Delete a plan.
 * DELETE /api/v1/admin/plans/:planId
 */
export const deletePlan = asyncHandler(
  async (req: Request, res: Response) => {
    const planId = String(req.params.planId).toLowerCase().trim();

    const plan = await PlanConfig.findOneAndDelete({ planId });

    if (!plan) {
      throw ApiError.notFound("Plan not found");
    }

    await SecurityService.recordAuditLog({
      userId: (req as any).user?.userId,
      action: "PLAN_DELETED",
      entityType: "PlanConfig",
      entityId: plan._id.toString(),
      req: req as ExpressRequest,
    });

    res.status(200).json({
      success: true,
      message: "Plan deleted successfully",
    });
  }
);