import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  submitPayment,
  getMyPayments,
  getPaymentById,
  getMySubscription,
  getSubscriptionHistory,
  getAvailablePlans,
} from "../controllers/payment.controller";

const router = Router();

// All payment routes require user authentication
router.use(authenticate);

// Plans (public info but requires auth)
router.get("/plans", getAvailablePlans);

// Subscription
router.get("/subscription", getMySubscription);
router.get("/subscription/history", getSubscriptionHistory);

// Payments
router.post("/submit", submitPayment);
router.get("/", getMyPayments);
router.get("/:paymentId", getPaymentById);

export default router;