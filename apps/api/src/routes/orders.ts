import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { nextOrderNumber } from "../utils/orderNumber.js";
import { logger } from "../logger.js";
import { OrderStatus, type OrderDirection } from "@prisma/client";

export const ordersRouter = Router();

/* uploads */
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = (file.originalname || "receipt").replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

async function getSettingSingleton() {
  return prisma.setting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

/* validation */
const addressSchema = z.object({
  country: z.string().min(2),
  city: z.string().min(2),
  line1: z.string().min(2),
  line2: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
});

const createOrderSchema = z.object({
  direction: z.enum(["JO_TO_DZ", "DZ_TO_JO"]),
  senderAddress: addressSchema,
  receiverAddress: addressSchema,
  weightDeclaredKg: z.number().positive(),
  contents: z.string().min(2),
  declaredValue: z.number().optional().nullable(),
  assistedPurchase: z.boolean().optional().default(false),
  purchaseDetails: z.string().optional().nullable(),
  insuranceRequested: z.boolean().optional().default(false),
  insuranceValue: z.number().optional().nullable(),
});

ordersRouter.get("/", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user!.role === "ADMIN";
    const userId = req.user!.id;

    const orders = await prisma.order.findMany({
      where: isAdmin ? {} : { userId },
      orderBy: { createdAt: "desc" },
      include: {
        senderAddress: true,
        receiverAddress: true,
        payments: { orderBy: { createdAt: "desc" }, include: { receipts: true } },
        statusLogs: { orderBy: { createdAt: "desc" }, include: { actor: { select: { id: true, fullName: true, email: true } } } },
      },
    });

    res.json({ orders });
  } catch (e: any) {
    logger.error(e, "LOAD_ORDERS_FAILED");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

ordersRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const isAdmin = req.user!.role === "ADMIN";
    const userId = req.user!.id;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        senderAddress: true,
        receiverAddress: true,
        payments: { orderBy: { createdAt: "desc" }, include: { receipts: true } },
        statusLogs: { orderBy: { createdAt: "desc" }, include: { actor: { select: { id: true, fullName: true, email: true } } } },
      },
    });

    if (!order) return res.status(404).json({ error: "NOT_FOUND" });
    if (!isAdmin && order.userId !== userId) return res.status(403).json({ error: "FORBIDDEN" });

    res.json({ order });
  } catch (e: any) {
    logger.error(e, "LOAD_ORDER_FAILED");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

ordersRouter.post("/", requireAuth, async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

  try {
    const userId = req.user!.id;
    const data = parsed.data;
    const direction = data.direction as OrderDirection;

    const setting = await getSettingSingleton();

    const rate = direction === "JO_TO_DZ" ? setting.shipJodPerKg_JO_TO_DZ : setting.shipDzdPerKg_DZ_TO_JO;
    const currency = direction === "JO_TO_DZ" ? "JOD" : "DZD";
    const priceEstimated = Number((rate * data.weightDeclaredKg).toFixed(3));

    const orderNumber = await nextOrderNumber(prisma, direction);

    const order = await prisma.$transaction(async (tx) => {
      const sender = await tx.address.create({
        data: {
          userId,
          country: data.senderAddress.country,
          city: data.senderAddress.city,
          line1: data.senderAddress.line1,
          line2: data.senderAddress.line2 ?? null,
          phone: data.senderAddress.phone ?? null,
          label: data.senderAddress.label ?? null,
        },
      });

      const receiver = await tx.address.create({
        data: {
          userId,
          country: data.receiverAddress.country,
          city: data.receiverAddress.city,
          line1: data.receiverAddress.line1,
          line2: data.receiverAddress.line2 ?? null,
          phone: data.receiverAddress.phone ?? null,
          label: data.receiverAddress.label ?? null,
        },
      });

      const created = await tx.order.create({
        data: {
          userId,
          orderNumber,
          direction,
          status: OrderStatus.PENDING_REVIEW,
          senderAddressId: sender.id,
          receiverAddressId: receiver.id,
          weightDeclaredKg: data.weightDeclaredKg,
          contents: data.contents,
          declaredValue: data.declaredValue ?? null,
          assistedPurchase: data.assistedPurchase ?? false,
          purchaseDetails: data.purchaseDetails ?? null,
          insuranceRequested: data.insuranceRequested ?? false,
          insuranceValue: data.insuranceValue ?? null,
          priceEstimated,
          currency,
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: created.id,
          fromStatus: null,
          toStatus: OrderStatus.PENDING_REVIEW,
          actorUserId: userId,
          note: "ORDER_CREATED",
        },
      });

      return created;
    });

    res.status(201).json({ order });
  } catch (e: any) {
    logger.error(e, "CREATE_ORDER_FAILED");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

ordersRouter.post("/:id/receipt", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const isAdmin = req.user!.role === "ADMIN";
    const userId = req.user!.id;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "NOT_FOUND" });
    if (!isAdmin && order.userId !== userId) return res.status(403).json({ error: "FORBIDDEN" });

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "INVALID_AMOUNT" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "MISSING_FILE" });

    const publicUrl = `/uploads/${file.filename}`;
    const reference = typeof req.body?.reference === "string" ? req.body.reference : null;

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          orderId: id,
          method: "MANUAL",
          amount,
          status: "UNDER_REVIEW",
          receiptUrl: publicUrl,
          reference: reference ?? null,
          receipts: { create: [{ url: publicUrl }] },
        },
        include: { receipts: true },
      });

      const prev = order.status;

      await tx.order.update({
        where: { id },
        data: { status: OrderStatus.PAYMENT_UNDER_REVIEW },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: id,
          fromStatus: prev,
          toStatus: OrderStatus.PAYMENT_UNDER_REVIEW,
          actorUserId: userId,
          note: "RECEIPT_UPLOADED",
        },
      });

      return created;
    });

    res.status(201).json({ payment });
  } catch (e: any) {
    logger.error(e, "UPLOAD_RECEIPT_FAILED");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});