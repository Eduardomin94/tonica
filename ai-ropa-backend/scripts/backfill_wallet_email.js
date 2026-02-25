import { prisma } from "../prismaClient.js";

async function main() {
  // Setea Wallet.email = User.email para todos los que estén NULL
  const updated = await prisma.$executeRawUnsafe(`
    UPDATE "Wallet" w
    SET "email" = u."email"
    FROM "User" u
    WHERE w."userId" = u."id"
      AND (w."email" IS NULL OR w."email" = '')
  `);

  console.log("✅ Backfill Wallet.email OK:", updated);
}

main()
  .catch((e) => {
    console.error("❌ Backfill error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });