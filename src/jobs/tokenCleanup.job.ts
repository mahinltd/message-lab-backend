import { VerificationToken } from "../models/VerificationToken";
import { DevicePairingCode } from "../models/DevicePairingCode";
import { JobResult } from "../services/jobRunner.service";

/**
 * Token Cleanup Job
 *
 * Removes expired verification tokens and pairing codes
 * that are no longer needed. This keeps the database clean
 * and reduces storage overhead.
 */
export async function runTokenCleanupJob(): Promise<JobResult> {
  try {
    const now = new Date();

    // Delete expired verification tokens
    const tokenResult = await VerificationToken.deleteMany({
      $or: [
        { expiresAt: { $lt: now } },
        { usedAt: { $ne: null } },
      ],
    });

    // Delete expired/used pairing codes
    const pairingResult = await DevicePairingCode.deleteMany({
      $or: [
        { expiresAt: { $lt: now } },
        { usedAt: { $ne: null } },
      ],
    });

    const totalCleaned =
      tokenResult.deletedCount + pairingResult.deletedCount;

    return {
      success: true,
      message: `Cleaned up ${tokenResult.deletedCount} token(s) and ${pairingResult.deletedCount} pairing code(s)`,
      affectedCount: totalCleaned,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return {
      success: false,
      message: "Token cleanup job failed",
      error: errorMessage,
    };
  }
}