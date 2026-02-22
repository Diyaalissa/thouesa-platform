import express from "express";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { requestLogger } from "./middleware/logger.js";
import { authRouter } from "./routes/auth.js";
import { ordersRouter } from "./routes/orders.js";
import { adminRouter } from "./routes/admin.js";
import { pricingRouter } from "./routes/pricing.js";
import { publicRouter } from "./routes/public.js";
import { settingsRouter } from "./routes/settings.js";
import { logger } from "./logger.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(helmet());

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(requestLogger);

/* static uploads */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/orders", ordersRouter);
app.use("/admin", adminRouter);
app.use("/pricing", pricingRouter);
app.use("/public", publicRouter);
app.use("/settings", settingsRouter);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => logger.info({ port }, "api_ready"));