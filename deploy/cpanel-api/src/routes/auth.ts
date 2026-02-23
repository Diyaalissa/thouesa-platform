import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../middleware/auth.js";
import { otpLimiter } from "../middleware/security.js";
import { sendOtpEmail } from "../utils/mailer.js";
import { logger } from "../logger.js";

export const authRouter = Router();

/* ===================== Schemas ===================== */

const registerSchema = z.object({
  fullName: z.string().min(2, "الاسم الكامل قصير جداً"),
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  phone: z.string().optional(),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

const loginSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

const requestCodeSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  fullName: z.string().optional(),
  phoneCountryCode: z.string().optional(),
  phoneNumber: z.string().min(6, "رقم الهاتف قصير جداً").max(20).optional(),
});

const verifyCodeSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  code: z.string().min(4, "الكود غير مكتمل"),
});

/* ===================== Routes ===================== */

// Register (password)
authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  }

  const { fullName, email, phone, password } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "EMAIL_EXISTS" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { fullName, email, phone: phone ?? null, passwordHash },
      select: { id: true, fullName: true, email: true, role: true },
    });

    const token = signToken({ id: user.id, role: user.role });
    return res.json({ token, user });
  } catch (err) {
    logger.error(err, "Registration Error");
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// Login (password)
authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const token = signToken({ id: user.id, role: user.role });
    return res.json({
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    });
  } catch (err) {
    logger.error(err, "Login Error");
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// Request OTP
authRouter.post("/request-code", otpLimiter, async (req, res) => {
  logger.info({ body: req.body }, "Requesting OTP Code");

  const parsed = requestCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.error(parsed.error.flatten(), "OTP Validation Failed");
    return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  }

  const { email, fullName, phoneCountryCode, phoneNumber } = parsed.data;

  try {
    let user = await prisma.user.findUnique({ where: { email } });

    if (user && (phoneCountryCode || phoneNumber)) {
      if (!user.phoneCountryCode || !user.phoneNumber) {
        user = await prisma.user.update({
          where: { email },
          data: {
            phoneCountryCode: phoneCountryCode ?? user.phoneCountryCode,
            phoneNumber: phoneNumber ?? user.phoneNumber,
          },
        });
      }
    }

    if (!user) {
      const randomPass = crypto.randomBytes(16).toString("hex");
      const passwordHash = await bcrypt.hash(randomPass, 10);

      user = await prisma.user.create({
        data: {
          fullName: fullName || email.split("@")[0]!,
          email,
          passwordHash,
          phoneCountryCode: phoneCountryCode ?? null,
          phoneNumber: phoneNumber ?? null,
        },
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.emailOtp.create({ data: { email, codeHash, expiresAt } });

    await sendOtpEmail(email, code);

    logger.info({ email }, "OTP Sent Successfully");
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error(err, "OTP Request Flow Error");
    return res.status(500).json({ error: "SEND_EMAIL_FAILED", message: err?.message });
  }
});

// Verify OTP
authRouter.post("/verify-code", async (req, res) => {
  const parsed = verifyCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  }

  const { email, code } = parsed.data;

  try {
    const latest = await prisma.emailOtp.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });

    if (!latest) return res.status(400).json({ error: "CODE_NOT_FOUND" });
    if (latest.expiresAt.getTime() < Date.now()) return res.status(400).json({ error: "CODE_EXPIRED" });
    if (latest.attempts >= 5) return res.status(429).json({ error: "TOO_MANY_ATTEMPTS" });

    const ok = await bcrypt.compare(code, latest.codeHash);
    if (!ok) {
      await prisma.emailOtp.update({
        where: { id: latest.id },
        data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
      });
      return res.status(400).json({ error: "CODE_INVALID" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, fullName: true, email: true, role: true },
    });
    if (!user) return res.status(400).json({ error: "USER_NOT_FOUND" });

    const token = signToken({ id: user.id, role: user.role });
    return res.json({ token, user });
  } catch (err) {
    logger.error(err, "Verify Code Error");
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// Me (token)
authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const r = req as AuthRequest;

    const user = await prisma.user.findUnique({
      where: { id: r.user!.id },
      select: { id: true, fullName: true, email: true, role: true },
    });

    return res.json({ user });
  } catch {
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});