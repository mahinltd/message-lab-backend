import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { getAuditLogs, getSecurityEvents } from "../controllers/security.controller";
import {
  getAllContent,
  getContentByKey,
  upsertContent,
  deleteContent,
} from "../controllers/adminContent.controller";
import {
  getAllPlans,
  getPlanById,
  upsertPlan,
  togglePlanStatus,
  deletePlan,
} from "../controllers/adminPlan.controller";
import {
  getAllSettings,
  getSettingByKey,
  upsertSetting,
  deleteSetting,
  bulkUpdateSettings,
} from "../controllers/adminSettings.controller";
import {
  getAllPayments,
  reviewPayment,
  getPaymentStats,
} from "../controllers/adminPayment.controller";
import {
  getJobStatuses,
  getJobLogs,
  triggerJob,
} from "../controllers/adminJobs.controller";
import {
  getAllUsers,
  getUserDetails,
  updateUserRole,
  updateUserStatus,
  verifyUserEmail,
  getUserStats,
  getRecentRegistrations,
} from "../controllers/adminUser.controller";
import { seedDefaultContent } from "../seed/defaultContent";
import { asyncHandler } from "../utils/asyncHandler";
import { Request, Response } from "express";

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(requireRole("admin"));

// --- Security logs ---
router.get("/security/audit-logs", getAuditLogs);
router.get("/security/security-events", getSecurityEvents);

// --- User management ---
router.get("/users/stats", getUserStats);
router.get("/users/recent", getRecentRegistrations);
router.get("/users", getAllUsers);
router.get("/users/:userId", getUserDetails);
router.patch("/users/:userId/role", updateUserRole);
router.patch("/users/:userId/status", updateUserStatus);
router.post("/users/:userId/verify-email", verifyUserEmail);

// --- Site content management ---
router.get("/content", getAllContent);
router.get("/content/:key", getContentByKey);
router.post("/content", upsertContent);
router.delete("/content/:key", deleteContent);

// --- Plan configuration ---
router.get("/plans", getAllPlans);
router.get("/plans/:planId", getPlanById);
router.post("/plans", upsertPlan);
router.patch("/plans/:planId/toggle", togglePlanStatus);
router.delete("/plans/:planId", deletePlan);

// --- Platform settings ---
router.get("/settings", getAllSettings);
router.get("/settings/:key", getSettingByKey);
router.post("/settings", upsertSetting);
router.post("/settings/bulk", bulkUpdateSettings);
router.delete("/settings/:key", deleteSetting);

// --- Payment management ---
router.get("/payments", getAllPayments);
router.get("/payments/stats", getPaymentStats);
router.post("/payments/review", reviewPayment);

// --- Scheduled jobs ---
router.get("/jobs", getJobStatuses);
router.get("/jobs/logs", getJobLogs);
router.post("/jobs/:jobName/trigger", triggerJob);

// --- Seed ---
router.post(
  "/seed",
  asyncHandler(async (_req: Request, res: Response) => {
    await seedDefaultContent();
    res.status(200).json({
      success: true,
      message: "Default content seeded successfully",
    });
  })
);

export default router;