import { DeviceService } from "../services/device.service";
import { JobResult } from "../services/jobRunner.service";

/**
 * Device Offline Marker Job
 *
 * Finds devices that have not sent a heartbeat within
 * the configured timeout period and marks them as offline.
 */
export async function runDeviceOfflineMarkerJob(): Promise<JobResult> {
  try {
    const offlineCount = await DeviceService.markStaleDevicesOffline();

    return {
      success: true,
      message: `Marked ${offlineCount} device(s) as offline`,
      affectedCount: offlineCount,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return {
      success: false,
      message: "Device offline marker job failed",
      error: errorMessage,
    };
  }
}