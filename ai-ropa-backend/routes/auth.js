import express from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";


const router = express.Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: "Missing idToken" });
    }

    // Verificar ID token con Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const { sub, email, name, picture } = payload;

    // Crear o buscar usuario
    const user = await prisma.user.upsert({
      where: { googleSub: sub },
      update: {
        email,
        name,
        imageUrl: picture,
      },
      create: {
        googleSub: sub,
        email,
        name,
        imageUrl: picture,
        wallet: {
          create: {
            balance: 0,
          },
        },
      },
      include: { wallet: true },
    });

    // Crear JWT interno
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
        imageUrl: user.imageUrl,
      },
      wallet: {
        balance: user.wallet.balance,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Invalid Google token" });
  }
});

export default router;
