import express from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { makeTransporter } from "../mailer.js";

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* ================================
   LOGIN GOOGLE
================================ */

router.post("/google", async (req, res) => {
  let ticket;
  try {
  const idToken = req.body?.idToken;
  if (!idToken) {
    console.log("NO ID TOKEN RECIBIDO");
    return res.status(400).json({ error: "Missing idToken" });
  }

  // 🔍 VER PAYLOAD SIN VERIFICAR FIRMA (solo debug)
  const payloadPart = idToken.split(".")[1];
  const raw = Buffer.from(payloadPart, "base64").toString("utf8");
  console.log("GOOGLE TOKEN PAYLOAD RAW:", raw);

  ticket = await googleClient.verifyIdToken({
  idToken,
  audience: process.env.GOOGLE_CLIENT_ID,
});

const payload = ticket.getPayload();

  console.log("GOOGLE VERIFIED:", {
    aud: payload?.aud,
    email: payload?.email,
  });

    const { email, name, picture } = payload;
    if (!email) {
      return res.status(400).json({ error: "Google token missing email" });
    }
let isNewUser = false;
let newUserEmailForMail = null;
let newUserNameForMail = null;
   const user = await prisma.$transaction(async (tx) => {
  const existing = await tx.user.findUnique({
    where: { email },
    select: { id: true },
  });

  // ✅ Usuario NUEVO → 3 créditos gratis + historial
 if (!existing) {
const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 horas
  const created = await tx.user.create({
    data: {
      email,
      name: name ?? null,
      image: picture ?? null,
      wallet: {
        create: {
          balance: 0, // 👈 el bonus NO va en balance (se calcula aparte)
          email: email,
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
isNewUser = true;
newUserEmailForMail = email;
newUserNameForMail = name ?? null;
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

  if (updated.wallet) {
  await tx.wallet.update({
    where: { id: updated.wallet.id },
    data: { email: email },
  });
}

  // Si por alguna razón no tenía wallet, la creamos (sin bono)
  if (!updated.wallet) {
    await tx.wallet.create({
      data: { userId: updated.id, balance: 0, email: email },
    });

    return tx.user.findUnique({
      where: { id: updated.id },
      include: { wallet: true },
    });
  }

  return updated;
});

if (isNewUser) {
  const totalUsers = await prisma.user.count();

  const resend = makeTransporter();

  resend.emails
    .send({
      from: process.env.FROM_EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject: `🆕 Nuevo usuario: ${newUserEmailForMail} (Total: ${totalUsers})`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.4">
          <h2 style="margin:0 0 10px">Nuevo usuario registrado</h2>
          <p style="margin:0 0 6px"><b>Email:</b> ${newUserEmailForMail || "-"}</p>
          <p style="margin:0 0 6px"><b>Nombre:</b> ${newUserNameForMail || "-"}</p>
          <p style="margin:0 0 12px"><b>Total de usuarios:</b> ${totalUsers}</p>
        </div>
      `,
    })
    .catch((e) => {
      console.error("NEW USER EMAIL ERROR:", e);
    });
}
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
