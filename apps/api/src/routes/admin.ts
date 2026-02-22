import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { z } from "zod";
import { OrderStatus } from "@prisma/client";
import { logger } from "../logger.js";
import crypto from "crypto";
import { FinanceService } from "../services/finance.service.js";

/**
 * 6. تقرير مالي شامل (Phase 5)
 */
adminRouter.get("/finance/report", async (req, res, next) => {
  try {
    const { start, end } = req.query;
    const startDate = start ? new Date(start as string) : undefined;
    const endDate = end ? new Date(end as string) : undefined;

    const report = await FinanceService.getRevenueReport(startDate, endDate);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 7. جلب بيانات الفاتورة لطلب محدد
 */
adminRouter.get("/orders/:id/invoice", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { fullName: true, email: true } },
        senderAddress: true,
        receiverAddress: true,
        payments: { where: { status: "CONFIRMED" } }
      }
    });

    if (!order) return res.status(404).json({ success: false, error: "ORDER_NOT_FOUND" });

    // حساب التفاصيل المالية للفاتورة
    const settings = await prisma.setting.findUnique({ where: { id: "singleton" } });
    const amount = order.priceFinal || order.priceEstimated || 0;
    const taxAmount = 0; // يمكن إضافته لاحقاً من الإعدادات

    res.json({
      success: true,
      data: {
        invoiceNumber: `INV-${order.orderNumber}`,
        date: new Date(),
        customer: order.user,
        details: {
          orderNumber: order.orderNumber,
          weight: order.weightFinalKg || order.weightDeclaredKg,
          direction: order.direction,
          amount: amount,
          commission: (amount * (settings?.commissionPercent || 0)) / 100,
          total: amount + taxAmount
        },
        addresses: {
          from: order.senderAddress,
          to: order.receiverAddress
        }
      }
    });
  } catch (error) {
    next(error);
  }
});
export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

/**
 * 1. إحصائيات لوحة التحكم
 */
adminRouter.get("/dashboard/summary", async (_req, res, next) => {
  try {
    const [totalOrders, pendingOrders, revenue] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.aggregate({
        _sum: { priceEstimated: true },
        where: { status: { in: ["CONFIRMED", "SHIPPED", "ARRIVED", "DELIVERED"] } }
      })
    ]);
    res.json({ success: true, data: { totalOrders, pendingOrders, totalRevenue: revenue._sum.priceEstimated || 0 } });
  } catch (error) { next(error); }
});

/**
 * 2. جلب الطلبات بالفلاتر
 */
adminRouter.get("/orders", async (req, res, next) => {
  try {
    const { status, trackingNumber } = req.query;
    const orders = await prisma.order.findMany({
      where: {
        ...(status ? { status: status as OrderStatus } : {}),
        ...(trackingNumber ? { trackingNumber: trackingNumber as string } : {})
      },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { fullName: true } }, senderAddress: true, receiverAddress: true }
    });
    res.json({ success: true, data: orders });
  } catch (error) { next(error); }
});

/**
 * 3. تفعيل الشحن وتوليد رقم التتبع (Phase 4 New)
 */
const shipOrderSchema = z.object({
  trackingNumber: z.string().optional(), // إذا لم يرسله المدير، سنقوم بتوليده آلياً
  note: z.string().optional()
});

adminRouter.post("/orders/:id/ship", async (req: any, res, next) => {
  try {
    const parsed = shipOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: "VALIDATION_ERROR" });

    const orderId = req.params.id;
    // توليد رقم تتبع فريد إذا لم يتوفر (مثال: TH-TRACK-XXXXX)
    const trackingNumber = parsed.data.trackingNumber || `TRK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== "CONFIRMED") {
        throw new Error("ORDER_MUST_BE_CONFIRMED_BEFORE_SHIPPING");
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { 
          status: "SHIPPED",
          trackingNumber: trackingNumber
        }
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          status: "SHIPPED",
          actorId: req.user.id,
          note: parsed.data.note || `Order shipped with tracking: ${trackingNumber}`
        }
      });

      return updated;
    });

    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

/**
 * 4. تحديث الحالة العادية (مصفوفة الانتقال)
 */
adminRouter.patch("/orders/:id/status", async (req: any, res, next) => {
  try {
    const { status, note } = req.body;
    const orderId = req.params.id;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("ORDER_NOT_FOUND");

      const allowed: Record<string, string[]> = {
        PENDING: ["CONFIRMED", "REJECTED"],
        CONFIRMED: ["SHIPPED", "CANCELLED"],
        SHIPPED: ["ARRIVED"],
        ARRIVED: ["DELIVERED", "RETURNED"],
        DELIVERED: [], REJECTED: [], CANCELLED: []
      };

      if (!allowed[order.status]?.includes(status)) {
        throw new Error(`Invalid transition from ${order.status} to ${status}`);
      }

      const updated = await tx.order.update({ where: { id: orderId }, data: { status: status as OrderStatus } });
      await tx.orderStatusLog.create({ data: { orderId, status: status as OrderStatus, actorId: req.user.id, note } });
      return updated;
    });

    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

/**
 * 5. مراجعة الدفع (Review Payment)
 */
adminRouter.post("/orders/:id/review-payment", async (req: any, res, next) => {
    try {
      const { approve, note } = req.body;
      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: req.params.id }, include: { payments: true } });
        if (!order || !order.payments.length) throw new Error("PAYMENT_NOT_FOUND");
        
        await tx.payment.update({ where: { id: order.payments[0].id }, data: { status: approve ? "CONFIRMED" : "REJECTED" } });
        const updated = await tx.order.update({ where: { id: order.id }, data: { status: approve ? "CONFIRMED" : "REJECTED" } });
        await tx.orderStatusLog.create({ data: { orderId: order.id, status: updated.status, actorId: req.user.id, note } });
        return updated;
      });
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });