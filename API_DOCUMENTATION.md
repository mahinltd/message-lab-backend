# Messages Lab — Complete Backend API Documentation
```markdown
# Messages Lab — Complete Backend API Documentation

> **Version:** 1.0.0
> **Base URL:** `http://localhost:5000` (development) | `https://api.messagelab.tech` (production)
> **API Prefix:** `/api/v1`
> **Last Updated:** 2026-09-07

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Authentication System](#3-authentication-system)
4. [Error Response Format](#4-error-response-format)
5. [Public Endpoints (No Auth)](#5-public-endpoints)
6. [Auth Endpoints](#6-auth-endpoints)
7. [Device Endpoints (User Side)](#7-device-endpoints-user-side)
8. [Device Agent Endpoints (Android App)](#8-device-agent-endpoints-android-app)
9. [SMS Endpoints](#9-sms-endpoints)
10. [Payment & Subscription Endpoints](#10-payment--subscription-endpoints)
11. [Admin Endpoints](#11-admin-endpoints)
12. [Data Models Reference](#12-data-models-reference)
13. [Security Architecture](#13-security-architecture)
14. [Scheduled Jobs](#14-scheduled-jobs)
15. [Email System](#15-email-system)
16. [Frontend Integration Guide](#16-frontend-integration-guide)
17. [Android App Integration Guide](#17-android-app-integration-guide)
18. [Environment Variables](#18-environment-variables)

---

## 1. Project Overview

Messages Lab is a complete product-as-a-service platform that turns an Android smartphone into a personal SMS gateway. Users install the Messages Lab Android app on their phone, connect it to their web account, and then send/receive SMS through the web dashboard using their own SIM card.

### Core Concepts

- **User's Own Device:** The Android phone acts as the SMS gateway.
- **User's Own SIM:** SMS are sent through the user's own mobile package.
- **Web Dashboard:** All SMS management happens through a modern web interface.
- **Manual Payment:** bKash, Nagad, Rocket — transaction ID verification by admin.
- **Plan-Based Limits:** Free (10 recipients), Pro (20), Enterprise (unlimited).
- **3-Second Delay:** Minimum delay between consecutive SMS to prevent carrier blocks.
- **Security First:** Rate limiting, audit logs, device tokens, email verification.

### Plans

| Plan | Recipients/Campaign | Daily Messages | Devices | Price (BDT) |
|------|---------------------|----------------|---------|-------------|
| Free | 10 | 50 | 1 | 0 |
| Pro | 20 | 500 | 1 | 299/mo |
| Enterprise | Unlimited* | 5000 | 5 | 999/mo |

*Subject to fair use policy.

---

## 2. Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Database | MongoDB (Mongoose) |
| Cache / Queue | Upstash Redis |
| Email | Resend API |
| Image Storage | Cloudinary |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |
| Auth | JWT (Access + Refresh) + Google OAuth |
| QR Code | qrcode (npm) |
| Validation | Zod |
| Password Hashing | bcryptjs |

---

## 3. Authentication System

### 3.1 Token Architecture

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| Access Token | 15 minutes | Frontend memory / state | API authentication |
| Refresh Token | 7 days | HttpOnly Cookie | Get new access token |
| Device Token | Until disconnected | Android app secure storage | Device-to-server communication |

### 3.2 Email Verification Flow

1. User registers → account created with `isEmailVerified: false`
2. Verification email sent from `verify@messagelab.tech`
3. User clicks link → `POST /api/v1/auth/verify-email`
4. Email marked verified → welcome email sent
5. **Login is BLOCKED until email is verified**

### 3.3 Google OAuth Flow (SPA)

1. Frontend uses Google Sign-In button → gets `idToken`
2. Frontend sends `idToken` to `POST /api/v1/auth/google`
3. Backend verifies token with `google-auth-library`
4. If new user → creates account (email pre-verified)
5. If existing user → logs in
6. Returns access token + sets refresh cookie

### 3.4 Request Authentication

**For User APIs:**
```
Authorization: Bearer <access-token>
```

**For Device Agent APIs (Android app):**
```
Authorization: DeviceToken <device-token>
```

### 3.5 Token Refresh Flow

1. Frontend detects 401 (expired access token)
2. Frontend calls `POST /api/v1/auth/refresh` (no Bearer token needed, uses cookie)
3. Backend reads `refreshToken` from HttpOnly cookie
4. Backend issues new access + refresh tokens
5. New refresh token replaces old cookie (token rotation)

---

## 4. Error Response Format

All errors follow this consistent format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "details": {},
  "requestId": "uuid-of-the-request"
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permission) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

### Rate Limit Headers

Every response includes:
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 295
X-RateLimit-Reset: 1725739200000
```

---

## 5. Public Endpoints

> **No authentication required.** Used by the frontend website to load content.

### 5.1 Get Full Page Content

```
GET /api/v1/public/content
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hero": {
      "hero_title": { "title": "...", "body": "..." },
      "hero_subtitle": { "title": null, "body": "..." },
      "hero_cta_primary": { "title": "Get Started Free", "body": "/register" },
      "hero_cta_secondary": { "title": "View Pricing", "body": "/pricing" },
      "hero_badge": { "title": "...", "body": null }
    },
    "header": {
      "header_logo_text": { "title": "Messages Lab", "body": null },
      "header_tagline": { "title": null, "body": "Your Personal SMS Gateway" }
    },
    "footer": {
      "footer_copyright": { "title": null, "body": "© 2026..." },
      "footer_description": { "title": null, "body": "..." },
      "footer_support_email": { "title": null, "body": "support@messagelab.tech" }
    },
    "announcement": null,
    "features": [
      { "key": "feature_own_device", "title": "Your Own Device", "body": "...", "metadata": { "icon": "smartphone", "order": 1 } }
    ],
    "pricing": {
      "sectionContent": { ... },
      "plans": [
        {
          "planId": "free",
          "displayName": "Free",
          "description": "...",
          "priceMonthly": 0,
          "priceYearly": 0,
          "currency": "BDT",
          "maxRecipientsPerCampaign": 10,
          "maxDailyMessages": 50,
          "maxDevices": 1,
          "features": ["Up to 10 recipients per campaign", "..."]
        }
      ]
    }
  }
}
```

### 5.2 Get Public Pricing

```
GET /api/v1/public/pricing
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sectionContent": {
      "pricing_section_title": { "title": "Choose Your Plan", "body": "..." },
      "pricing_section_note": { "title": null, "body": "..." }
    },
    "plans": [ ... ]
  }
}
```

### 5.3 Get Platform Status

```
GET /api/v1/public/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "maintenanceMode": false,
    "registrationOpen": true,
    "timestamp": "2026-09-07T19:00:00.000Z"
  }
}
```

### 5.4 Individual Content Sections

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/public/content/hero` | Hero section only |
| `GET /api/v1/public/content/header` | Header only |
| `GET /api/v1/public/content/footer` | Footer only |
| `GET /api/v1/public/content/announcement` | Announcement banner |
| `GET /api/v1/public/content/features` | Features section |

---

## 6. Auth Endpoints

> **Base:** `/api/v1/auth`
> **Rate Limit:** 10 requests per 15 minutes per IP

### 6.1 Register

```
POST /api/v1/auth/register
```

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "mobile": "01711111111",
  "password": "SecurePass123"
}
```

**Validation Rules:**
- `name`: 2-50 characters
- `email`: valid email, auto-lowercased
- `mobile`: optional, Bangladeshi format `01XXXXXXXXX` or `+8801XXXXXXXXX`
- `password`: minimum 8 characters

**Success Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "user-id",
      "name": "John Doe",
      "email": "john@example.com",
      "mobile": "01711111111",
      "role": "user",
      "isEmailVerified": false,
      "profilePicture": null
    },
    "requiresVerification": true
  }
}
```

> **Important:** No access token is returned. User MUST verify email before login.

**Error Responses:**
- `409` — Email already exists
- `400` — Validation error
- `429` — Rate limit exceeded

---

### 6.2 Verify Email

```
POST /api/v1/auth/verify-email
```

**Body:**
```json
{
  "token": "verification-token-from-email-link"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully. You can now login.",
  "data": {
    "email": "john@example.com",
    "name": "John Doe"
  }
}
```

**Error Responses:**
- `400` — Invalid or expired token

---

### 6.3 Resend Verification Email

```
POST /api/v1/auth/resend-verification
```

**Body:**
```json
{
  "email": "john@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "If an unverified account exists with this email, a verification link has been sent."
}
```

> **Note:** Response is intentionally generic to prevent email enumeration.
> **Cooldown:** 5 minutes between resend requests (enforced via Redis).

---

### 6.4 Login

```
POST /api/v1/auth/login
```

**Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user-id",
      "name": "John Doe",
      "email": "john@example.com",
      "mobile": "01711111111",
      "role": "user",
      "isEmailVerified": true,
      "profilePicture": null
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

> **Cookie:** `refreshToken` is set as HttpOnly cookie automatically.

**Error Responses:**
- `401` — Invalid email or password
- `403` — Email not verified / Account disabled
- `429` — Rate limit exceeded

---

### 6.5 Google Login

```
POST /api/v1/auth/google
```

**Body:**
```json
{
  "idToken": "google-id-token-from-frontend"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Google login successful",
  "data": {
    "user": {
      "id": "user-id",
      "name": "John Doe",
      "email": "john@gmail.com",
      "mobile": null,
      "role": "user",
      "isEmailVerified": true,
      "profilePicture": "https://lh3.googleusercontent.com/..."
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

> **Note:** Google accounts are auto-verified (no email verification needed).
> If the user has not provided a mobile number, frontend should prompt them to add one.

---

### 6.6 Refresh Token

```
POST /api/v1/auth/refresh
```

**Headers:** None (uses HttpOnly cookie)

**Body:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "Tokens refreshed successfully",
  "data": {
    "accessToken": "new-access-token",
    "user": {
      "id": "user-id",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    }
  }
}
```

> **Cookie:** New `refreshToken` cookie replaces the old one (token rotation).

**Error Responses:**
- `401` — Refresh token missing/invalid/expired

---

### 6.7 Get Current User

```
GET /api/v1/auth/me
```

**Headers:**
```
Authorization: Bearer <access-token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "name": "John Doe",
      "email": "john@example.com",
      "mobile": "01711111111",
      "role": "user",
      "isEmailVerified": true,
      "isMobileVerified": false,
      "profilePicture": null,
      "createdAt": "2026-09-01T10:00:00.000Z",
      "lastLoginAt": "2026-09-07T19:00:00.000Z"
    }
  }
}
```

---

### 6.8 Logout

```
POST /api/v1/auth/logout
```

**Headers:**
```
Authorization: Bearer <access-token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

> Clears the `refreshToken` cookie.

---

## 7. Device Endpoints (User Side)

> **Base:** `/api/v1/devices`
> **Auth:** `Authorization: Bearer <access-token>`

### 7.1 Generate Pairing Code + QR Code

```
POST /api/v1/devices/pairing-code
```

**Body:**
```json
{
  "deviceName": "My Samsung Phone"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Pairing code generated. Scan the QR code or enter the code in the Messages Lab Android app.",
  "data": {
    "code": "123456",
    "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgo...",
    "expiresAt": "2026-09-07T19:10:00.000Z",
    "expiresInMinutes": 10
  }
}
```

> **QR Code Content:** JSON string containing `{ type, code, userId, deviceName, expiresAt }`
> **Frontend:** Display both the QR code image and the 6-digit code.
> **Error:** `403` if device limit reached.

---

### 7.2 Get All Devices

```
GET /api/v1/devices
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "_id": "device-id",
        "userId": "user-id",
        "deviceName": "My Samsung Phone",
        "deviceModel": "Galaxy S23",
        "androidVersion": "14",
        "appVersion": "1.0.0",
        "status": "active",
        "lastHeartbeat": {
          "batteryLevel": 85,
          "isCharging": false,
          "networkType": "wifi",
          "hasSim": true,
          "smsPermissionGranted": true,
          "isSmsCapable": true,
          "appVersion": "1.0.0",
          "lastSeenAt": "2026-09-07T19:00:00.000Z"
        },
        "lastSeenAt": "2026-09-07T19:00:00.000Z",
        "connectedAt": "2026-09-01T10:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

**Device Status Values:**
| Status | Meaning |
|--------|---------|
| `active` | Device connected and sending heartbeats |
| `offline` | No heartbeat for 5+ minutes |
| `disabled` | Disconnected by user or admin |
| `suspended` | Suspended due to security issue |

The backend is the source of truth for dashboard state. `isOnline` is `true` only when `status` is `active`; an active device with no heartbeat for five minutes is returned as `offline`. Disabled and suspended devices are never considered online.

---

### 7.3 Get Device Details

```
GET /api/v1/devices/:deviceId
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "device": { ... }
  }
}
```

---

### 7.4 Disconnect Device

```
DELETE /api/v1/devices/:deviceId
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Device disconnected successfully"
}
```

---

## 8. Device Agent Endpoints (Android App)

> **Base:** `/api/v1/device-agent`
> These endpoints are called by the Messages Lab Android application.

### 8.1 Pair Device (No Auth — Uses Pairing Code)

```
POST /api/v1/device-agent/pair
```

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "pairingCode": "123456",
  "clientDeviceId": "stable-installation-id-generated-and-stored-by-android",
  "deviceName": "My Samsung Phone",
  "deviceModel": "Galaxy S23",
  "androidVersion": "14",
  "appVersion": "1.0.0"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Device paired successfully. Store the device token securely.",
  "data": {
    "deviceToken": "64-character-random-hex-token",
    "deviceId": "device-id",
    "userId": "user-id",
    "deviceName": "My Samsung Phone"
  }
}
```

> **Critical:** The `deviceToken` is shown ONLY ONCE. The Android app must store it securely (EncryptedSharedPreferences or Keystore).
> After this, all subsequent calls use `Authorization: DeviceToken <token>`.

> **Device identity:** `clientDeviceId` must remain stable for the lifetime of an Android app installation and be stored securely. Pairing with the same `clientDeviceId` updates/reconnects the existing device record and returns its existing `deviceId`; it does not create another device record. `idempotencyKey` only protects request retries and is not a device identity.

---

### 8.2 Send Heartbeat

```
POST /api/v1/device-agent/heartbeat
```

**Headers:**
```
Authorization: DeviceToken <device-token>
Content-Type: application/json
```

**Body:**
```json
{
  "batteryLevel": 85,
  "isCharging": false,
  "networkType": "wifi",
  "hasSim": true,
  "smsPermissionGranted": true,
  "isSmsCapable": true,
  "appVersion": "1.0.0"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Heartbeat received",
  "data": {
    "status": "active",
    "serverTime": "2026-09-07T19:00:00.000Z"
  }
}
```

> **Recommended interval:** Every 30-60 seconds.
> If no heartbeat for 5 minutes, device is marked `offline` by the scheduled job.

---

### 8.3 Get Device Status

```
GET /api/v1/device-agent/status
```

**Headers:**
```
Authorization: DeviceToken <device-token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "deviceId": "device-id",
    "userId": "user-id",
    "deviceName": "My Samsung Phone",
    "status": "active"
  }
}
```

---

### 8.4 Fetch Next SMS Job

```
GET /api/v1/device-agent/sms/next
```

**Headers:**
```
Authorization: DeviceToken <device-token>
```

**Success Response (200) — Job Available:**
```json
{
  "success": true,
  "data": {
    "job": {
      "jobId": "job-id",
      "recipient": "+8801711111111",
      "messageBody": "Hello from Messages Lab!",
      "smsParts": 1,
      "campaignId": "campaign-id"
    }
  }
}
```

**Success Response (200) — No Job / Delay:**
```json
{
  "success": true,
  "data": {
    "job": null,
    "waitMs": 2500,
    "message": "Minimum delay not elapsed. Wait 2500ms."
  }
}
```

> **Important:** The app should poll this endpoint periodically.
> The server enforces the 3-second delay. If `waitMs > 0`, the app should wait before polling again.
> After receiving a job, the app sends the SMS and then reports the result.

---

### 8.5 Report Job Status

```
POST /api/v1/device-agent/sms/report
```

**Headers:**
```
Authorization: DeviceToken <device-token>
Content-Type: application/json
```

**Body (Success):**
```json
{
  "jobId": "job-id",
  "status": "sent"
}
```

**Body (Failure):**
```json
{
  "jobId": "job-id",
  "status": "failed",
  "failureReason": "No SIM card detected"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Job status reported: sent"
}
```

---

### 8.6 Get Queue Status

```
GET /api/v1/device-agent/sms/queue-status
```

**Headers:**
```
Authorization: DeviceToken <device-token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "deviceId": "device-id",
    "queueLength": 5,
    "minDelayMs": 3000
  }
}
```

---

### 8.7 Self Disconnect

```
POST /api/v1/device-agent/disconnect
```

**Headers:**
```
Authorization: DeviceToken <device-token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Device disconnected successfully"
}
```

---

## 9. SMS Endpoints

> **Base:** `/api/v1/sms`
> **Auth:** `Authorization: Bearer <access-token>`

### 9.1 Send Bulk SMS (Create Campaign)

```
POST /api/v1/sms/bulk
```

**Body:**
```json
{
  "campaignName": "Eid Greetings",
  "recipients": "01711111111, 01822222222, +8801933333333",
  "messageBody": "Happy Eid from Messages Lab!"
}
```

**Validation:**
- `recipients`: Comma-separated phone numbers. Max depends on plan.
- `messageBody`: 1-2000 characters
- Bengali text uses Unicode encoding (70 chars per SMS part)
- English text uses GSM 7-bit (160 chars per SMS part)

**Success Response (201):**
```json
{
  "success": true,
  "message": "SMS campaign created and queued for sending",
  "data": {
    "campaignId": "campaign-id",
    "totalRecipients": 3,
    "invalidCount": 0,
    "duplicateCount": 0,
    "estimatedSmsParts": 3,
    "estimatedTimeSeconds": 12
  }
}
```

**Error Responses:**
- `400` — No valid recipients / No active device
- `403` — Recipient limit exceeded for plan

---

### 9.2 Get All Campaigns

```
GET /api/v1/sms/campaigns?page=1&limit=20
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "_id": "campaign-id",
        "userId": "user-id",
        "deviceId": "device-id",
        "campaignName": "Eid Greetings",
        "messageBody": "Happy Eid from Messages Lab!",
        "totalRecipients": 3,
        "processedCount": 3,
        "successCount": 3,
        "failedCount": 0,
        "status": "completed",
        "planAtCreation": "free",
        "minDelayMs": 3000,
        "smsPartsPerMessage": 1,
        "encoding": "unicode",
        "startedAt": "2026-09-07T19:00:00.000Z",
        "completedAt": "2026-09-07T19:00:12.000Z",
        "createdAt": "2026-09-07T18:59:55.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

**Campaign Status Values:**
| Status | Meaning |
|--------|---------|
| `queued` | Created, waiting for device to pick up |
| `processing` | Device is actively sending |
| `paused` | Temporarily paused |
| `completed` | All messages sent successfully |
| `partially_failed` | Some sent, some failed |
| `failed` | All messages failed |
| `cancelled` | Cancelled by user |

---

### 9.3 Get Campaign Details

```
GET /api/v1/sms/campaigns/:campaignId
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "campaign": {
      "_id": "campaign-id",
      "totalRecipients": 3,
      "processedCount": 3,
      "successCount": 2,
      "failedCount": 1,
      "status": "partially_failed",
      "jobStatusBreakdown": {
        "sent": 2,
        "failed": 1
      }
    }
  }
}
```

---

### 9.4 Get Campaign Jobs

```
GET /api/v1/sms/campaigns/:campaignId/jobs?page=1&limit=50&status=failed
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "_id": "job-id",
        "campaignId": "campaign-id",
        "recipient": "+8801711111111",
        "originalRecipient": "01711111111",
        "status": "sent",
        "smsParts": 1,
        "attempts": 1,
        "sentAt": "2026-09-07T19:00:03.000Z",
        "createdAt": "2026-09-07T18:59:55.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

**Job Status Values:**
| Status | Meaning |
|--------|---------|
| `queued` | Waiting in Redis queue |
| `assigned` | Assigned to device |
| `processing` | Device is processing |
| `sending` | Actively sending |
| `sent` | Successfully sent |
| `failed` | Failed to send |
| `cancelled` | Cancelled by user |

---

### 9.5 Cancel Campaign

```
POST /api/v1/sms/campaigns/:campaignId/cancel
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Campaign cancelled successfully",
  "data": {
    "cancelledJobs": 5
  }
}
```

> Only unsent jobs are cancelled. Already sent messages cannot be recalled.

---

## 10. Payment & Subscription Endpoints

> **Base:** `/api/v1/payments`
> **Auth:** `Authorization: Bearer <access-token>`

### 10.1 Get Available Plans

```
GET /api/v1/payments/plans
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "planId": "free",
        "displayName": "Free",
        "priceMonthly": 0,
        "maxRecipientsPerCampaign": 10,
        "features": ["..."]
      },
      {
        "planId": "pro",
        "displayName": "Pro",
        "priceMonthly": 299,
        "maxRecipientsPerCampaign": 20,
        "features": ["..."]
      }
    ]
  }
}
```

---

### 10.2 Submit Payment

```
POST /api/v1/payments/submit
```

**Body:**
```json
{
  "planId": "pro",
  "paymentMethod": "bkash",
  "senderNumber": "01711111111",
  "transactionId": "ABC123XYZ",
  "amount": 299,
  "note": "Monthly subscription"
}
```

**Validation:**
- `planId`: must be an active paid plan
- `paymentMethod`: `bkash` | `nagad` | `rocket`
- `senderNumber`: 11-15 digits
- `transactionId`: 4-50 characters, must be unique
- `amount`: positive number

**Success Response (201):**
```json
{
  "success": true,
  "message": "Payment submitted successfully. Our team will verify it within a few hours.",
  "data": {
    "paymentId": "payment-id",
    "status": "pending",
    "planId": "pro",
    "amount": 299,
    "paymentMethod": "bkash",
    "transactionId": "ABC123XYZ",
    "createdAt": "2026-09-07T19:00:00.000Z"
  }
}
```

**Error Responses:**
- `404` — Plan not found
- `409` — Duplicate transaction ID
- `429` — Too many pending payments (max 3)

**Payment Status Values:**
| Status | Meaning |
|--------|---------|
| `pending` | Submitted, waiting for admin review |
| `under_review` | Admin is checking |
| `approved` | Verified, subscription activated |
| `rejected` | Could not verify |
| `expired` | Timed out |

---

### 10.3 Get My Payments

```
GET /api/v1/payments
```

### 10.4 Get Payment Details

```
GET /api/v1/payments/:paymentId
```

### 10.5 Get My Subscription

```
GET /api/v1/payments/subscription
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "_id": "sub-id",
      "planId": "pro",
      "planName": "Pro",
      "status": "active",
      "startedAt": "2026-09-07T19:00:00.000Z",
      "expiresAt": "2026-10-07T19:00:00.000Z"
    },
    "currentPlan": {
      "planId": "pro",
      "planName": "Pro",
      "maxRecipientsPerCampaign": 20,
      "maxDailyMessages": 500,
      "maxDevices": 1,
      "minSmsDelayMs": 3000
    }
  }
}
```

### 10.6 Get Subscription History

```
GET /api/v1/payments/subscription/history
```

---

## 11. Admin Endpoints

> **Base:** `/api/v1/admin`
> **Auth:** `Authorization: Bearer <admin-access-token>`
> **Role Required:** `admin`

### 11.1 User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/users` | List users (search, filter, paginate) |
| GET | `/api/v1/admin/users/stats` | User statistics |
| GET | `/api/v1/admin/users/recent` | Recent registrations |
| GET | `/api/v1/admin/users/:userId` | User details (devices, payments, logs) |
| PATCH | `/api/v1/admin/users/:userId/role` | Change role |
| PATCH | `/api/v1/admin/users/:userId/status` | Enable/disable account |
| POST | `/api/v1/admin/users/:userId/verify-email` | Manually verify email |

**User List Query Parameters:**
```
GET /api/v1/admin/users?page=1&limit=20&search=john&role=user&isVerified=false&isDisabled=false&sortBy=createdAt&sortOrder=desc
```

**Change Role Body:**
```json
{ "role": "admin" }
```

**Change Status Body:**
```json
{ "isDisabled": true, "reason": "Suspicious activity" }
```

**User Stats Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 1000,
    "verifiedUsers": 700,
    "unverifiedUsers": 300,
    "disabledUsers": 5,
    "adminUsers": 2,
    "activeSubscriptions": 150,
    "connectedDevices": 120,
    "registrationTrend": {
      "last24h": 15,
      "last7d": 80,
      "last30d": 300
    }
  }
}
```

---

### 11.2 Payment Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/payments` | List all payments |
| GET | `/api/v1/admin/payments/stats` | Payment statistics |
| POST | `/api/v1/admin/payments/review` | Approve or reject payment |

**Review Payment Body:**
```json
{
  "paymentId": "payment-id",
  "action": "approve",
  "reviewNote": "Verified with bKash app",
  "subscriptionDurationDays": 30
}
```

Or for rejection:
```json
{
  "paymentId": "payment-id",
  "action": "reject",
  "rejectionReason": "Transaction ID not found in bKash system"
}
```

**Payment Stats Response:**
```json
{
  "success": true,
  "data": {
    "pending": 5,
    "underReview": 2,
    "approved": 150,
    "rejected": 10,
    "totalRevenue": 44850
  }
}
```

---

### 11.3 Content Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/content` | Get all content |
| GET | `/api/v1/admin/content/:key` | Get content by key |
| POST | `/api/v1/admin/content` | Create/update content (upsert) |
| DELETE | `/api/v1/admin/content/:key` | Delete content |

**Upsert Content Body:**
```json
{
  "key": "hero_title",
  "category": "hero",
  "title": "New Hero Title",
  "body": "New hero description",
  "metadata": { "custom": "value" },
  "isActive": true
}
```

> **Note:** Updating content automatically invalidates the public content cache.

---

### 11.4 Plan Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/plans` | Get all plans |
| GET | `/api/v1/admin/plans/:planId` | Get plan by ID |
| POST | `/api/v1/admin/plans` | Create/update plan (upsert) |
| PATCH | `/api/v1/admin/plans/:planId/toggle` | Toggle active status |
| DELETE | `/api/v1/admin/plans/:planId` | Delete plan |

**Upsert Plan Body:**
```json
{
  "planId": "pro",
  "name": "pro",
  "displayName": "Pro",
  "description": "Higher limits",
  "priceMonthly": 299,
  "priceYearly": 2990,
  "currency": "BDT",
  "maxRecipientsPerCampaign": 20,
  "maxDailyMessages": 500,
  "maxDevices": 1,
  "minSmsDelayMs": 3000,
  "features": ["Up to 20 recipients", "Priority support"],
  "isActive": true,
  "sortOrder": 2
}
```

---

### 11.5 Settings Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/settings` | Get all settings |
| GET | `/api/v1/admin/settings/:key` | Get setting by key |
| POST | `/api/v1/admin/settings` | Create/update setting |
| POST | `/api/v1/admin/settings/bulk` | Bulk update settings |
| DELETE | `/api/v1/admin/settings/:key` | Delete setting |

**Upsert Setting Body:**
```json
{
  "key": "sms_min_delay_ms",
  "value": 3000,
  "valueType": "number",
  "description": "Minimum delay between SMS",
  "category": "sms"
}
```

---

### 11.6 Security Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/security/audit-logs` | Audit logs (paginated) |
| GET | `/api/v1/admin/security/security-events` | Security events (paginated) |

---

### 11.7 Scheduled Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/jobs` | Job statuses |
| GET | `/api/v1/admin/jobs/logs` | Execution logs |
| POST | `/api/v1/admin/jobs/:jobName/trigger` | Manually trigger a job |

**Available Job Names:**
- `verification_reminder`
- `subscription_expiry`
- `device_offline_marker`
- `token_cleanup`

---

## 12. Data Models Reference

### User
```
{
  name: string,
  email: string (unique, lowercase),
  mobile: string | null,
  passwordHash: string | null,
  role: "user" | "admin",
  isEmailVerified: boolean,
  isMobileVerified: boolean,
  isAccountDisabled: boolean,
  profilePicture: string | null,
  authProviders: {
    local: boolean,
    google: boolean,
    googleId: string | null
  },
  lastLoginAt: Date | null,
  lastLoginIp: string | null
}
```

### Device
```
{
  userId: ObjectId,
  deviceName: string,
  deviceModel: string | null,
  androidVersion: string | null,
  appVersion: string | null,
  deviceTokenHash: string (SHA-256 hash),
  status: "active" | "offline" | "disabled" | "suspended",
  lastHeartbeat: {
    batteryLevel, isCharging, networkType,
    hasSim, smsPermissionGranted, isSmsCapable,
    appVersion, lastSeenAt
  },
  lastSeenAt: Date | null,
  connectedAt: Date,
  disconnectedAt: Date | null
}
```

### SmsCampaign
```
{
  userId: ObjectId,
  deviceId: ObjectId,
  campaignName: string | null,
  messageBody: string,
  totalRecipients: number,
  processedCount: number,
  successCount: number,
  failedCount: number,
  status: "queued" | "processing" | "paused" | "completed" | "partially_failed" | "failed" | "cancelled",
  planAtCreation: string,
  minDelayMs: number,
  smsPartsPerMessage: number,
  encoding: "gsm7" | "unicode",
  startedAt: Date | null,
  completedAt: Date | null
}
```

### SmsJob
```
{
  campaignId: ObjectId,
  userId: ObjectId,
  deviceId: ObjectId,
  recipient: string (normalized: +8801XXXXXXXXX),
  originalRecipient: string,
  messageBody: string,
  status: "queued" | "assigned" | "processing" | "sending" | "sent" | "failed" | "cancelled",
  failureReason: string | null,
  attempts: number,
  maxAttempts: number (default 3),
  smsParts: number,
  lockedAt: Date | null,
  lockedBy: string | null,
  sentAt: Date | null,
  failedAt: Date | null
}
```

### PaymentSubmission
```
{
  userId: ObjectId,
  planId: string,
  amount: number,
  currency: string (BDT),
  paymentMethod: "bkash" | "nagad" | "rocket",
  senderNumber: string,
  transactionId: string (unique),
  screenshotUrl: string | null,
  note: string | null,
  status: "pending" | "under_review" | "approved" | "rejected" | "expired",
  reviewedBy: ObjectId | null,
  reviewedAt: Date | null,
  reviewNote: string | null,
  rejectionReason: string | null,
  subscriptionId: ObjectId | null
}
```

### Subscription
```
{
  userId: ObjectId,
  planId: string,
  planName: string,
  status: "active" | "expired" | "cancelled" | "suspended",
  startedAt: Date,
  expiresAt: Date,
  paymentSubmissionId: ObjectId | null,
  autoRenew: boolean
}
```

### AuditLog
```
{
  userId: ObjectId | null,
  action: string,
  entityType: string,
  entityId: string | null,
  ipAddress: string | null,
  userAgent: string | null,
  metadata: object
}
```

### SecurityEvent
```
{
  eventType: string,
  severity: "low" | "medium" | "high" | "critical",
  ipAddress: string | null,
  userId: ObjectId | null,
  userAgent: string | null,
  description: string | null,
  metadata: object
}
```

---

## 13. Security Architecture

### Rate Limiting

| Scope | Window | Max Requests |
|-------|--------|-------------|
| Global (per IP) | 15 min | 300 |
| Auth routes (per IP) | 15 min | 10 |
| SMS sending | Per plan limits | Plan-based |
| Payment submission | Per user | 3 pending max |
| Verification resend | Per user | 1 per 5 minutes |

### Security Event Types

| Event Type | Severity | Trigger |
|-----------|----------|---------|
| `FAILED_LOGIN` | medium | Wrong password |
| `LOGIN_BLOCKED_UNVERIFIED` | low | Unverified account login attempt |
| `RATE_LIMIT_EXCEEDED` | medium | Global rate limit hit |
| `AUTH_RATE_LIMIT_EXCEEDED` | high | Auth rate limit hit |
| `INVALID_DEVICE_PAIRING_CODE` | medium | Wrong pairing code |
| `DUPLICATE_TRANSACTION_ID` | high | Same transaction ID submitted twice |

### Audit Log Actions

| Action | Meaning |
|--------|---------|
| `USER_REGISTERED` | New account created |
| `USER_LOGIN` | Successful login |
| `EMAIL_VERIFIED` | Email verified |
| `VERIFICATION_EMAIL_SENT` | Verification email sent |
| `DEVICE_PAIRING_CODE_GENERATED` | Pairing code created |
| `DEVICE_CONNECTED` | Device paired |
| `DEVICE_DISCONNECTED` | Device disconnected |
| `SMS_CAMPAIGN_CREATED` | Bulk SMS campaign created |
| `SMS_CAMPAIGN_CANCELLED` | Campaign cancelled |
| `PAYMENT_SUBMITTED` | Payment submitted |
| `PAYMENT_APPROVED` | Payment approved by admin |
| `PAYMENT_REJECTED` | Payment rejected by admin |
| `USER_ROLE_CHANGED` | Admin changed user role |
| `USER_ACCOUNT_DISABLED` | Admin disabled account |
| `TOKEN_REFRESHED` | Token refreshed |

---

## 14. Scheduled Jobs

| Job Name | Interval | Description |
|----------|----------|-------------|
| `verification_reminder` | 30 min | Sends reminders to unverified users (1h, 24h, 48h). Restricts accounts after 72h. |
| `subscription_expiry` | 15 min | Expires subscriptions past their expiry date |
| `device_offline_marker` | 2 min | Marks devices as offline if no heartbeat for 5+ min |
| `token_cleanup` | 1 hour | Deletes expired verification tokens and pairing codes |

---

## 15. Email System

### Sender Addresses

| Address | Purpose |
|---------|---------|
| `verify@messagelab.tech` | Account verification, password reset |
| `no-reply@messagelab.tech` | General notifications |
| `update@messagelab.tech` | Account updates, security alerts, device alerts |
| `billing@messagelab.tech` | Payment and subscription updates |
| `support@messagelab.tech` | Support communications |

### Email Templates

| Template | Trigger | Sender |
|----------|---------|--------|
| Verification | Registration, resend | verify@ |
| Welcome | Email verified | no-reply@ |
| Password Reset | Forgot password | verify@ |
| Account Update | Profile change, role change | update@ |
| Device Alert | Device connected/disconnected | update@ |
| Payment Update | Payment submitted/approved/rejected | billing@ |

---

## 16. Frontend Integration Guide

### 16.1 Landing Page Load

```javascript
// Fetch all page content in one call
const response = await fetch("https://api.messagelab.tech/api/v1/public/content");
const { data } = await response.json();

// data.hero.hero_title.title → Hero heading
// data.hero.hero_cta_primary.body → CTA link
// data.pricing.plans → Plan cards
// data.features → Feature grid
```

### 16.2 User Authentication Flow

```
1. Register → POST /api/v1/auth/register
2. Show "Check your email" screen
3. User clicks email link → redirect to /verify-email?token=xxx
4. Frontend calls → POST /api/v1/auth/verify-email { token }
5. Redirect to login
6. Login → POST /api/v1/auth/login → get accessToken
7. Store accessToken in memory/state
8. Use accessToken for all API calls
9. On 401 → POST /api/v1/auth/refresh → get new token
```

### 16.3 Device Connection Flow (Web Dashboard)

```
1. User clicks "Connect Device"
2. POST /api/v1/devices/pairing-code { deviceName }
3. Display QR code (qrCodeDataUrl) and 6-digit code
4. Wait for user to scan/enter on phone
5. Poll GET /api/v1/devices to check if device connected
6. Once device appears → show success
```

### 16.4 SMS Sending Flow (Web Dashboard)

```
1. User enters recipients + message
2. POST /api/v1/sms/bulk
3. Redirect to campaign details page
4. Poll GET /api/v1/sms/campaigns/:id every 3-5 seconds
5. Show progress: processedCount / totalRecipients
6. Show job list with statuses
7. When status = completed/partially_failed/failed → stop polling
```

### 16.5 CORS Configuration

Frontend URLs allowed by the backend:
- `env.FRONTEND_URL` (e.g., `http://localhost:3000`)
- `env.ADMIN_URL` (e.g., `http://localhost:3000/admin`)

All requests must include credentials for cookie support:
```javascript
fetch(url, { credentials: "include" })
```

---

## 17. Android App Integration Guide

### 17.1 Device Pairing Flow

```
1. User opens app → logs in with email/password
2. App calls POST /api/v1/auth/login → gets accessToken
3. User goes to "Connect Device" in web dashboard
4. Web shows QR code / 6-digit code
5. App scans QR → parses JSON → gets pairingCode
   OR user manually enters the 6-digit code
6. App calls POST /api/v1/device-agent/pair
7. App receives deviceToken → stores in EncryptedSharedPreferences
8. App starts heartbeat service
```

### 17.2 Heartbeat Service

```
Every 30-60 seconds:
  POST /api/v1/device-agent/heartbeat
  Authorization: DeviceToken <stored-token>
  Body: { batteryLevel, isCharging, networkType, hasSim, smsPermissionGranted, isSmsCapable, appVersion }
```

### 17.3 SMS Sending Worker

```
Loop:
  1. GET /api/v1/device-agent/sms/next
  2. If job available:
     a. Send SMS using Android SmsManager
     b. POST /api/v1/device-agent/sms/report { jobId, status: "sent" | "failed" }
  3. If waitMs > 0 → sleep for waitMs
  4. If no job → sleep for 5-10 seconds
  5. Repeat
```

### 17.4 Required Android Permissions

| Permission | Purpose |
|-----------|---------|
| `INTERNET` | Server communication |
| `SEND_SMS` | Send SMS messages |
| `RECEIVE_SMS` | Receive incoming SMS (optional) |
| `READ_PHONE_STATE` | Check SIM and network status |
| `ACCESS_NETWORK_STATE` | Check internet connectivity |
| `POST_NOTIFICATIONS` | Foreground service notification |
| `FOREGROUND_SERVICE` | Keep SMS gateway running |

---

## 18. Environment Variables

```env
# App
NODE_ENV=development
PORT=5000
API_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/message-lab

# Security Secrets (min 32 characters each)
SESSION_SECRET=<long-random-string>
COOKIE_SECRET=<long-random-string>
JWT_ACCESS_SECRET=<long-random-string>
JWT_REFRESH_SECRET=<long-random-string>

# Upstash Redis
UPSTASH_REDIS_REST_URL=<url>
UPSTASH_REDIS_REST_TOKEN=<token>

# Resend Email
RESEND_API_KEY=<key>
EMAIL_FROM_VERIFY=verify@messagelab.tech
EMAIL_FROM_NO_REPLY=no-reply@messagelab.tech
EMAIL_FROM_UPDATE=update@messagelab.tech
EMAIL_FROM_BILLING=billing@messagelab.tech
EMAIL_FROM_SUPPORT=support@messagelab.tech

# Cloudinary
CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>

# Google OAuth
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

# SMS Settings
SMS_MIN_DELAY_MS=3000
FREE_PLAN_MAX_RECIPIENTS=10
PRO_PLAN_MAX_RECIPIENTS=20

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
```

---

## Quick Reference: All Endpoints

### Public (No Auth)
| Method | Endpoint |
|--------|----------|
| GET | `/api/v1/public/content` |
| GET | `/api/v1/public/content/hero` |
| GET | `/api/v1/public/content/header` |
| GET | `/api/v1/public/content/footer` |
| GET | `/api/v1/public/content/announcement` |
| GET | `/api/v1/public/content/features` |
| GET | `/api/v1/public/pricing` |
| GET | `/api/v1/public/status` |

### Auth
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/v1/auth/register` | None |
| POST | `/api/v1/auth/verify-email` | None |
| POST | `/api/v1/auth/resend-verification` | None |
| POST | `/api/v1/auth/login` | None |
| POST | `/api/v1/auth/google` | None |
| POST | `/api/v1/auth/refresh` | Cookie |
| GET | `/api/v1/auth/me` | Bearer |
| POST | `/api/v1/auth/logout` | Bearer |

### Devices (User)
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/v1/devices/pairing-code` | Bearer |
| GET | `/api/v1/devices` | Bearer |
| GET | `/api/v1/devices/:deviceId` | Bearer |
| DELETE | `/api/v1/devices/:deviceId` | Bearer |

### Device Agent (Android App)
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/v1/device-agent/pair` | None (code) |
| POST | `/api/v1/device-agent/heartbeat` | DeviceToken |
| GET | `/api/v1/device-agent/status` | DeviceToken |
| POST | `/api/v1/device-agent/disconnect` | DeviceToken |
| GET | `/api/v1/device-agent/sms/next` | DeviceToken |
| POST | `/api/v1/device-agent/sms/report` | DeviceToken |
| GET | `/api/v1/device-agent/sms/queue-status` | DeviceToken |

### SMS
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/v1/sms/bulk` | Bearer |
| GET | `/api/v1/sms/campaigns` | Bearer |
| GET | `/api/v1/sms/campaigns/:id` | Bearer |
| GET | `/api/v1/sms/campaigns/:id/jobs` | Bearer |
| POST | `/api/v1/sms/campaigns/:id/cancel` | Bearer |

### Payments
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/v1/payments/plans` | Bearer |
| GET | `/api/v1/payments/subscription` | Bearer |
| GET | `/api/v1/payments/subscription/history` | Bearer |
| POST | `/api/v1/payments/submit` | Bearer |
| GET | `/api/v1/payments` | Bearer |
| GET | `/api/v1/payments/:paymentId` | Bearer |

### Admin
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/v1/admin/users` | Bearer (admin) |
| GET | `/api/v1/admin/users/stats` | Bearer (admin) |
| GET | `/api/v1/admin/users/recent` | Bearer (admin) |
| GET | `/api/v1/admin/users/:userId` | Bearer (admin) |
| PATCH | `/api/v1/admin/users/:userId/role` | Bearer (admin) |
| PATCH | `/api/v1/admin/users/:userId/status` | Bearer (admin) |
| POST | `/api/v1/admin/users/:userId/verify-email` | Bearer (admin) |
| GET | `/api/v1/admin/payments` | Bearer (admin) |
| GET | `/api/v1/admin/payments/stats` | Bearer (admin) |
| POST | `/api/v1/admin/payments/review` | Bearer (admin) |
| GET | `/api/v1/admin/content` | Bearer (admin) |
| GET | `/api/v1/admin/content/:key` | Bearer (admin) |
| POST | `/api/v1/admin/content` | Bearer (admin) |
| DELETE | `/api/v1/admin/content/:key` | Bearer (admin) |
| GET | `/api/v1/admin/plans` | Bearer (admin) |
| GET | `/api/v1/admin/plans/:planId` | Bearer (admin) |
| POST | `/api/v1/admin/plans` | Bearer (admin) |
| PATCH | `/api/v1/admin/plans/:planId/toggle` | Bearer (admin) |
| DELETE | `/api/v1/admin/plans/:planId` | Bearer (admin) |
| GET | `/api/v1/admin/settings` | Bearer (admin) |
| GET | `/api/v1/admin/settings/:key` | Bearer (admin) |
| POST | `/api/v1/admin/settings` | Bearer (admin) |
| POST | `/api/v1/admin/settings/bulk` | Bearer (admin) |
| DELETE | `/api/v1/admin/settings/:key` | Bearer (admin) |
| GET | `/api/v1/admin/security/audit-logs` | Bearer (admin) |
| GET | `/api/v1/admin/security/security-events` | Bearer (admin) |
| GET | `/api/v1/admin/jobs` | Bearer (admin) |
| GET | `/api/v1/admin/jobs/logs` | Bearer (admin) |
| POST | `/api/v1/admin/jobs/:jobName/trigger` | Bearer (admin) |
| POST | `/api/v1/admin/seed` | Bearer (admin) |

---

*End of Documentation*