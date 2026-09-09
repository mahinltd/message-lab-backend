import { Router } from "express";
import { getAuditLogs, getSecurityEvents } from "../controllers/security.controller";

const router = Router();

// নোট: পরবর্তী সেকশনে আমরা Admin Auth Middleware যুক্ত করব, 
// যা এই রুটগুলোকে সাধারণ ইউজারদের অ্যাক্সেস থেকে প্রটেক্ট করবে।
router.get("/audit-logs", getAuditLogs);
router.get("/security-events", getSecurityEvents);

export default router;