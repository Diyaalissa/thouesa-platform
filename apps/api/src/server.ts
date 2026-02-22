import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { logger } from './logger.js';
import { helmetMiddleware } from "./middleware/security.js";
import { prisma } from "./lib/prisma.js";

// استدعاء المسارات
import { authRouter } from "./routes/auth.js";
import { pricingRouter } from "./routes/pricing.js";
import { ordersRouter } from "./routes/orders.js";
import { adminRouter } from "./routes/admin.js";
import { settingsRouter } from "./routes/settings.js";
import { publicRouter } from "./routes/public.js";

const app = express();

// 1. الأمان والمراقبة
app.use(pinoHttp({ logger }));
app.use(helmetMiddleware);

// تقييد الطلبات في الإنتاج (Production Rate Limiting)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 100 : 1000,
  message: { success: false, error: "TOO_MANY_REQUESTS" },
});
app.use("/auth/", apiLimiter);

// 2. إعدادات الوصول ومعالجة البيانات
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(",") || true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" })); // رفع الحد لرفع الصور
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 3. المسارات
app.use("/auth", authRouter);
app.use("/pricing", pricingRouter);
app.use("/orders", ordersRouter);
app.use("/admin", adminRouter);
app.use("/settings", settingsRouter);
app.use("/public", publicRouter);

app.use("/uploads", express.static(path.resolve(process.env.UPLOAD_DIR || "uploads")));

// فحص الصحة المطور (Health Check)
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`; // التأكد من اتصال قاعدة البيانات
    res.json({ success: true, status: "HEALTHY", timestamp: new Date() });
  } catch (e) {
    res.status(503).json({ success: false, status: "UNHEALTHY" });
  }
});

// 4. معالجة الأخطاء الشاملة
app.use((err: any, req: any, res: any, next: any) => {
  logger.error({ err, url: req.url }, "UNHANDLED_ERROR");
  res.status(err.status || 500).json({
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// 5. تشغيل الخادم مع نظام الإغلاق الآمن (Graceful Shutdown)
const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => {
  logger.info(`🚀 THOUESA PRODUCTION-READY API: http://localhost:${port}`);
});

const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("Database disconnected. Server closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));