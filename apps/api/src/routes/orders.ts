import { generateSequentialOrderNumber } from "../utils/orderNumber";
import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { OrderDirection, OrderStatus, PaymentMethod } from "@prisma/client";

export const ordersRouter = Router();

const uploadDir = process.env.UPLOAD_DIR || "uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

const createOrderSchema = z.object({
  direction: z.enum(["JO_TO_DZ", "DZ_TO_JO"]),
  sender: z.object({
    country: z.string().min(2),
    city: z.string().min(2),
    line1: z.string().min(3),
    line2: z.string().optional(),
    phone: z.string().optional(),
    label: z.string().optional(),
  }),
  receiver: z.object({
    country: z.string().min(2),
    city: z.string().min(2),
    line1: z.string().min(3),
    line2: z.string().optional(),
    phone: z.string().optional(),
    label: z.string().optional(),
  }),
  weightDeclaredKg: z.number().positive(),
  contents: z.string().min(3),
  declaredValue: z.number().optional(),
  assistedPurchase: z.boolean().default(false),
  purchaseDetails: z.string().optional(),
  insuranceRequested: z.boolean().default(false),
  insuranceValue: z.number().optional(),
  priceEstimated: z.number().positive(),
  currency: z.string().min(2),
});

ordersRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

  const d = parsed.data;

  const [sender, receiver] = await Promise.all([
    prisma.address.create({ data: { userId: req.user!.id, ...d.sender } }),
    prisma.address.create({ data: { userId: req.user!.id, ...d.receiver } }),
  ]);

  const order = const orderNumber = generateSequentialOrderNumber();

await prisma.order.create({
  data: {
    orderNumber,
    data: {
      userId: req.user!.id,
      direction: d.direction as OrderDirection,
      status: OrderStatus.AWAITING_PAYMENT,
      senderAddressId: sender.id,
      receiverAddressId: receiver.id,
      weightDeclaredKg: d.weightDeclaredKg,
      contents: d.contents,
      declaredValue: d.declaredValue,
      assistedPurchase: d.assistedPurchase,
      purchaseDetails: d.purchaseDetails,
      insuranceRequested: d.insuranceRequested,
      insuranceValue: d.insuranceValue,
      priceEstimated: d.priceEstimated,
      currency: d.currency,
      payments: {
        create: {
          method: PaymentMethod.MANUAL,
          amount: d.priceEstimated,
          status: "PENDING",
        },
      },
    },
    include: { payments: true },
  });

  res.json({ order });
});

ordersRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    include: { payments: true },
  });
  res.json({ orders });
});

ordersRouter.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { senderAddress: true, receiverAddress: true, payments: true },
  });
  if (!order) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ order });
});

// Upload receipt for the latest payment
ordersRouter.post("/:id/receipt", requireAuth, upload.single("receipt"), async (req: AuthRequest, res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: { payments: true } });
  if (!order) return res.status(404).json({ error: "NOT_FOUND" });

  const payment = order.payments[0];
  if (!payment) return res.status(400).json({ error: "NO_PAYMENT" });
  if (!req.file) return res.status(400).json({ error: "NO_FILE" });

  const receiptUrl = `/uploads/${path.basename(req.file.path)}`;

  await prisma.paymentReceipt.create({ data: { paymentId: payment.id, url: receiptUrl } });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { receiptUrl, status: "UNDER_REVIEW" },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.PAYMENT_UNDER_REVIEW },
  });

  res.json({ ok: true, receiptUrl });
});
