import mongoose from "mongoose";
import { PaymentSubmission } from "../models/PaymentSubmission";
import { PlanConfig } from "../models/PlanConfig";
import { User } from "../models/User";
import { ApiError } from "../utils/ApiError";
import { SecurityService } from "./security.service";
import { SubscriptionService } from "./subscription.service";
import { EmailService } from "./email.service";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { Request } from "express";
import { SubmitPaymentInput, ReviewPaymentInput } from "../validators/payment.validator";

const MAX_PENDING_PAYMENTS_PER_USER = 3;

export class PaymentService {
  /**
   * Submit a new payment for review.
   * Validates plan, checks for duplicate transaction IDs,
   * and enforces submission limits.
   */
  static async submitPayment(
    userId: string,
    input: SubmitPaymentInput,
    req: Request
  ): Promise<any> {
    // Verify plan exists and is active
    const plan = await PlanConfig.findOne({
      planId: input.planId.toLowerCase(),
      isActive: true,
    });

    if (!plan) {
      throw ApiError.notFound("Selected plan not found or inactive");
    }

    // Free plan does not require payment
    if (plan.priceMonthly === 0) {
      throw ApiError.badRequest(
        "The Free plan does not require payment. You are already on the Free plan."
      );
    }

    // Check pending payment limit
    const pendingCount = await PaymentSubmission.countDocuments({
      userId,
      status: { $in: ["pending", "under_review"] },
    });

    if (pendingCount >= MAX_PENDING_PAYMENTS_PER_USER) {
      throw ApiError.tooManyRequests(
        `You already have ${pendingCount} payment(s) under review. Please wait for them to be processed before submitting a new one.`
      );
    }

    // Check for duplicate transaction ID
    const existingTx = await PaymentSubmission.findOne({
      transactionId: input.transactionId,
      status: { $ne: "rejected" },
    });

    if (existingTx) {
      await SecurityService.recordSecurityEvent({
        eventType: "DUPLICATE_TRANSACTION_ID",
        severity: "high",
        req,
        userId: new mongoose.Types.ObjectId(userId),
        description: `Duplicate transaction ID detected: ${input.transactionId}`,
      });

      throw ApiError.conflict(
        "This transaction ID has already been submitted. If you believe this is an error, contact support."
      );
    }

    // Create payment submission
    const payment = await PaymentSubmission.create({
      userId,
      planId: plan.planId,
      amount: input.amount,
      currency: plan.currency,
      paymentMethod: input.paymentMethod,
      senderNumber: input.senderNumber,
      transactionId: input.transactionId,
      note: input.note || undefined,
      status: "pending",
    });

    // Audit log
    await SecurityService.recordAuditLog({
      userId: new mongoose.Types.ObjectId(userId),
      action: "PAYMENT_SUBMITTED",
      entityType: "PaymentSubmission",
      entityId: payment._id.toString(),
      req,
      metadata: {
        planId: input.planId,
        amount: input.amount,
        method: input.paymentMethod,
        transactionId: input.transactionId,
      },
    });

    logger.info("Payment submitted", {
      userId,
      paymentId: payment._id.toString(),
      planId: input.planId,
      amount: input.amount,
      method: input.paymentMethod,
    });

    return payment;
  }

  /**
   * Review a payment submission (admin action).
   * Approve: activate subscription + send email.
   * Reject: send rejection email.
   */
  static async reviewPayment(
    adminUserId: string,
    input: ReviewPaymentInput,
    req: Request
  ): Promise<any> {
    const payment = await PaymentSubmission.findById(input.paymentId);

    if (!payment) {
      throw ApiError.notFound("Payment submission not found");
    }

    if (payment.status === "approved" || payment.status === "rejected") {
      throw ApiError.badRequest(
        `Payment has already been ${payment.status}. Cannot review again.`
      );
    }

    // Mark as under review
    payment.status = "under_review";
    payment.reviewedBy = new mongoose.Types.ObjectId(adminUserId);
    await payment.save();

    if (input.action === "approve") {
      // Activate subscription
      const durationDays = input.subscriptionDurationDays || 30;

      const subscription = await SubscriptionService.activateSubscription(
        payment.userId.toString(),
        payment.planId,
        payment._id.toString(),
        durationDays
      );

      // Update payment status
      payment.status = "approved";
      payment.reviewedAt = new Date();
      payment.reviewNote = input.reviewNote || undefined;
      payment.subscriptionId = subscription._id;
      await payment.save();

      // Send approval email
      const user = await User.findById(payment.userId);
      if (user) {
        const plan = await PlanConfig.findOne({ planId: payment.planId });

        await EmailService.sendPaymentUpdateEmail(
          user.email,
          user.name,
          "approved",
          plan?.displayName || payment.planId,
          `${payment.currency} ${payment.amount}`,
          payment.paymentMethod,
          payment.transactionId,
          payment.createdAt.toISOString(),
          undefined,
          `${env.FRONTEND_URL}/dashboard/billing`
        );
      }

      // Audit log
      await SecurityService.recordAuditLog({
        userId: new mongoose.Types.ObjectId(adminUserId),
        action: "PAYMENT_APPROVED",
        entityType: "PaymentSubmission",
        entityId: payment._id.toString(),
        req,
        metadata: {
          targetUserId: payment.userId.toString(),
          planId: payment.planId,
          amount: payment.amount,
        },
      });

      logger.info("Payment approved", {
        paymentId: payment._id.toString(),
        userId: payment.userId.toString(),
        planId: payment.planId,
      });

      return payment;
    } else {
      // Reject payment
      payment.status = "rejected";
      payment.reviewedAt = new Date();
      payment.reviewNote = input.reviewNote || undefined;
      payment.rejectionReason =
        input.rejectionReason || "Payment could not be verified";
      await payment.save();

      // Send rejection email
      const user = await User.findById(payment.userId);
      if (user) {
        const plan = await PlanConfig.findOne({ planId: payment.planId });

        await EmailService.sendPaymentUpdateEmail(
          user.email,
          user.name,
          "rejected",
          plan?.displayName || payment.planId,
          `${payment.currency} ${payment.amount}`,
          payment.paymentMethod,
          payment.transactionId,
          payment.createdAt.toISOString(),
          payment.rejectionReason,
          `${env.FRONTEND_URL}/dashboard/billing`
        );
      }

      // Audit log
      await SecurityService.recordAuditLog({
        userId: new mongoose.Types.ObjectId(adminUserId),
        action: "PAYMENT_REJECTED",
        entityType: "PaymentSubmission",
        entityId: payment._id.toString(),
        req,
        metadata: {
          targetUserId: payment.userId.toString(),
          reason: payment.rejectionReason,
        },
      });

      logger.info("Payment rejected", {
        paymentId: payment._id.toString(),
        userId: payment.userId.toString(),
        reason: payment.rejectionReason,
      });

      return payment;
    }
  }

  /**
   * Get all payment submissions for a user.
   */
  static async getUserPayments(userId: string): Promise<any[]> {
    return PaymentSubmission.find({ userId })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get a specific payment by ID (with ownership check).
   */
  static async getPaymentById(
    userId: string,
    paymentId: string
  ): Promise<any> {
    const payment = await PaymentSubmission.findOne({
      _id: paymentId,
      userId,
    }).lean();

    if (!payment) {
      throw ApiError.notFound("Payment not found");
    }

    return payment;
  }

  /**
   * Get all payments (admin).
   */
  static async getAllPayments(
    page: number = 1,
    limit: number = 20,
    status?: string
  ): Promise<{ payments: any[]; total: number }> {
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (status) filter.status = status;

    const [payments, total] = await Promise.all([
      PaymentSubmission.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email")
        .lean(),
      PaymentSubmission.countDocuments(filter),
    ]);

    return { payments, total };
  }
}