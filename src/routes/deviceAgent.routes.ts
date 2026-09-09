import { Router } from "express";
import { pairDevice } from "../controllers/deviceAgent.controller";
import { authenticateDevice } from "../middleware/deviceAuth.middleware";
import {
  sendHeartbeat,
  getDeviceStatus,
  selfDisconnect,
} from "../controllers/deviceAgent.controller";
import {
  fetchNextJob,
  reportJobStatus,
  reportIncomingSms,
  getQueueStatus,
} from "../controllers/deviceAgentSms.controller";

const router = Router();

// Pairing is public (uses 6-digit code or QR)
router.post("/pair", pairDevice);

// All routes below require a valid device token
router.use(authenticateDevice);

// Device management
router.post("/heartbeat", sendHeartbeat);
router.get("/status", getDeviceStatus);
router.post("/disconnect", selfDisconnect);

// SMS job processing
router.get("/sms/next", fetchNextJob);
router.post("/sms/report", reportJobStatus);
router.post("/sms/incoming", reportIncomingSms);
router.get("/sms/queue-status", getQueueStatus);

export default router;