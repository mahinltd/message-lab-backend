import { OAuth2Client } from "google-auth-library";
import { Request } from "express";
import { User, IUser } from "../models/User";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { hashPassword, comparePassword } from "../utils/password";
import { signAccessToken, signRefreshToken, TokenPayload } from "../utils/jwt";
import { SecurityService } from "./security.service";
import { VerificationService } from "./verification.service";
import { RegisterInput, LoginInput } from "../validators/auth.validator";

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

function generateTokens(user: IUser) {
  const payload: TokenPayload = {
    userId: user._id.toString(),
    role: user.role,
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

function buildUserResponse(user: IUser) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile || null,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    profilePicture: user.profilePicture || null,
  };
}

export class AuthService {
  static async register(data: RegisterInput, req: Request) {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw ApiError.conflict("An account with this email already exists");
    }

    const passwordHash = await hashPassword(data.password);

    const newUser = await User.create({
      name: data.name,
      email: data.email,
      mobile: data.mobile || undefined,
      passwordHash,
      authProviders: { local: true },
      isEmailVerified: false,
    });

    // Send verification email
    await VerificationService.sendEmailVerification(newUser._id, req);

    await SecurityService.recordAuditLog({
      userId: newUser._id,
      action: "USER_REGISTERED",
      entityType: "User",
      entityId: newUser._id.toString(),
      req,
      metadata: { provider: "local" },
    });

    // Do NOT issue tokens yet - user must verify email first
    return {
      user: buildUserResponse(newUser),
      requiresVerification: true,
    };
  }

  static async login(data: LoginInput, req: Request) {
    const user = await User.findOne({ email: data.email });

    if (!user || !user.passwordHash || !user.authProviders.local) {
      await SecurityService.recordSecurityEvent({
        eventType: "FAILED_LOGIN",
        severity: "medium",
        req,
        description: `Failed login attempt for email: ${data.email}`,
      });
      throw ApiError.unauthorized("Invalid email or password");
    }

    if (user.isAccountDisabled) {
      throw ApiError.forbidden("Your account has been disabled. Please contact support.");
    }

    // Block login if email is not verified
    if (!user.isEmailVerified) {
      await SecurityService.recordSecurityEvent({
        eventType: "LOGIN_BLOCKED_UNVERIFIED",
        severity: "low",
        req,
        userId: user._id,
        description: `Login blocked for unverified email: ${data.email}`,
      });

      throw ApiError.forbidden(
        "Your email has not been verified yet. Please check your inbox for the verification link, or request a new one."
      );
    }

    const isPasswordValid = await comparePassword(data.password, user.passwordHash);

    if (!isPasswordValid) {
      await SecurityService.recordSecurityEvent({
        eventType: "FAILED_LOGIN",
        severity: "medium",
        req,
        userId: user._id,
        description: `Invalid password attempt for user: ${user.email}`,
      });
      throw ApiError.unauthorized("Invalid email or password");
    }

    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    await user.save();

    await SecurityService.recordAuditLog({
      userId: user._id,
      action: "USER_LOGIN",
      entityType: "User",
      entityId: user._id.toString(),
      req,
      metadata: { provider: "local" },
    });

    const tokens = generateTokens(user);

    return {
      user: buildUserResponse(user),
      requiresVerification: false,
      ...tokens,
    };
  }

  static async handleGoogleLogin(idToken: string, req: Request) {
    if (!googleClient) {
      throw ApiError.internal("Google OAuth is not configured on the server");
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (error) {
      throw ApiError.unauthorized("Invalid or expired Google ID token");
    }

    if (!payload || !payload.email) {
      throw ApiError.badRequest("Could not retrieve email from Google account");
    }

    const { email, name, picture, sub: googleId } = payload;

    let user = await User.findOne({ email });

    if (user) {
      // Link Google if not already linked
      if (!user.authProviders.google) {
        user.authProviders.google = true;
        user.authProviders.googleId = googleId;
      }
    } else {
      // Create new account - Google emails are pre-verified
      user = await User.create({
        name: name || "Google User",
        email,
        profilePicture: picture,
        isEmailVerified: true,
        authProviders: {
          google: true,
          googleId,
          local: false,
        },
      });

      await SecurityService.recordAuditLog({
        userId: user._id,
        action: "USER_REGISTERED",
        entityType: "User",
        entityId: user._id.toString(),
        req,
        metadata: { provider: "google" },
      });
    }

    if (user.isAccountDisabled) {
      throw ApiError.forbidden("Your account has been disabled. Please contact support.");
    }

    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    await user.save();

    await SecurityService.recordAuditLog({
      userId: user._id,
      action: "USER_LOGIN",
      entityType: "User",
      entityId: user._id.toString(),
      req,
      metadata: { provider: "google" },
    });

    const tokens = generateTokens(user);

    return {
      user: buildUserResponse(user),
      requiresVerification: false,
      ...tokens,
    };
  }
}