import { logger } from "../utils/logger";
import { SecurityService } from "./security.service";

export interface JobDefinition {
  name: string;
  description: string;
  intervalMs: number;
  handler: () => Promise<JobResult>;
  enabled: boolean;
}

export interface JobResult {
  success: boolean;
  message: string;
  affectedCount?: number;
  durationMs?: number;
  error?: string;
}

export interface JobExecutionLog {
  jobName: string;
  startedAt: Date;
  completedAt?: Date;
  result?: JobResult;
}

/**
 * Central job runner service.
 * Manages scheduled background tasks using setInterval.
 * Tracks execution history and prevents concurrent runs.
 */
class JobRunnerService {
  private jobs: Map<string, NodeJS.Timeout> = new Map();
  private runningJobs: Set<string> = new Set();
  private executionLogs: JobExecutionLog[] = [];
  private maxLogEntries = 100;

  /**
   * Register and start a scheduled job.
   */
  registerJob(job: JobDefinition): void {
    if (!job.enabled) {
      logger.info(`Job "${job.name}" is disabled. Skipping registration.`);
      return;
    }

    // Prevent duplicate registration
    if (this.jobs.has(job.name)) {
      logger.warn(`Job "${job.name}" is already registered. Skipping.`);
      return;
    }

    const interval = setInterval(async () => {
      await this.executeJob(job);
    }, job.intervalMs);

    this.jobs.set(job.name, interval);

    logger.info(`Job "${job.name}" registered with interval ${job.intervalMs}ms`, {
      description: job.description,
    });
  }

  /**
   * Execute a job with concurrency protection.
   */
  private async executeJob(job: JobDefinition): Promise<void> {
    // Prevent concurrent execution of the same job
    if (this.runningJobs.has(job.name)) {
      logger.warn(`Job "${job.name}" is already running. Skipping this cycle.`);
      return;
    }

    this.runningJobs.add(job.name);
    const startedAt = new Date();
    const startTime = Date.now();

    const logEntry: JobExecutionLog = {
      jobName: job.name,
      startedAt,
    };

    try {
      logger.debug(`Job "${job.name}" started`);

      const result = await job.handler();

      result.durationMs = Date.now() - startTime;

      logEntry.completedAt = new Date();
      logEntry.result = result;

      if (result.success) {
        logger.info(`Job "${job.name}" completed`, {
          message: result.message,
          affectedCount: result.affectedCount,
          durationMs: result.durationMs,
        });
      } else {
        logger.warn(`Job "${job.name}" completed with issues`, {
          message: result.message,
          error: result.error,
          durationMs: result.durationMs,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logEntry.completedAt = new Date();
      logEntry.result = {
        success: false,
        message: "Job execution failed",
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };

      logger.error(`Job "${job.name}" failed`, {
        error: errorMessage,
      });
    } finally {
      this.runningJobs.delete(job.name);
      this.addLog(logEntry);
    }
  }

  /**
   * Add execution log entry.
   */
  private addLog(entry: JobExecutionLog): void {
    this.executionLogs.unshift(entry);

    if (this.executionLogs.length > this.maxLogEntries) {
      this.executionLogs = this.executionLogs.slice(0, this.maxLogEntries);
    }
  }

  /**
   * Get recent execution logs.
   */
  getExecutionLogs(limit: number = 20): JobExecutionLog[] {
    return this.executionLogs.slice(0, limit);
  }

  /**
   * Get status of all registered jobs.
   */
  getJobStatuses(): Array<{
    name: string;
    isRunning: boolean;
    lastExecution?: JobExecutionLog;
  }> {
    const statuses: Array<{
      name: string;
      isRunning: boolean;
      lastExecution?: JobExecutionLog;
    }> = [];

    for (const [name] of this.jobs) {
      const lastExecution = this.executionLogs.find(
        (log) => log.jobName === name
      );

      statuses.push({
        name,
        isRunning: this.runningJobs.has(name),
        lastExecution,
      });
    }

    return statuses;
  }

  /**
   * Stop all jobs (for graceful shutdown).
   */
  stopAllJobs(): void {
    for (const [name, interval] of this.jobs) {
      clearInterval(interval);
      logger.info(`Job "${name}" stopped`);
    }
    this.jobs.clear();
  }

  /**
   * Manually trigger a job by name (for admin use).
   */
  async triggerJob(jobName: string): Promise<JobResult | null> {
    if (this.runningJobs.has(jobName)) {
      return {
        success: false,
        message: `Job "${jobName}" is already running`,
      };
    }

    // Find the job definition from registered intervals
    // We need to store job definitions separately for manual trigger
    const jobDef = this.jobDefinitions.get(jobName);
    if (!jobDef) {
      return {
        success: false,
        message: `Job "${jobName}" not found`,
      };
    }

    await this.executeJob(jobDef);

    const lastLog = this.executionLogs.find(
      (log) => log.jobName === jobName
    );

    return lastLog?.result || null;
  }

  private jobDefinitions: Map<string, JobDefinition> = new Map();

  /**
   * Register a job definition (called during registration).
   */
  registerJobDefinition(job: JobDefinition): void {
    this.jobDefinitions.set(job.name, job);
    this.registerJob(job);
  }
}

export const jobRunner = new JobRunnerService();