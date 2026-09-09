# Messages Lab Backend

Backend API for Messages Lab, a platform that uses a user's Android device and SIM card as an SMS gateway. The service provides authentication, device pairing, SMS campaigns, payments, subscriptions, admin tools, email verification, scheduled jobs, and public site content.

## Stack

- Node.js and TypeScript
- Express 5
- MongoDB with Mongoose
- Upstash Redis for caching and queues
- Resend for transactional email
- Cloudinary for image storage
- JWT access and refresh tokens
- Zod request and environment validation

## Requirements

- Node.js 20 or newer
- npm
- MongoDB
- Optional integrations: Upstash Redis, Resend, Cloudinary, and Google OAuth

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   copy .env.example .env
   ```

   On macOS or Linux, use `cp .env.example .env` instead. Set `MONGODB_URI` and `SESSION_SECRET` at minimum, then configure the integrations required by your deployment.

3. Start the development server:

   ```bash
   npm run dev
   ```

The API runs on `http://localhost:5000` by default. The root endpoint returns service information, and the health endpoint is available at `/api/v1/health`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with file watching |
| `npm run build` | Compile TypeScript into `dist/` |
| `npm run typecheck` | Validate types without emitting files |
| `npm start` | Run the compiled production server |

## API

All versioned endpoints use the `/api/v1` prefix. Main route groups include:

- `/api/v1/health` - health checks
- `/api/v1/public` - public website content
- `/api/v1/auth` - registration, login, OAuth, and token refresh
- `/api/v1/devices` - user device management
- `/api/v1/device-agent` - Android device-agent integration
- `/api/v1/sms` - SMS campaigns and incoming messages
- `/api/v1/payments` - payment submissions and subscriptions
- `/api/v1/admin` - administrative operations

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for request and response examples, authentication flows, data models, environment variables, and the complete endpoint reference.

## Authentication

User endpoints use:

```text
Authorization: Bearer <access-token>
```

Android device-agent endpoints use:

```text
Authorization: DeviceToken <device-token>
```

Refresh tokens are managed through an HTTP-only cookie.

## Production Notes

- Never commit `.env` or real credentials. Use `.env.example` as the configuration template.
- Use unique secrets of at least 32 characters for session and JWT signing values.
- Configure `FRONTEND_URL`, `ADMIN_URL`, `API_URL`, and trusted integration credentials for the deployed environment.
- Run `npm run build` and `npm start` in production.
- The server seeds default content and starts scheduled jobs during startup.

### Render Deployment

The included `render.yaml` configures Render to install dependencies, compile TypeScript, and then start the compiled server. If the service was created manually, use these commands in the Render service settings:

```text
Build Command: npm ci && npm run build
Start Command: npm start
Health Check Path: /api/v1/health
```

Add the values from your local environment as Render environment variables. Do not upload the `.env` file.

## License

This project is private and not currently distributed under an open-source license.

## Maintainer

Mahin Ltd - info.mahin.ltd@gmail.com
