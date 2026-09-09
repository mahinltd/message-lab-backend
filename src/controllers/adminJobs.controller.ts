import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { jobRunner } from "../services/jobRunner.service";

/**
 * Get status of all scheduled jobs.
 * GET /api/v1/admin/jobs
 */
export const getJobStatuses = asyncHandler(
  async (_req: Request, res: Response) => {
    const statuses = jobRunner.getJobStatuses();

    res.status(200).json({
      success: true,
      data: {
        jobs: statuses,
        total: statuses.length,
      },
    });
  }
);

/**
 * Get recent job execution logs.
 * GET /api/v1/admin/jobs/logs
 */
export const getJobLogs = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const logs = jobRunner.getExecutionLogs(limit);

    res.status(200).json({
      success: true,
      data: {
        logs,
        total: logs.length,
      },
    });
  }
);

/**
 * Manually trigger a job.
 * POST /api/v1/admin/jobs/:jobName/trigger
 */
export const triggerJob = asyncHandler(
  async (req: Request, res: Response) => {
    const jobName = String(req.params.jobName);

    const result = await jobRunner.triggerJob(jobName);

    if (!result) {
      res.status(404).json({
        success: false,
        message: `Job "${jobName}" not found`,
      });
      return;
    }

    res.status(200).json({
      success: result.success,
      message: result.message,
      data: {
        jobName,
        result,
      },
    });
  }
);