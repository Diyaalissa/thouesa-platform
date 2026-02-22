import type { PrismaClient, OrderDirection } from "@prisma/client";

function yyyymmdd(d = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function nextOrderNumber(prisma: PrismaClient, direction: OrderDirection): Promise<string> {
  const date = yyyymmdd();
  const prefix = `TH-${date}-${direction}-`;

  const seq = await prisma.$transaction(async (tx) => {
    const row = await tx.orderSequence.upsert({
      where: { date_direction: { date, direction } },
      create: { date, direction, lastSequence: 1 },
      update: { lastSequence: { increment: 1 } },
      select: { lastSequence: true },
    });
    return row.lastSequence;
  });

  return `${prefix}${String(seq).padStart(4, "0")}`;
}