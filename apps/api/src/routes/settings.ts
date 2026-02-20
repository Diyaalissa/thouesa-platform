import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

export const settingsRouter = Router();

settingsRouter.get("/public", async (_req, res) => {
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

settingsRouter.get("/admin", requireAuth("ADMIN"), async (_req, res) => {
  const s = await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  res.json({ setting: s });
});

settingsRouter.put("/admin", requireAuth("ADMIN"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION" });

  const s = await prisma.setting.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  });
  res.json({ setting: s });
});
