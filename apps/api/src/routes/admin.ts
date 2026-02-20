import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { sendOrderStatusEmail } from "../utils/mailer.js";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth.js";
import { OrderStatus } from "@prisma/client";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/orders", async (_req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, fullName: true, email: true } }, payments: true, senderAddress: true, receiverAddress: true },
  });
  res.json({ orders });
});

const confirmSchema = z.object({
  approve: z.boolean(),
  weightFinalKg: z.number().positive().optional(),
  priceFinal: z.number().positive().optional(),
  note: z.string().optional()
});

adminRouter.post("/orders/:id/confirm-payment", async (req: AuthRequest, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION" });

  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { payments: true } });
  if (!order) return res.status(404).json({ error: "NOT_FOUND" });
    const prevStatus = order.status;

  const payment = order.payments[0];
  if (!payment) return res.status(400).json({ error: "NO_PAYMENT" });

  if (parsed.data.approve) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "CONFIRMED" } });
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CONFIRMED,
        weightFinalKg: parsed.data.weightFinalKg ?? order.weightDeclaredKg,
        priceFinal: parsed.data.priceFinal ?? order.priceEstimated,
      },
    });
  } else {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "REJECTED" } });
    await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.REJECTED } });
  }

  res.json({ ok: true });
});

adminRouter.get("/orders/:orderId/logs", requireAuth("ADMIN"), async (req, res) => {
  const orderId = req.params.orderId;

  const logs = await prisma.orderStatusLog.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    include: {
      actor: { select: { id: true, fullName: true, email: true, role: true } },
    },
  });

  res.json({ logs });
});
