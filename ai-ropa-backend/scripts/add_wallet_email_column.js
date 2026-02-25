import { prisma } from "../prismaClient.js";

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Wallet"
    ADD COLUMN IF NOT EXISTS "email" TEXT
  `);

  console.log("✅ Columna Wallet.email creada (si no existía).");
}

main()
  .catch((e) => {
    console.error("❌ Error creando columna Wallet.email:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });