import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { PaymentService } from "../services/payment.service";
import { reviewPaymentSchema } from "../validators/payment.validator";
import { ApiError } from "../utils/ApiError";

/**
 * Get all payment submissions (admin).
 * GET /api/v1/admin/payments
 */
export const getAllPayments = asyncHandler(
  async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;

    const result = await PaymentService.getAllPayments(page, limit, status);

    res.status(200).json({
      success: true,
      data: {
        payments: result.payments,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit),
        },
      },
    });
  }
);

/**
 * Review a payment submission (approve or reject).
 * POST /api/v1/admin/payments/review
 */
export const reviewPayment = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const validatedData = reviewPaymentSchema.parse(req.body);

    const payment = await PaymentService.reviewPayment(
      req.user.userId,
      validatedData,
      req
    );

    const actionText =
      validatedData.action === "approve"
        ? "Payment approved and subscription activated"
        : "Payment rejected";

    res.status(200).json({
      success: true,
      message: actionText,
      data: { payment },
    });
  }
);

/**
 * Get payment statistics (admin dashboard).
 * GET /api/v1/admin/payments/stats
 */
export const getPaymentStats = asyncHandler(
  async (_req: Request, res: Response) => {
    const { PaymentSubmission } = await import("../models/PaymentSubmission");

    const [pending, underReview, approved, rejected] = await Promise.all([
      PaymentSubmission.countDocuments({ status: "pending" }),
      PaymentSubmission.countDocuments({ status: "under_review" }),
      PaymentSubmission.countDocuments({ status: "approved" }),
      PaymentSubmission.countDocuments({ status: "rejected" }),
    ]);

    const totalRevenue = await PaymentSubmission.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        pending,
        underReview,
        approved,
        rejected,
        totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
      },
    });
  }
);