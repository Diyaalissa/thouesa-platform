import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const publicRouter = Router();

publicRouter.get("/track/:orderNumber", async (req, res) => {
  const orderNumber = req.params.orderNumber;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { orderNumber: true, status: true, direction: true, createdAt: true, updatedAt: true },
  });
  if (!order) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ order });
});
