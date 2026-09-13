import mongoose from "mongoose";
import { SmsDailyUsage } from "../models/SmsDailyUsage";
import { ApiError } from "../utils/ApiError";

function currentDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export class SmsUsageService {
  static async reserve(userId: string, amount: number, dailyLimit: number): Promise<void> {
    if (amount <= 0) return;
    const objectId = new mongoose.Types.ObjectId(userId);
    const day = currentDay();

    try {
      const updated = await SmsDailyUsage.findOneAndUpdate(
        {
          userId: objectId,
          day,
          $expr: { $lte: [{ $add: ["$messageCount", amount] }, dailyLimit] },
        },
        { $inc: { messageCount: amount } },
        { new: true },
      );
      if (updated) return;

      await SmsDailyUsage.create({ userId: objectId, day, messageCount: amount });
    } catch (error: unknown) {
      if ((error as { code?: number })?.code === 11000) {
        const updated = await SmsDailyUsage.findOneAndUpdate(
          {
            userId: objectId,
            day,
            $expr: { $lte: [{ $add: ["$messageCount", amount] }, dailyLimit] },
          },
          { $inc: { messageCount: amount } },
          { new: true },
        );
        if (updated) return;
      }
      throw ApiError.forbidden(`Your daily SMS limit of ${dailyLimit} messages has been reached.`);
    }
  }

  static async release(userId: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    const updated = await SmsDailyUsage.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), day: currentDay(), messageCount: { $gte: amount } },
      { $inc: { messageCount: -amount } },
      { new: true },
    );
    if (updated?.messageCount === 0) await SmsDailyUsage.deleteOne({ _id: updated._id, messageCount: 0 });
  }
}