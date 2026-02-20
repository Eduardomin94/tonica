import express from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";


const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* ================================
   LOGIN GOOGLE
================================ */

router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body ?? {};
    if (!idToken) {
      return res.status(400).json({ error: "Missing idToken" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: "Invalid Google token payload" });
    }

    const { email, name, picture } = payload;
    if (!email) {
      return res.status(400).json({ error: "Google token missing email" });
    }

   const user = await prisma.$transaction(async (tx) => {
  const existing = await tx.user.findUnique({
    where: { email },
    select: { id: true },
  });

  // ✅ Usuario NUEVO → 3 créditos gratis + historial
 if (!existing) {
 const expiresAt = new Date(Date.now() + 10 * 1000); // 10 segundos (modo test)

  const created = await tx.user.create({
    data: {
      email,
      name: name ?? null,
      image: picture ?? null,
      wallet: {
        create: {
          balance: 0, // 👈 el bonus NO va en balance (se calcula aparte)
          entries: {
            create: {
              type: "GRANT",
              amount: 3,
              idempotencyKey: `welcome-${email}`,
              refType: "WELCOME_BONUS",
              metadata: { expiresAt: expiresAt.toISOString() }, // 👈 vencimiento
            },
          },
        },
      },
    },
    include: { wallet: { include: { entries: true } } },
  });

  return created;
}

  // ✅ Usuario EXISTENTE → solo actualizar datos
  const updated = await tx.user.update({
    where: { email },
    data: {
      name: name ?? null,
      image: picture ?? null,
    },
    include: { wallet: true },
  });

  // Si por alguna razón no tenía wallet, la creamos (sin bono)
  if (!updated.wallet) {
    await tx.wallet.create({
      data: { userId: updated.id, balance: 0 },
    });

    return tx.user.findUnique({
      where: { id: updated.id },
      include: { wallet: true },
    });
  }

  return updated;
});
    const accessToken = jwt.sign(
      { sub: user.id },
      process.env.AUTH_JWT_SECRET,
      { expiresIn: "7d" }
    );

    const now = Date.now();

const welcomeGrant = user.wallet?.entries?.find(
  (e) => e.type === "GRANT" && e.refType === "WELCOME_BONUS"
);

const welcomeExpiresAt = welcomeGrant?.metadata?.expiresAt
  ? new Date(welcomeGrant.metadata.expiresAt).getTime()
  : null;

const welcomeBonusActive =
  welcomeExpiresAt && welcomeExpiresAt > now ? 3 : 0;

    return res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      wallet: {
  balance: (user.wallet?.balance ?? 0) + welcomeBonusActive, // total disponible
  paidBalance: user.wallet?.balance ?? 0,
  welcomeBonus: welcomeBonusActive, // 3 o 0
  welcomeExpiresAt: welcomeExpiresAt ? new Date(welcomeExpiresAt).toISOString() : null,
},
    });
  } catch (error) {
    console.error("AUTH /google error:", error);
    return res.status(401).json({
      error: error?.message || "Invalid Google token",
    });
  }
});

/* ================================
   ME (usuario actual)
================================ */

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        wallet: {
          include: {
            entries: {
              orderBy: { createdAt: "desc" },
              take: 20,
            },
          },
        },
        generations: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = Date.now();

const entries = user.wallet?.entries || [];
const bonusEntries = entries.filter(
  (e) => typeof e.refType === "string" && e.refType.startsWith("WELCOME_BONUS")
);

const grant = bonusEntries.find((e) => e.refType === "WELCOME_BONUS");
const expiresAtIso = grant?.metadata?.expiresAt;
const expiresAtMs = expiresAtIso ? new Date(expiresAtIso).getTime() : null;

const bonusActive = expiresAtMs && now < expiresAtMs;

const welcomeBonus = bonusActive
  ? Math.max(0, bonusEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0))
  : 0;

const paidBalance = user.wallet?.balance ?? 0;
const totalBalance = paidBalance + welcomeBonus;

return res.json({
  ...user,
  wallet: user.wallet
    ? {
        ...user.wallet,
        paidBalance,
        welcomeBonus,
        welcomeExpiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
        balance: totalBalance, // 👈 este es el que usa tu frontend
      }
    : null,
});
  } catch (err) {
    console.error("AUTH /me error:", err);
    return res.status(500).json({ error: "Error fetching user" });
  }
});

export default router;
