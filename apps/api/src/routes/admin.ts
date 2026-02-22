import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { z } from "zod";
import { OrderStatus } from "@prisma/client";
import { logger } from "../logger.js";

export const adminRouter = Router();

// تطبيق الحماية الشاملة: لا يدخل هنا إلا مسجل دخول وصلاحيته Admin
adminRouter.use(requireAuth, requireAdmin);

/**
 * 1. إحصائيات لوحة التحكم (Dashboard Summary)
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

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        totalRevenue: revenue._sum.priceEstimated || 0,
        currency: "Mixed (JOD/DZD)"
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 2. جلب قائمة الطلبات مع فلاتر الحالة
 */
adminRouter.get("/orders", async (req, res, next) => {
  try {
    const { status, limit = "20", offset = "0" } = req.query;

    const orders = await prisma.order.findMany({
      where: status ? { status: status as OrderStatus } : {},
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { fullName: true, email: true, phoneNumber: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        senderAddress: true,
        receiverAddress: true
      }
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

/**
 * 3. تحديث حالة الطلب مع فرض مصفوفة الانتقال (Status Transition Matrix)
 */
const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  note: z.string().optional()
});

adminRouter.patch("/orders/:id/status", async (req: any, res, next) => {
  try {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: "VALIDATION_ERROR" });

    const orderId = req.params.id;
    const newStatus = parsed.data.status;
    const note = parsed.data.note || `تم تحديث الحالة إلى ${newStatus}`;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("ORDER_NOT_FOUND");

      // مصفوفة الحالات اللوجستية المنطقية
      const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
        PENDING: ["CONFIRMED", "REJECTED"],
        CONFIRMED: ["SHIPPED", "CANCELLED"],
        SHIPPED: ["ARRIVED"],
        ARRIVED: ["DELIVERED", "RETURNED"],
        DELIVERED: [],
        REJECTED: ["PENDING"],
        CANCELLED: [],
        RETURNED: ["SHIPPED"]
      };

      if (!allowedTransitions[order.status].includes(newStatus)) {
        const error: any = new Error(`لا يمكن الانتقال من ${order.status} إلى ${newStatus}`);
        error.status = 400;
        throw error;
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus }
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          status: newStatus,
          actorId: req.user.id,
          note
        }
      });

      return updatedOrder;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * 4. مراجعة وتأكيد الدفع (Review Payment)
 */
const paymentReviewSchema = z.object({
  approve: z.boolean(),
  weightFinalKg: z.number().positive().optional(),
  priceFinal: z.number().positive().optional(),
  note: z.string().optional()
});

adminRouter.post("/orders/:id/review-payment", async (req: any, res, next) => {
  try {
    const parsed = paymentReviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: "VALIDATION_ERROR" });

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ 
        where: { id: req.params.id },
        include: { payments: true } 
      });

      if (!order || order.payments.length === 0) throw new Error("ORDER_OR_PAYMENT_NOT_FOUND");
      
      const payment = order.payments[0];

      if (parsed.data.approve) {
        await tx.payment.update({ 
          where: { id: payment.id }, 
          data: { status: "CONFIRMED" } 
        });

        const updated = await tx.order.update({
          where: { id: order.id },
          data: { 
            status: "CONFIRMED",
            weightFinalKg: parsed.data.weightFinalKg ?? order.weightDeclaredKg,
            priceFinal: parsed.data.priceFinal ?? order.priceEstimated
          }
        });

        await tx.orderStatusLog.create({
          data: {
            orderId: order.id,
            status: "CONFIRMED",
            actorId: req.user.id,
            note: parsed.data.note || "تم تأكيد الدفع واعتماد الطلب"
          }
        });

        return updated;
      } else {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "REJECTED" } });
        const rejected = await tx.order.update({ where: { id: order.id }, data: { status: "REJECTED" } });
        
        await tx.orderStatusLog.create({
          data: { orderId: order.id, status: "REJECTED", actorId: req.user.id, note: parsed.data.note || "تم رفض الدفع" }
        });

        return rejected;
      }
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * 5. جلب سجل الحركات للطلب
 */
adminRouter.get("/orders/:id/logs", async (req, res, next) => {
  try {
    const logs = await prisma.orderStatusLog.findMany({
      where: { orderId: req.params.id },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { fullName: true, role: true } } }
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});