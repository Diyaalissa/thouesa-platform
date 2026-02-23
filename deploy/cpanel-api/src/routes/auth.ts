import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendOtpEmail } from "../utils/mailer.js"; // تأكد من وجود .js
import { otpLimiter } from "../middleware/security.js";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { logger } from "../logger.js";

export const authRouter = Router();

// --- 1. شروط التحقق (Schemas) ---

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
  // جعلنا الكود يقبل نصوصاً مرنة لاستيعاب ما يرسله المتصفح مثل "الجزائر (+213)"
  phoneCountryCode: z.string().optional(),
  phoneNumber: z.string().min(6, "رقم الهاتف قصير جداً").max(20).optional(),
});

const verifyCodeSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  code: z.string().min(4, "الكود غير مكتمل"),
});

// --- 2. المسارات (Routes) ---

/**
 * تسجيل مستخدم جديد بالطريقة التقليدية
 */
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
    const user = await prisma.user.create({ data: { fullName, email, phone, passwordHash } });

    const token = signToken({ id: user.id, role: user.role });
    res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } });
  } catch (error) {
    logger.error(error, "Registration Error");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * تسجيل الدخول التقليدي
 */
authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION" });

  const { email, password } = parsed.data;
  
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const token = signToken({ id: user.id, role: user.role });
    res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } });
  } catch (error) {
    logger.error(error, "Login Error");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * طلب رمز التحقق (OTP) - هذا هو المسار الذي كان يعطيك VALIDATION
 */
authRouter.post("/request-code", otpLimiter, async (req, res) => {
  // طباعة البيانات القادمة للمراقبة
  logger.info({ body: req.body }, "Requesting OTP Code");

  const parsed = requestCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.error(parsed.error.flatten(), "OTP Validation Failed");
    return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  }

  const { email, fullName, phoneCountryCode, phoneNumber } = parsed.data;

  try {
    let user = await prisma.user.findUnique({ where: { email } });
    
    // تحديث بيانات الهاتف إذا كان المستخدم موجوداً وبياناته ناقصة
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

    // إنشاء مستخدم جديد بكلمة سر عشوائية إذا لم يكن موجوداً
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

    // توليد وتشفير الرمز
    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // صالح لـ 10 دقائق

    await prisma.emailOtp.create({ data: { email, codeHash, expiresAt } });
    
    // إرسال البريد الإلكتروني
    await sendOtpEmail(email, code);
    
    logger.info({ email }, "OTP Sent Successfully");
    res.json({ ok: true });

  } catch (error: any) {
    logger.error(error, "OTP Request Flow Error");
    res.status(500).json({ error: "SEND_EMAIL_FAILED", message: error.message });
  }
});

/**
 * التحقق من رمز OTP وتسجيل الدخول
 */
authRouter.post("/verify-code", async (req, res) => {
  const parsed = verifyCodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION" });

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

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "USER_NOT_FOUND" });

    const token = signToken({ id: user.id, role: user.role });
    res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } });
  } catch (error) {
    logger.error(error, "Verify Code Error");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * الحصول على بيانات المستخدم الحالي عبر التوكن
 */
authRouter.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { id: req.user!.id }, 
      select: { id: true, fullName: true, email: true, role: true } 
    });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});