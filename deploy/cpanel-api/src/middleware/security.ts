import helmet from "helmet";
import rateLimit from "express-rate-limit";

export const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // for viewing uploaded receipts
});

export const generalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
