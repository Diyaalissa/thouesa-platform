import { prisma } from "../lib/prisma.js";

export interface FinancialReport {
  totalRevenue: number;
  totalCommissions: number;
  netAmount: number;
  orderCount: number;
}

export class FinanceService {
  /**
   * توليد تقرير مالي لفترة زمنية محددة
   */
  static async getRevenueReport(startDate?: Date, endDate?: Date): Promise<FinancialReport> {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ["CONFIRMED", "SHIPPED", "ARRIVED", "DELIVERED"] },
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      },
      select: {
        priceFinal: true,
        priceEstimated: true,
      },
    });

    const settings = await prisma.setting.findUnique({ where: { id: "singleton" } });
    const commissionPercent = settings?.commissionPercent || 0;

    let totalRevenue = 0;
    let totalCommissions = 0;

    orders.forEach((order) => {
      const amount = order.priceFinal || order.priceEstimated || 0;
      totalRevenue += amount;
      totalCommissions += (amount * commissionPercent) / 100;
    });

    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCommissions: parseFloat(totalCommissions.toFixed(2)),
      netAmount: parseFloat((totalRevenue - totalCommissions).toFixed(2)),
      orderCount: orders.length,
    };
  }
}