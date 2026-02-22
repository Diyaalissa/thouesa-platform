import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { logger } from './logger.js';
import { helmetMiddleware } from "./middleware/security.js";

// استدعاء المسارات
import { authRouter } from "./routes/auth.js";
import { pricingRouter } from "./routes/pricing.js";
import { ordersRouter } from "./routes/orders.js";
import { adminRouter } from "./routes/admin.js";
import { settingsRouter } from "./routes/settings.js";
import { publicRouter } from "./routes/public.js";

const app = express();

// 1. المراقبة والأمان
app.use(pinoHttp({ logger }));
app.use(helmetMiddleware);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'LIMIT_EXCEEDED', message: 'تجاوزت الحد المسموح.' },
});
app.use(apiLimiter);

// 2. معالجة البيانات
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.text({ type: "text/plain" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Middleware لتحويل النصوص إلى JSON تلقائياً
app.use((req, res, next) => {
  if (req.is('text/plain') && typeof req.body === 'string') {
    try { req.body = JSON.parse(req.body); } catch (e) {}
  }
  next();
});

// 3. المسارات (API Routes)
app.use("/auth", authRouter);
app.use("/pricing", pricingRouter);
app.use("/orders", ordersRouter);
app.use("/admin", adminRouter);
app.use("/settings", settingsRouter);
app.use("/public", publicRouter);

app.use("/uploads", express.static(path.resolve(process.env.UPLOAD_DIR || "uploads")));
app.get("/health", (_req, res) => res.json({ success: true, status: "UP" }));

// 4. معالج الأخطاء المركزي (Centralized Error Handler) - القوة النارية هنا
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || 500;
  const errorCode = err.code || "INTERNAL_ERROR";
  
  logger.error({
    err: { message: err.message, stack: err.stack },
    url: req.url,
    method: req.method,
    body: req.body
  }, `[API_EXCEPTION] ${errorCode}`);

  res.status(statusCode).json({
    success: false,
    data: null,
    error: errorCode,
    message: process.env.NODE_ENV === 'development' ? err.message : "حدث خطأ داخلي في النظام"
  });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  logger.info(`🚀 THOUESA PRO-API listening on http://localhost:${port}`);
});