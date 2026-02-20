import "dotenv/config";
import express from "express";
import cors from "cors";
import { helmetMiddleware, generalLimiter } from "./middleware/security.js";
import { logger } from "./middleware/logger.js";
import path from "path";

import { authRouter } from "./routes/auth.js";
import { pricingRouter } from "./routes/pricing.js";
import { ordersRouter } from "./routes/orders.js";
import { adminRouter } from "./routes/admin.js";
import { settingsRouter } from "./routes/settings.js";
import { publicRouter } from "./routes/public.js";

const app = express();

app.use(logger);
app.use(helmetMiddleware);
app.use(generalLimiter);


app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: "2mb" }));

// static uploads
app.use("/uploads", express.static(path.resolve(process.env.UPLOAD_DIR || "uploads")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/pricing", pricingRouter);
app.use("/orders", ordersRouter);
app.use("/admin", adminRouter);
app.use("/settings", settingsRouter);
app.use("/public", publicRouter);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("[API_ERROR]", err);
  res.status(500).json({ error: "INTERNAL_ERROR" });
});
