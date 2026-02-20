import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendOtpEmail } from "../utils/mailer";
import { otpLimiter } from "../middleware/security.js";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

export const authRouter = Router();

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

  const { fullName, email, phone, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "EMAIL_EXISTS" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { fullName, email, phone, passwordHash } });

  const token = signToken({ id: user.id, role: user.role });
  res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION" });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  const token = signToken({ id: user.id, role: user.role });
  res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } });
});

const requestCodeSchema = z.object({
  email: z.string().email(),
  fullName: z.string().optional(),
  phoneCountryCode: z.enum(["+213", "+962"]).optional(),
  phoneNumber: z.string().min(6).max(20).optional(),
});

authRouter.post("/request-code", otpLimiter, async (req, res) => {
  const parsed = requestCodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION" });

  const { email, fullName, phoneCountryCode, phoneNumber } = parsed.data;

  // Create user if not exists (OTP flow). passwordHash will be random.
  let user = await prisma.user.findUnique({ where: { email } });
  if (user && (phoneCountryCode || phoneNumber)) {
    // Update phone info if provided (and empty currently)
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
        fullName: fullName || email.split("@")[0],
        email,
        passwordHash,
        phoneCountryCode,
        phoneNumber,
      },
    });
  }

  const code = (Math.floor(100000 + Math.random() * 900000)).toString(); // 6 digits
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.emailOtp.create({ data: { email, codeHash, expiresAt } });
  await sendOtpEmail(email, code);

  res.json({ ok: true });
});

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4),
});

authRouter.post("/verify-code", async (req, res) => {
  const parsed = verifyCodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION" });

  const { email, code } = parsed.data;

  const latest = await prisma.emailOtp.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return res.status(400).json({ error: "CODE_NOT_FOUND" });
  if (latest.expiresAt.getTime() < Date.now()) return res.status(400).json({ error: "CODE_EXPIRED" });

// Brute-force protection
if (latest.attempts >= 5) return res.status(429).json({ error: "TOO_MANY_ATTEMPTS" });

const ok = await bcrypt.compare(code, latest.codeHash);
if (!ok) {
  await prisma.emailOtp.update({
    where: { id: latest.id },
    data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
  });
  return res.status(400).json({ error: "CODE_INVALID" });
}

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ error: "USER_NOT_FOUND" });

  const token = signToken({ id: user.id, role: user.role });
  res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } });
});

authRouter.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, fullName: true, email: true, role: true } });
  res.json({ user });
});
