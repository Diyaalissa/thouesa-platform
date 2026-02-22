import { prisma } from "../lib/prisma.js";
import { logger } from "../logger.js";

export interface PriceCalculationResult {
  basePrice: number;
  commission: number;
  totalPrice: number;
  currency: string;
}

export class PricingService {
  /**
   * حساب السعر بناءً على الوزن، الاتجاه، والقواعد المخزنة
   */
  static async calculatePrice(
    weightKg: number,
    direction: "JO_TO_DZ" | "DZ_TO_JO"
  ): Promise<PriceCalculationResult> {
    try {
      // 1. جلب قواعد التسعير المناسبة للاتجاه
      const rules = await prisma.pricingRule.findMany({
        where: { direction, active: true },
        orderBy: { minWeight: "asc" },
      });

      if (rules.length === 0) {
        throw new Error(`NO_PRICING_RULES_FOUND_FOR_${direction}`);
      }

      // 2. البحث عن الشريحة (Slab) المناسبة للوزن
      const matchedRule = rules.find(
        (r) => weightKg >= r.minWeight && weightKg <= r.maxWeight
      );

      if (!matchedRule) {
        throw new Error("WEIGHT_OUT_OF_DEFINED_SLABS");
      }

      // 3. جلب نسبة العمولة من الإعدادات العامة
      const settings = await prisma.setting.findUnique({
        where: { id: "singleton" },
      });

      const commissionPercent = settings?.commissionPercent || 0;
      const basePrice = weightKg * matchedRule.pricePerKg;
      const commission = (basePrice * commissionPercent) / 100;
      const totalPrice = basePrice + commission;

      return {
        basePrice: parseFloat(basePrice.toFixed(2)),
        commission: parseFloat(commission.toFixed(2)),
        totalPrice: parseFloat(totalPrice.toFixed(2)),
        currency: direction === "JO_TO_DZ" ? "JOD" : "DZD",
      };
    } catch (error: any) {
      logger.error({ error: error.message, weightKg, direction }, "PRICING_CALCULATION_FAILED");
      throw error;
    }
  }
}