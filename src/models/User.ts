import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  mobile?: string;
  passwordHash?: string;
  role: "user" | "admin";
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  isAccountDisabled: boolean;
  profilePicture?: string;
  authProviders: {
    local: boolean;
    google: boolean;
    googleId?: string;
  };
  lastLoginAt?: Date;
  lastLoginIp?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true, 
      trim: true 
    },
    mobile: { type: String, trim: true, default: null },
    passwordHash: { type: String, default: null },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isEmailVerified: { type: Boolean, default: false },
    isMobileVerified: { type: Boolean, default: false },
    isAccountDisabled: { type: Boolean, default: false },
    profilePicture: { type: String, default: null },
    authProviders: {
      local: { type: Boolean, default: false },
      google: { type: Boolean, default: false },
      googleId: { type: String, default: null },
    },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
  },
  { timestamps: true }
);

userSchema.index({ mobile: 1 });
userSchema.index({ "authProviders.googleId": 1 });

export const User = mongoose.model<IUser>("User", userSchema);