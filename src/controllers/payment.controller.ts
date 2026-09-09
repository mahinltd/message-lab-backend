import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { PaymentService } from "../services/payment.service";
import { SubscriptionService } from "../services/subscription.service";
import { submitPaymentSchema } from "../validators/payment.validator";
import { ApiError } from "../utils/ApiError";

/**
 * Submit a payment for review.
 * POST /api/v1/payments/submit
 */
export const submitPayment = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const validatedData = submitPaymentSchema.parse(req.body);

    const payment = await PaymentService.submitPayment(
      req.user.userId,
      validatedData,
      req
    );

    res.status(201).json({
      success: true,
      message:
        "Payment submitted successfully. Our team will verify it within a few hours.",
      data: {
        paymentId: payment._id,
        status: payment.status,
        planId: payment.planId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        transactionId: payment.transactionId,
        createdAt: payment.createdAt,
      },
    });
  }
);

/**
 * Get all payments for the current user.
 * GET /api/v1/payments
 */
export const getMyPayments = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const payments = await PaymentService.getUserPayments(req.user.userId);

    res.status(200).json({
      success: true,
      data: {
        payments,
        total: payments.length,
      },
    });
  }
);

/**
 * Get a specific payment.
 * GET /api/v1/payments/:paymentId
 */
export const getPaymentById = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const paymentId = String(req.params.paymentId);

    const payment = await PaymentService.getPaymentById(
      req.user.userId,
      paymentId
    );

    res.status(200).json({
      success: true,
      data: { payment },
    });
  }
);

/**
 * Get current subscription status.
 * GET /api/v1/payments/subscription
 */
export const getMySubscription = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const subscription = await SubscriptionService.getActiveSubscription(
      req.user.userId
    );

    const limits = await SubscriptionService.getUserLimits(req.user.userId);

    res.status(200).json({
      success: true,
      data: {
        subscription: subscription || null,
        currentPlan: limits,
      },
    });
  }
);

/**
 * Get subscription history.
 * GET /api/v1/payments/subscription/history
 */
export const getSubscriptionHistory = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    const subscriptions = await SubscriptionService.getUserSubscriptions(
      req.user.userId
    );

    res.status(200).json({
      success: true,
      data: {
        subscriptions,
        total: subscriptions.length,
      },
    });
  }
);

/**
 * Get available plans for purchase.
 * GET /api/v1/payments/plans
 */
export const getAvailablePlans = asyncHandler(
  async (_req: Request, res: Response) => {
    const plans = await SubscriptionService.getPlanConfig("free").catch(() => null);

    // Get all active plans
    const { PlanConfig } = await import("../models/PlanConfig");
    const activePlans = await PlanConfig.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        plans: activePlans,
      },
    });
  }
);