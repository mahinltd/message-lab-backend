import { Router } from "express";
import { authenticateApiKey } from "../middleware/apiKey.middleware";
import { createOtp, getOtpStatus, resendOtp, verifyOtp } from "../controllers/otp.controller";

const router = Router();
router.use(authenticateApiKey);
router.post("/verifications", createOtp);
router.post("/verifications/verify", verifyOtp);
router.post("/verifications/:requestId/resend", resendOtp);
router.get("/verifications/:requestId", getOtpStatus);

export default router;