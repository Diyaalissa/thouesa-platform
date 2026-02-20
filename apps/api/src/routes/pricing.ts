import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { OrderDirection } from "@prisma/client";

export const pricingRouter = Router();

const estimateSchema = z.object({
  direction: z.enum(["JO_TO_DZ", "DZ_TO_JO"]),
  weightKg: z.number().positive(),
});

pricingRouter.post("/estimate", async (req, res) => {
  const parsed = estimateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION" });

  const { direction, weightKg } = parsed.data;

  const rule = await prisma.pricingRule.findFirst({
    where: { direction: direction as OrderDirection, fromKg: { lte: weightKg }, toKg: { gt: weightKg } },
    orderBy: { fromKg: "desc" },
  });

  if (!rule) return res.status(404).json({ error: "NO_PRICING_RULE" });

  res.json({ direction, weightKg, estimatedPrice: rule.price, currency: rule.currency });
});

pricingRouter.post("/estimate-simple", async (req, res) => {
  const { direction, weightKg } = req.body || {};
  if (!direction || typeof weightKg !== "number") return res.status(400).json({ error: "VALIDATION" });

  const s = await prisma.setting.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });

  const basePerKg = direction === "JO_TO_DZ" ? s.shipJodPerKg_JO_TO_DZ : s.shipDzdPerKg_DZ_TO_JO;
  let price = basePerKg * weightKg;

  if (s.promoActive && s.promoDiscountPercent) {
    price = price * (1 - s.promoDiscountPercent / 100);
  }

  res.json({ price, currency: direction === "JO_TO_DZ" ? "JOD" : "DZD" });
});
