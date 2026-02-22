import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { logger } from "../logger.js";
import { nextOrderNumber } from "../utils/orderNumber.js";

export const ordersRouter = Router();

// Upload receipts
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeBase = (file.originalname || "receipt").replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safeBase}`);
  },
});
const upload = multer({ storage });
const orderNumber = await nextOrderNumber(direction as any);

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

// GET /orders
ordersRouter.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";

    const orders = await prisma.order.findMany({
      where: isAdmin ? {} : { userId },
      orderBy: { createdAt: "desc" },
      include: {
        senderAddress: true,
        receiverAddress: true,
        payments: { orderBy: { createdAt: "desc" } },
      },
    });

    res.json({ orders });
  } catch (e: any) {
    logger.error(e, "LOAD_ORDERS_FAILED");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// GET /orders/:id
ordersRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        senderAddress: true,
        receiverAddress: true,
        payments: { include: { receipts: true }, orderBy: { createdAt: "desc" } },
      },
    });

    if (!order) return res.status(404).json({ error: "ORDER_NOT_FOUND" });
    if (!isAdmin && order.userId !== userId) return res.status(403).json({ error: "FORBIDDEN" });

    res.json({ order });
  } catch (e: any) {
    logger.error(e, "LOAD_ORDER_FAILED");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// POST /orders
ordersRouter.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const direction = String(req.body?.direction || "").trim();
    const contents = String(req.body?.contents || "").trim();

    // UI fields (غير موجودة كسكيمـا) نخزنها داخل purchaseDetails
    const shippingMethod = req.body?.shippingMethod ? String(req.body.shippingMethod).toUpperCase() : undefined;
    const purchasePlatform = req.body?.purchasePlatform ? String(req.body.purchasePlatform).toUpperCase() : undefined;

    const weightDeclaredKg = toNumber(req.body?.weightDeclaredKg);
    const declaredValueUsd = toNumber(req.body?.declaredValueUsd);
    const insuranceRequested = Boolean(req.body?.insuranceRequested);
    const insuranceValueUsd = toNumber(req.body?.insuranceValueUsd);

    const sender = req.body?.senderAddress;
    const receiver = req.body?.receiverAddress;

    if (!direction) return res.status(400).json({ error: "DIRECTION_REQUIRED" });
    if (!contents) return res.status(400).json({ error: "CONTENTS_REQUIRED" });
    if (weightDeclaredKg === null || weightDeclaredKg <= 0) return res.status(400).json({ error: "WEIGHT_REQUIRED" });

    if (!sender?.fullName || !sender?.phone || !sender?.country || !sender?.city || !sender?.addressLine1) {
      return res.status(400).json({ error: "SENDER_ADDRESS_INVALID" });
    }
    if (!receiver?.fullName || !receiver?.phone || !receiver?.country || !receiver?.city || !receiver?.addressLine1) {
      return res.status(400).json({ error: "RECEIVER_ADDRESS_INVALID" });
    }

    const settings = await prisma.setting.findFirst();
    const shipJodPerKg = settings?.shipJodPerKg_JO_TO_DZ ?? 4.5;
    const shipDzdPerKg = settings?.shipDzdPerKg_DZ_TO_JO ?? 1100;

    const currency = direction === "DZ_TO_JO" ? "DZD" : "JOD";
    const unit = direction === "DZ_TO_JO" ? shipDzdPerKg : shipJodPerKg;
    const priceEstimated = Math.max(0, Math.round(weightDeclaredKg * unit * 100) / 100);

    const orderNumber = nextOrderNumber();

    const created = await prisma.order.create({
      data: {
        userId,
        orderNumber,
        direction: direction as any,
        status: "PENDING_REVIEW",
        contents,
        weightDeclaredKg,
        currency,
        priceEstimated,
        declaredValueUsd: declaredValueUsd ?? null,
        insuranceRequested,
        insuranceValueUsd: insuranceRequested ? (insuranceValueUsd ?? null) : null,
        assistedPurchase: Boolean(purchasePlatform),
        purchaseDetails: JSON.stringify({ shippingMethod, purchasePlatform }),
        senderAddress: {
          create: {
            name: String(sender.fullName),
            phone: String(sender.phone),
            country: String(sender.country),
            city: String(sender.city),
            addressLine1: String(sender.addressLine1),
            addressLine2: sender.addressLine2 ? String(sender.addressLine2) : null,
          },
        },
        receiverAddress: {
          create: {
            name: String(receiver.fullName),
            phone: String(receiver.phone),
            country: String(receiver.country),
            city: String(receiver.city),
            addressLine1: String(receiver.addressLine1),
            addressLine2: receiver.addressLine2 ? String(receiver.addressLine2) : null,
          },
        },
      },
      include: { senderAddress: true, receiverAddress: true },
    });

    logger.info({ orderId: created.id, orderNumber }, "ORDER_CREATED");
    res.status(201).json({ order: created });
  } catch (e: any) {
    logger.error({ err: e, body: req.body }, "CREATE_ORDER_FAILED");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// POST /orders/:id/receipt
ordersRouter.post("/:id/receipt", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "ORDER_NOT_FOUND" });
    if (!isAdmin && order.userId !== userId) return res.status(403).json({ error: "FORBIDDEN" });

    const amount = toNumber(req.body?.amount);
    if (amount === null || amount <= 0) return res.status(400).json({ error: "AMOUNT_INVALID" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "RECEIPT_REQUIRED" });

    const receiptUrl = `/uploads/${file.filename}`;
    const reference = typeof req.body?.reference === "string" ? req.body.reference : null;

    const payment = await prisma.payment.create({
      data: {
        orderId: id,
        method: "MANUAL",
        amount,
        status: "UNDER_REVIEW",
        receiptUrl,
        reference: reference ?? undefined,
        receipts: { create: [{ url: receiptUrl }] },
      },
      include: { receipts: true },
    });

    await prisma.order.update({
      where: { id },
      data: { status: "PAYMENT_UNDER_REVIEW" },
    });

    logger.info({ orderId: id, paymentId: payment.id }, "RECEIPT_UPLOADED");
    res.status(201).json({ payment });
  } catch (e: any) {
    logger.error(e, "UPLOAD_RECEIPT_FAILED");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});
const senderAddress = await prisma.address.create({
  data: {
    userId,
    country: sender.country,
    city: sender.city,
    line1: sender.line1,
    line2: sender.line2 ?? null,
    phone: sender.phone ?? null,
    label: "SENDER",
  },
});

const receiverAddress = await prisma.address.create({
  data: {
    userId,
    country: receiver.country,
    city: receiver.city,
    line1: receiver.line1,
    line2: receiver.line2 ?? null,
    phone: receiver.phone ?? null,
    label: "RECEIVER",
  },
});