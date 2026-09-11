import { Router } from "express";
import {
  register,
  login,
  googleLogin,
  logout,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword,
} from "../controllers/auth.controller";
import {
  verifyEmail,
  resendVerificationEmail,
} from "../controllers/verification.controller";
import { refreshTokens } from "../controllers/token.controller";
import { getCurrentUser } from "../controllers/user.controller";
import {
  forgotLimiter,
  refreshLimiter,
  registerLimiter,
} from "../middleware/authRateLimit.middleware";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", registerLimiter, register);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);
router.post("/forgot-password", forgotLimiter, forgotPassword);
router.post("/reset-password", forgotLimiter, resetPassword);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/refresh", refreshLimiter, refreshTokens);
router.post("/logout", logout);

// Protected routes — apply authenticate but DO NOT apply authRateLimiter strictly
// We use a separate router to avoid rate limiting on /me, /profile, /change-password
const protectedRouter = Router();
protectedRouter.use(authenticate);
protectedRouter.get("/me", getCurrentUser);
protectedRouter.put("/profile", updateProfile);
protectedRouter.put("/change-password", changePassword);

router.use(protectedRouter);

export default router;