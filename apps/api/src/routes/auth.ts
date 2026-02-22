import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendOtpEmail } from "../utils/mailer.js";
import { otpLimiter } from "../middleware/security.js";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { logger } from "../logger.js";

export const authRouter = Router();

const requestCodeSchema = z.object({
  email: z.string().email(),
  fullName: z.string().optional(),
  phoneCountryCode: z.string().optional(),
  phoneNumber: z.string().optional(),
});

authRouter.post("/request-code", otpLimiter, async (req, res, next) => {
  try {
    const parsed = requestCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const { email, fullName, phoneCountryCode, phoneNumber } = parsed.data;

    // استخدام Prisma Transaction لضمان الذرية (Atomicity)
    const result = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });
      
      if (!user) {
        const randomPass = crypto.randomBytes(16).toString("hex");
        const passwordHash = await bcrypt.hash(randomPass, 10);
        user = await tx.user.create({
          data: {
            fullName: fullName || email.split("@")[0],
            email,
            passwordHash,
            phoneCountryCode,
            phoneNumber,
          },
        });
      }

      const code = (Math.floor(100000 + Math.random() * 900000)).toString();
      const codeHash = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await tx.emailOtp.create({ data: { email, codeHash, expiresAt } });
      return { email, code };
    });

    await sendOtpEmail(result.email, result.code);
    
    res.json({ success: true, data: { message: "OTP_SENT" } });
  } catch (error) {
    next(error); // تمرير الخطأ لمعالج الأخطاء المركزي
  }
});

authRouter.post("/verify-code", async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, error: "MISSING_FIELDS" });

    const latest = await prisma.emailOtp.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });

    if (!latest || latest.expiresAt < new Date() || latest.attempts >= 5) {
      return res.status(400).json({ success: false, error: "INVALID_OR_EXPIRED_CODE" });
    }

    const ok = await bcrypt.compare(code, latest.codeHash);
    if (!ok) {
      await prisma.emailOtp.update({ where: { id: latest.id }, data: { attempts: { increment: 1 } } });
      return res.status(400).json({ success: false, error: "WRONG_CODE" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const token = signToken({ id: user!.id, role: user!.role });

    res.json({
      success: true,
      data: { token, user: { id: user!.id, fullName: user!.fullName, role: user!.role } }
    });
  } catch (error) {
    next(error);
  }
});