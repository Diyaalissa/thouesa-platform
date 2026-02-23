import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { logger } from "../logger.js";
import { nextOrderNumber } from "../utils/orderNumber.js";
import type { OrderDirection } from "@prisma/client";

export const ordersRouter = Router();

/* uploads */
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

function toFloat(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

async function getSettings() {
  return prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

async function estimatePrice(direction: OrderDirection, weightKg: number) {
  const s = await getSettings();
  if (direction === "JO_TO_DZ") {
    const price = weightKg * s.shipJodPerKg_JO_TO_DZ;
    return { price, currency: "JOD" };
  } else {
    const price = weightKg * s.shipDzdPerKg_DZ_TO_JO;
    return { price, currency: "DZD" };
  }
}

/**
 * GET /orders
 */
ordersRouter.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";

    const orders = await prisma.order.findMany({
      where: isAdmin ? {} : { userId },
      orderBy: { createdAt: "desc" },
      include: {
        payments: { orderBy: { createdAt: "desc" } },
        senderAddress: true,
        receiverAddress: true,
      },
    });

    res.json({ orders });
  } catch (e: any) {
    logger.error(e, "LOAD_ORDERS_FAILED");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * GET /orders/:id
 */
ordersRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        payments: { include: { receipts: true }, orderBy: { createdAt: "desc" } },
        senderAddress: true,
        receiverAddress: true,
        statusLogs: { orderBy: { createdAt: "desc" } },
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

/**
 * POST /orders
 * body:
 * {
 *   direction, weightDeclaredKg, contents, declaredValue?,
 *   assistedPurchase?, purchaseDetails?,
 *   insuranceRequested?, insuranceValue?,
 *   senderAddress: {country, city, line1, line2?, phone?, label?},
 *   receiverAddress: {country, city, line1, line2?, phone?, label?}
 * }
 */
ordersRouter.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const direction = String(req.body?.direction || "").trim() as OrderDirection;
    const weightDeclaredKg = toFloat(req.body?.weightDeclaredKg);
    const contents = String(req.body?.contents || "").trim();

    const declaredValue = toFloat(req.body?.declaredValue);
    const assistedPurchase = Boolean(req.body?.assistedPurchase);
    const purchaseDetails = typeof req.body?.purchaseDetails === "string" ? req.body.purchaseDetails : null;
    const insuranceRequested = Boolean(req.body?.insuranceRequested);
    const insuranceValue = toFloat(req.body?.insuranceValue);

    const sender = req.body?.senderAddress;
    const receiver = req.body?.receiverAddress;

    if (direction !== "JO_TO_DZ" && direction !== "DZ_TO_JO") {
      return res.status(400).json({ error: "INVALID_DIRECTION" });
    }
    if (!weightDeclaredKg || weightDeclaredKg <= 0) {
      return res.status(400).json({ error: "INVALID_WEIGHT" });
    }
    if (!contents) {
      return res.status(400).json({ error: "CONTENTS_REQUIRED" });
    }
    if (!sender?.country || !sender?.city || !sender?.line1) {
      return res.status(400).json({ error: "SENDER_ADDRESS_REQUIRED" });
    }
    if (!receiver?.country || !receiver?.city || !receiver?.line1) {
      return res.status(400).json({ error: "RECEIVER_ADDRESS_REQUIRED" });
    }

    const orderNumber = await nextOrderNumber(direction);
    const est = await estimatePrice(direction, weightDeclaredKg);

    const order = await prisma.$transaction(async (tx) => {
      const senderAddress = await tx.address.create({
        data: {
          userId,
          country: String(sender.country),
          city: String(sender.city),
          line1: String(sender.line1),
          line2: sender.line2 ? String(sender.line2) : null,
          phone: sender.phone ? String(sender.phone) : null,
          label: sender.label ? String(sender.label) : null,
        },
      });

      const receiverAddress = await tx.address.create({
        data: {
          userId,
          country: String(receiver.country),
          city: String(receiver.city),
          line1: String(receiver.line1),
          line2: receiver.line2 ? String(receiver.line2) : null,
          phone: receiver.phone ? String(receiver.phone) : null,
          label: receiver.label ? String(receiver.label) : null,
        },
      });

      const created = await tx.order.create({
        data: {
          userId,
          orderNumber,
          direction,
          status: "PENDING_REVIEW",
          senderAddressId: senderAddress.id,
          receiverAddressId: receiverAddress.id,
          weightDeclaredKg,
          contents,
          declaredValue: declaredValue ?? null,
          assistedPurchase,
          purchaseDetails,
          insuranceRequested,
          insuranceValue: insuranceValue ?? null,
          priceEstimated: est.price,
          currency: est.currency,
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: created.id,
          fromStatus: null,
          toStatus: "PENDING_REVIEW",
          actorUserId: userId,
          note: "Order created",
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

/**
 * POST /orders/:id/receipt
 * multipart: file + amount + reference?
 */
ordersRouter.post("/:id/receipt", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "NOT_FOUND" });
    if (!isAdmin && order.userId !== userId) return res.status(403).json({ error: "FORBIDDEN" });

    const amount = toFloat(req.body?.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: "INVALID_AMOUNT" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "MISSING_FILE" });

    const publicUrl = `/uploads/${file.filename}`;
    const reference = typeof req.body?.reference === "string" ? req.body.reference : null;

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
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

      await tx.order.update({
        where: { id },
        data: { status: "PAYMENT_UNDER_REVIEW" },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: "PAYMENT_UNDER_REVIEW",
          actorUserId: userId,
          note: "Receipt uploaded",
        },
      });

      return p;
    });

    res.status(201).json({ payment });
  } catch (e: any) {
    logger.error(e, "UPLOAD_RECEIPT_FAILED");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});