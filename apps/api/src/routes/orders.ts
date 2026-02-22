import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { PricingService } from "../services/pricing.service.ts";
import { z } from "zod";

export const ordersRouter = Router();

const createOrderSchema = z.object({
  direction: z.enum(["JO_TO_DZ", "DZ_TO_JO"]),
  weightDeclaredKg: z.number().positive(),
  contents: z.string().min(3),
  senderAddressId: z.string(),
  receiverAddressId: z.string(),
});

ordersRouter.post("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const { direction, weightDeclaredKg, contents, senderAddressId, receiverAddressId } = parsed.data;

    // استخدام محرك التسعير (Phase 2)
    const pricing = await PricingService.calculatePrice(weightDeclaredKg, direction);

    // تنفيذ العملية في Transaction لضمان سلامة البيانات (Strict Directive 10)
    const order = await prisma.$transaction(async (tx) => {
      // 1. توليد رقم تسلسلي للطلب
      const seq = await tx.orderSequence.upsert({
        where: { id: "order_seq" },
        update: { lastVal: { increment: 1 } },
        create: { id: "order_seq", lastVal: 1000 },
      });

      const orderNumber = `TH-${seq.lastVal}`;

      // 2. إنشاء الطلب
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: req.user!.id,
          direction,
          status: "PENDING",
          weightDeclaredKg,
          priceEstimated: pricing.totalPrice,
          contents,
          senderAddressId,
          receiverAddressId,
        },
      });

      // 3. تسجيل أول حركة في السجل (Strict Directive 9)
      await tx.orderStatusLog.create({
        data: {
          orderId: newOrder.id,
          status: "PENDING",
          actorId: req.user!.id,
          note: "Order created via Customer Portal",
        },
      });

      return newOrder;
    });

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});