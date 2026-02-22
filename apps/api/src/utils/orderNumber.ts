import { prisma } from "../lib/prisma.js";
import type { OrderDirection } from "@prisma/client";

export async function nextOrderNumber(direction: OrderDirection) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const seq = await prisma.orderSequence.upsert({
    where: {
      date_direction: {
        date: today,
        direction,
      },
    },
    update: {
      lastSequence: { increment: 1 },
    },
    create: {
      date: today,
      direction,
      lastSequence: 1,
    },
  });

  const padded = seq.lastSequence.toString().padStart(4, "0");

  return `TH-${today}-${padded}`;
}