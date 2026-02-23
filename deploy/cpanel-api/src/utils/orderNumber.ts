import type { OrderDirection } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function nextOrderNumber(direction: OrderDirection): Promise<string> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

  const seq = await prisma.orderSequence.upsert({
    where: { date_direction: { date, direction } },
    update: { lastSequence: { increment: 1 } },
    create: { date, direction, lastSequence: 1 },
    select: { lastSequence: true },
  });

  const prefix = direction === "JO_TO_DZ" ? "TH-JO" : "TH-DZ";
  return `${prefix}-${date}-${String(seq.lastSequence).padStart(4, "0")}`;
}