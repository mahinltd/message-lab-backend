import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { createApiCredential, getDeveloperUsage, listApiCredentials, revokeApiCredential } from "../controllers/apiCredential.controller";

const router = Router();
router.use(authenticate);
router.get("/api-keys", listApiCredentials);
router.post("/api-keys", createApiCredential);
router.delete("/api-keys/:credentialId", revokeApiCredential);
router.get("/usage", getDeveloperUsage);

export default router;