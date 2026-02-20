import "dotenv/config";
import { PrismaClient, UserRole, OrderDirection } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Admin user
  const adminEmail = "admin@thouesa.test";
  const adminPass = "Admin12345!";
  const hash = await bcrypt.hash(adminPass, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      fullName: "Platform Admin",
      email: adminEmail,
      passwordHash: hash,
      role: UserRole.ADMIN,
    },
  });

  // Pricing rules (simple ranges - edit as needed)
  const rules = [
    { direction: OrderDirection.JO_TO_DZ, fromKg: 0, toKg: 1, price: 10, currency: "JOD" },
    { direction: OrderDirection.JO_TO_DZ, fromKg: 1, toKg: 3, price: 25, currency: "JOD" },
    { direction: OrderDirection.JO_TO_DZ, fromKg: 3, toKg: 5, price: 40, currency: "JOD" },
    { direction: OrderDirection.DZ_TO_JO, fromKg: 0, toKg: 1, price: 1800, currency: "DZD" },
    { direction: OrderDirection.DZ_TO_JO, fromKg: 1, toKg: 3, price: 4500, currency: "DZD" },
    { direction: OrderDirection.DZ_TO_JO, fromKg: 3, toKg: 5, price: 7500, currency: "DZD" },
  ];

  for (const r of rules) {
    await prisma.pricingRule.create({ data: r });
  }

  console.log("Seed done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
