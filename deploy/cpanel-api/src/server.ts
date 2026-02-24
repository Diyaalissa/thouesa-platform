import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import rateLimit from "express-rate-limit";
import pinoHttpImport from "pino-http";
import type { IncomingMessage, ServerResponse } from "http";

import { logger } from "./logger.js";
import { helmetMiddleware } from "./middleware/security.js";

import { authRouter } from "./routes/auth.js";
import { pricingRouter } from "./routes/pricing.js";
import { ordersRouter } from "./routes/orders.js";
import { adminRouter } from "./routes/admin.js";
import { settingsRouter } from "./routes/settings.js";
import { publicRouter } from "./routes/public.js";

const pinoHttp = ((pinoHttpImport as any).default ?? pinoHttpImport) as any;

const app = express();

app.use(
  pinoHttp({
    logger,
    redact: ["req.headers.authorization"],
    customSuccessMessage: (req: IncomingMessage, res: ServerResponse) =>
      `${req.method} ${req.url} completed with ${res.statusCode}`,
    customErrorMessage: (req: IncomingMessage, _res: ServerResponse, err: Error) =>
      `${req.method} ${req.url} failed: ${err.message}`,
  })
);

app.use(helmetMiddleware);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: { error: "RATE_LIMIT" },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.text({ type: "text/plain" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// لو وصل نص JSON كـ text/plain
app.use((req, _res, next) => {
  if (req.is("text/plain") && typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body);
    } catch {}
  }
  next();
});

app.use("/uploads", express.static(path.resolve(process.env.UPLOAD_DIR || "uploads")));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/pricing", pricingRouter);
app.use("/orders", ordersRouter);
app.use("/admin", adminRouter);
app.use("/settings", settingsRouter);
app.use("/public", publicRouter);

app.use((err: any, req: any, res: any, _next: any) => {
  logger.error({ err, url: req.url, body: req.body }, "CRITICAL_ERROR");
  res.status(err?.status || 500).json({ error: "INTERNAL_ERROR" });
});
import { prisma } from "./lib/prisma.js"; // عدّل المسار لو لزم

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      status: "UP",
      database: "CONNECTED",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      success: false,
      status: "DOWN",
      database: "DISCONNECTED",
      timestamp: new Date().toISOString(),
      error:
        process.env.NODE_ENV === "development"
          ? String(err?.message || err)
          : "Database connection failed",
    });
  }
});
app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "thouesa-api",
    routes: ["/health"],
  });
});
const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  logger.info(`API listening on http://localhost:${port}`);
});