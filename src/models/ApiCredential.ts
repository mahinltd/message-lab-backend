import mongoose, { Document, Schema } from "mongoose";

export interface IApiCredential extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  keyPrefix: string;
  keyHash: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const apiCredentialSchema = new Schema<IApiCredential>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    keyPrefix: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true, unique: true },
    permissions: [{ type: String }],
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

apiCredentialSchema.index({ userId: 1, isActive: 1 });

export const ApiCredential = mongoose.model<IApiCredential>("ApiCredential", apiCredentialSchema);