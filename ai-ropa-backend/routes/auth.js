import express from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body ?? {};

    if (!idToken) {
      return res.status(400).json({ error: "Missing idToken" });
    }

    // Verificar ID token con Google
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

    // Upsert user + asegurar wallet
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.upsert({
        where: { email },
        update: {
          name: name ?? null,
          image: picture ?? null,
        },
        create: {
          email,
          name: name ?? null,
          image: picture ?? null,
          wallet: { create: { balance: 0 } },
        },
        include: { wallet: true },
      });

      if (!u.wallet) {
        await tx.wallet.create({
          data: { userId: u.id, balance: 0 },
        });

        return tx.user.findUnique({
          where: { id: u.id },
          include: { wallet: true },
        });
      }

      return u;
    });

    const accessToken = jwt.sign(
      { sub: user.id },
      process.env.AUTH_JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      wallet: {
        balance: user.wallet?.balance ?? 0,
      },
    });
  } catch (error) {
    console.error("AUTH /google error:", error);
    return res.status(401).json({ error: error?.message || "Invalid Google token" });
  }
});

export default router;
