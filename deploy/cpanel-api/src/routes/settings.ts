import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

export const settingsRouter = Router();

/**
 * جلب الإعدادات العامة (متاحة للجميع)
 */
settingsRouter.get("/public", async (_req, res) => {
  try {
    const s = await prisma.setting.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });

    res.json({
      facebookUrl: s.facebookUrl,
      whatsappUrl: s.whatsappUrl,
      promoActive: s.promoActive,
      promoName: s.promoName,
      promoDiscountPercent: s.promoDiscountPercent,
    });
  } catch (error) {
    res.status(500).json({ error: "FAILED_TO_FETCH_SETTINGS" });
  }
});

const updateSchema = z.object({
  facebookUrl: z.string().url().optional().nullable(),
  whatsappUrl: z.string().url().optional().nullable(),
  shipJodPerKg_JO_TO_DZ: z.number().optional(),
  shipDzdPerKg_DZ_TO_JO: z.number().optional(),
  commissionPercent: z.number().optional(),
  promoActive: z.boolean().optional(),
  promoName: z.string().optional().nullable(),
  promoDiscountPercent: z.number().optional().nullable(),
  usdtDzdPrice: z.number().optional().nullable(),
  usdtMarkupPercent: z.number().optional().nullable(),
});

/**
 * جلب الإعدادات كاملة للمدير (تم تصحيح requireAuth بحذف الأقواس)
 */
settingsRouter.get("/admin", requireAuth, async (_req, res) => {
  try {
    const s = await prisma.setting.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    res.json({ setting: s });
  } catch (error) {
    res.status(500).json({ error: "ADMIN_SETTINGS_ERROR" });
  }
});

/**
 * تحديث الإعدادات (تم تصحيح requireAuth بحذف الأقواس)
 */
settingsRouter.put("/admin", requireAuth, async (req, res) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION" });

    const s = await prisma.setting.upsert({
      where: { id: "singleton" },
      update: parsed.data,
      create: { id: "singleton", ...parsed.data },
    });
    res.json({ setting: s });
  } catch (error) {
    res.status(500).json({ error: "UPDATE_SETTINGS_ERROR" });
  }
});