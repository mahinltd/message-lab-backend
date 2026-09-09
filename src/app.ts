import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env, isProduction } from "./config/env";
import { requestContextMiddleware } from "./middleware/requestContext.middleware";
import { notFoundMiddleware } from "./middleware/notFound.middleware";
import { errorMiddleware } from "./middleware/error.middleware";
import { globalRateLimiter } from "./middleware/globalRateLimit.middleware";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import deviceRoutes from "./routes/device.routes";
import deviceAgentRoutes from "./routes/deviceAgent.routes";
import smsRoutes from "./routes/sms.routes";
import paymentRoutes from "./routes/payment.routes";
import publicRoutes from "./routes/public.routes";
import { logger } from "./utils/logger";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet());

const allowedOrigins = [
  env.FRONTEND_URL,
  env.ADMIN_URL,
  "http://192.168.0.110:3000"
].filter(
  (origin): origin is string => Boolean(origin)
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser(env.SESSION_SECRET));

app.use(requestContextMiddleware);
app.use(globalRateLimiter);

if (env.NODE_ENV !== "test") {
  app.use(
    morgan(isProduction ? "combined" : "dev", {
      stream: {
        write: (message: string) => {
          logger.http(message.trim());
        },
      },
    })
  );
}

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "Messages Lab Backend API",
    health: "/api/v1/health",
    publicContent: "/api/v1/public/content",
  });
});

// Public routes (no authentication required)
app.use("/api/v1/public", publicRoutes);

// API Routes
app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/devices", deviceRoutes);
app.use("/api/v1/device-agent", deviceAgentRoutes);
app.use("/api/v1/sms", smsRoutes);
app.use("/api/v1/payments", paymentRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;