import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js"; // إضافة .js للالتزام بنظام ESM
import { logger } from "../logger.js"; // استخدام نظام التسجيل الجديد

const prisma = new PrismaClient();
export const ordersRouter = Router();

// تعريف أنواع الشحن المتوافقة مع قاعدة البيانات
const VALID_SHIPPING_METHODS = ["AIR", "SEA", "EXPRESS"] as const;

/**
 * إعداد التخزين للإيصالات المرفوعة
 */
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
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

/**
 * توليد رقم الطلب التالي (تلقائي)
 */
async function nextOrderNumber(): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `TH-${ymd}-`;

  const last = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true },
  });

  let next = 1;
  if (last?.orderNumber) {
    const parts = last.orderNumber.split("-");
    const tail = parts[parts.length - 1] || "0";
    const prev = parseInt(tail, 10);
    if (Number.isFinite(prev)) next = prev + 1;
  }

  return `${prefix}${String(next).padStart(4, "0")}`;
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
      },
    });

    res.json(orders);
  } catch (e: any) {
    logger.error(e, "فشل جلب الطلبات");
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
      },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!isAdmin && order.userId !== userId) return res.status(403).json({ error: "Forbidden" });

    res.json(order);
  } catch (e: any) {
    logger.error(e, `فشل جلب الطلب رقم: ${req.params.id}`);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * POST /orders
 * إنشاء طلب جديد
 */
ordersRouter.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const direction = String(req.body?.direction || "").trim();
    const shippingMethod = String(req.body?.shippingMethod || "").toUpperCase();
    const purchasePlatform = String(req.body?.purchasePlatform || "").toUpperCase();

    const weightKg = toFloat(req.body?.weightKg);
    const declaredValue = toFloat(req.body?.declaredValue);
    const insuranceRequested = Boolean(req.body?.insuranceRequested);
    const insuranceValue = toFloat(req.body?.insuranceValue);
    const notes = typeof req.body?.notes === "string" ? req.body.notes : null;

    // التحقق من الحقول الإجبارية
    if (!direction || !shippingMethod || !purchasePlatform) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (weightKg === null || weightKg <= 0) {
      return res.status(400).json({ error: "weightKg must be a positive number" });
    }

    // التحقق من صحة الاتجاه وطريقة الشحن
    const allowedDirections = ["JO_TO_DZ", "DZ_TO_JO"];
    if (!allowedDirections.includes(direction)) {
      return res.status(400).json({ error: "Invalid direction" });
    }

    if (!VALID_SHIPPING_METHODS.includes(shippingMethod as any)) {
      return res.status(400).json({ error: "Invalid shippingMethod" });
    }

    const orderNumber = await nextOrderNumber();

    const order = await prisma.order.create({
      data: {
        userId,
        orderNumber,
        status: "NEW",
        direction: direction as any,
        shippingMethod: shippingMethod as any,
        purchasePlatform,
        weightKg,
        declaredValue,
        insuranceRequested,
        insuranceValue: insuranceValue ?? null,
        notes,
      },
    });

    logger.info({ orderId: order.id, orderNumber }, "تم إنشاء طلب جديد بنجاح");
    res.status(201).json(order);
  } catch (e: any) {
    logger.error(e, "فشل إنشاء الطلب");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * POST /orders/:id/receipt
 * رفع إيصال الدفع
 */
ordersRouter.post("/:id/receipt", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!isAdmin && order.userId !== userId) return res.status(403).json({ error: "Forbidden" });

    const amount = toFloat(req.body?.amount);
    if (amount === null || amount <= 0) return res.status(400).json({ error: "amount must be a positive number" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "Missing receipt file" });

    const publicUrl = `/uploads/${file.filename}`;
    const reference = typeof req.body?.reference === "string" ? req.body.reference : null;

    const payment = await prisma.payment.create({
      data: {
        orderId: id,
        method: "MANUAL",
        amount,
        status: "UNDER_REVIEW",
        receiptUrl: publicUrl,
        reference: reference ?? undefined,
        receipts: {
          create: [{ url: publicUrl }],
        },
      },
      include: { receipts: true },
    });

    logger.info({ orderId: id, paymentId: payment.id }, "تم رفع إيصال دفع جديد");
    res.status(201).json(payment);
  } catch (e: any) {
    logger.error(e, "فشل رفع إيصال الدفع");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});