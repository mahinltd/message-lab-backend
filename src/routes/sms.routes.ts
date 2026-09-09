import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  sendBulkSms,
  getMyCampaigns,
  getCampaign,
  getCampaignJobs,
  cancelCampaign,
  getInbox,
  getInboxUnreadCount,
  markInboxRead,
  markAllInboxRead,
} from "../controllers/sms.controller";

const router = Router();

router.use(authenticate);

// Campaigns
router.post("/bulk", sendBulkSms);
router.get("/campaigns", getMyCampaigns);
router.get("/campaigns/:campaignId", getCampaign);
router.get("/campaigns/:campaignId/jobs", getCampaignJobs);
router.post("/campaigns/:campaignId/cancel", cancelCampaign);

// Inbox (incoming SMS)
router.get("/inbox", getInbox);
router.get("/inbox/unread-count", getInboxUnreadCount);
router.post("/inbox/read-all", markAllInboxRead);
router.post("/inbox/:id/read", markInboxRead);

export default router;