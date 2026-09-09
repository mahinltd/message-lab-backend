import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  generatePairingCode,
  getMyDevices,
  getDeviceById,
  disconnectDevice,
} from "../controllers/device.controller";

const router = Router();

// All device management routes require user authentication
router.use(authenticate);

router.post("/pairing-code", generatePairingCode);
router.get("/", getMyDevices);
router.get("/:deviceId", getDeviceById);
router.delete("/:deviceId", disconnectDevice);

export default router;