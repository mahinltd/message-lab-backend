import { JobResult } from "../services/jobRunner.service";
import { ScheduledSmsService } from "../services/scheduledSms.service";

export async function runScheduledSmsJob(): Promise<JobResult> {
  const affectedCount = await ScheduledSmsService.runDue();
  return { success: true, message: "Scheduled SMS processing completed", affectedCount };
}