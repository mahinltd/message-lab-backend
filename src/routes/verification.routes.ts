import { Router } from "express";
import { verifyEmail, resendVerificationEmail } from "../controllers/verification.controller";
import { authRateLimiter } from "../middleware/authRateLimit.middleware";

const router = Router();

// Apply auth rate limiter to prevent abuse
router.use(authRateLimiter);

router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);

export default router;