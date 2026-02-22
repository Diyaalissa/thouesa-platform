import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";

// --- استدعاء مكتبات الحماية والمراقبة ---
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { logger } from './logger.js';
import { helmetMiddleware } from "./middleware/security.js";

// --- استدعاء المسارات ---
import { authRouter } from "./routes/auth.js";
import { pricingRouter } from "./routes/pricing.js";
import { ordersRouter } from "./routes/orders.js";
import { adminRouter } from "./routes/admin.js";
import { settingsRouter } from "./routes/settings.js";
import { publicRouter } from "./routes/public.js";

const app = express();

// 1. المراقبة والأمان
app.use(pinoHttp({ 
  logger,
  customSuccessMessage: (req, res) => `${req.method} ${req.url} completed with ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} failed: ${err.message}`
}));

app.use(helmetMiddleware);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'عذراً، لقد تجاوزت الحد المسموح. يرجى المحاولة لاحقاً.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(apiLimiter);

// 2. معالجة البيانات (المفتاح لحل مشكلة VALIDATION)
app.use(cors({ origin: true, credentials: true }));

// دعم JSON والنصوص العادية
app.use(express.json({ limit: "5mb" }));
app.use(express.text({ type: "text/plain" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Middleware ذكي لتحويل النص القادم من المتصفح إلى JSON
app.use((req, res, next) => {
  if (req.is('text/plain') && typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      // ليس JSON، نتركه كما هو
    }
  }
  next();
});

app.use("/uploads", express.static(path.resolve(process.env.UPLOAD_DIR || "uploads")));
app.get("/health", (_req, res) => res.json({ ok: true }));

// 3. المسارات
app.use("/auth", authRouter);
app.use("/pricing", pricingRouter);
app.use("/orders", ordersRouter);
app.use("/admin", adminRouter);
app.use("/settings", settingsRouter);
app.use("/public", publicRouter);

// 4. معالجة الأخطاء
app.use((err: any, req: any, res: any, _next: any) => {
  logger.error({ err, url: req.url, body: req.body }, "CRITICAL_ERROR");
  res.status(err.status || 500).json({ error: "INTERNAL_ERROR" });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  logger.info(`🚀 API listening on http://localhost:${port}`);
});