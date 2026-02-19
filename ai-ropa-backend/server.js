import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";

import authRoutes from "./routes/auth.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { prisma } from "./prisma.js";

import { MercadoPagoConfig, Preference } from "mercadopago";
import fetch from "node-fetch";

dotenv.config();
fs.mkdirSync("uploads", { recursive: true });

const app = express();
const PORT = process.env.PORT || 3001;

// =====================
// MERCADO PAGO CLIENT
// =====================
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});
const mpPreference = new Preference(mpClient);

// =====================
// CORS + JSON
// =====================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://tonica-woad.vercel.app",
  (process.env.FRONTEND_URL || "").trim(),
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS not allowed"));
    },
  })
);
app.options(/.*/, cors());
app.use(express.json({ limit: "10mb" }));

// =====================
// ROUTES
// =====================
app.use("/auth", authRoutes);

// =====================
// WALLET: CREDIT ENTRIES (HISTORIAL)
// =====================
app.get("/wallet/entries", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user?.wallet) return res.status(400).json({ error: "Wallet not found" });

    const entries = await prisma.creditEntry.findMany({
      where: { walletId: user.wallet.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        amount: true,
        refType: true,
        refId: true,
        createdAt: true,
      },
    });

    return res.json({ entries });
  } catch (err) {
    console.error("WALLET ENTRIES ERROR:", err);
    return res.status(500).json({ error: "Error cargando historial" });
  }
});

// =====================
// GEMINI
// =====================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_TEXT = "gemini-flash-latest";
const MODEL_IMAGE = "gemini-2.5-flash-image";

const upload = multer({ dest: "uploads/" });

async function geminiGenerate({ model, body, timeoutMs = 60000 }) {
  if (!GEMINI_API_KEY) throw new Error("Falta GEMINI_API_KEY en .env");

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      }
    );

    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (err) {
    const msg =
      err?.name === "AbortError" ? `Timeout (${timeoutMs}ms)` : String(err?.message || err);
    return { status: 599, data: { error: msg } };
  } finally {
    clearTimeout(t);
  }
}

function extractImageBase64(data) {
  const cand = data?.candidates?.[0];
  const parts = cand?.content?.parts || [];

  for (const p of parts) {
    const b64 =
      p?.inlineData?.data ||
      p?.inline_data?.data ||
      p?.fileData?.data ||
      p?.file_data?.data;

    if (typeof b64 === "string" && b64.length > 1000) return b64;
  }

  try {
    const s = JSON.stringify(data);
    const m = s.match(/"data"\s*:\s*"([A-Za-z0-9+/=]{1000,})"/);
    return m?.[1] || null;
  } catch {
    return null;
  }
}

// =====================
// SUGGEST BACKGROUND
// =====================
app.post("/suggest-background", async (req, res) => {
  try {
    const { category, model_type, vibe } = req.body;

    const prompt = `
Devolvé SOLO JSON válido:
{"option":"..."}

Sugerí 1 solo fondo para fotos e-commerce.
Solo describí el lugar.
Máximo 10 palabras.

Categoría: ${category}
Modelo: ${model_type}
Vibe: ${vibe}
`.trim();

    const { status, data } = await geminiGenerate({
      model: MODEL_TEXT,
      body: { contents: [{ role: "user", parts: [{ text: prompt }] }] },
      timeoutMs: 15000,
    });

    if (status >= 400) {
      return res.json({ options: ["estudio blanco seamless con luz suave"] });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch {}

    const option = String(parsed.option || "").trim();
    const finalOption =
      option && option.split(/\s+/).length <= 10
        ? option
        : "estudio blanco seamless con luz suave";

    return res.json({ options: [finalOption] });
  } catch (err) {
    console.error(err);
    return res.json({ options: ["estudio blanco seamless con luz suave"] });
  }
});

// =====================
// GENERATE (COBRO 1 SOLA VEZ)
// =====================
app.post(
  "/generate",
  requireAuth,
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
    { name: "product_images", maxCount: 12 },
  ]),
  async (req, res) => {
    const mode = String(req.body?.mode || "model").toLowerCase();

    // views para ambos modos (model y product)
    let selectedViews = {};
    try {
      selectedViews = req.body?.views ? JSON.parse(String(req.body.views)) : {};
    } catch {
      selectedViews = {};
    }

    const requestedKeys = [
  "front",
  "back",
  "side",
  "detail_front",
  "detail_back",
  "detail_pants_front",
  "detail_pants_back",
].filter((k) => !!selectedViews?.[k]);


    const COST = requestedKeys.length;

    if (COST <= 0) {
      return res.status(400).json({ error: "NO_VIEWS_SELECTED" });
    }

    let wallet = null;
    let consumeEntry = null;

    const userId = req.userId;
    const idem = req.headers["x-idempotency-key"] || `${userId}:${Date.now()}:${Math.random()}`;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      wallet = user?.wallet;
      if (!wallet) return res.status(400).json({ error: "Wallet not found" });

      // ---------- COBRO (UNA VEZ) ----------
      const updated = await prisma.wallet.updateMany({
        where: { id: wallet.id, balance: { gte: COST } },
        data: { balance: { decrement: COST } },
      });

      if (updated.count === 0) {
        return res.status(402).json({ error: "Sin créditos suficientes" });
      }

      consumeEntry = await prisma.creditEntry.create({
        data: {
          walletId: wallet.id,
          type: "CONSUME",
          amount: -COST,
          idempotencyKey: String(idem),
          refType: "GENERATION",
          metadata: mode === "model" ? selectedViews : undefined,
        },
      });

      // =====================
      // PRODUCT MODE (1 crédito fijo)
      // =====================
      if (mode === "product") {
        const files = req.files?.product_images || [];
        const scene = String(req.body?.scene || "").trim();

        if (!files.length) return res.status(400).json({ error: "Faltan fotos del producto" });
        if (!scene) return res.status(400).json({ error: "Falta escena" });

        const imagesParts = files.slice(0, 8).map((f) => ({
          inlineData: {
            mimeType: f.mimetype,
            data: fs.readFileSync(f.path, { encoding: "base64" }),
          },
        }));

        const basePrompt = `
Foto de producto e-commerce premium, fotorealista, iluminación de estudio suave.
Solo el producto, sin personas, sin manos, sin texto, sin marcas de agua.
Escena: ${scene}.
Mantener exactamente el mismo producto, color y textura.
`.trim();

        const views = [
  { key: "front", label: "vista frontal completa (cuerpo completo)" },
  { key: "back", label: "vista trasera completa (cuerpo completo)" },

  { key: "side", label: "vista costado completa (cuerpo completo)" },

  { key: "detail_front", label: "detalle del frente de la prenda (primer plano)" },
  { key: "detail_back", label: "detalle de la espalda de la prenda (primer plano)" },

  { key: "detail_pants_front", label: "detalle del pantalón al frente (primer plano)" },
  { key: "detail_pants_back", label: "detalle del pantalón por detrás (primer plano)" },
].filter((v) => selectedViews?.[v.key]);


        const settled = await Promise.allSettled(
          views.map(async (v) => {
            const viewPrompt = `
${basePrompt}

Cámara: ${v.label}.

IMPORTANTE:
- Generar UNA SOLA imagen.
- NO collage, NO cuadrícula, NO múltiples paneles, NO duplicados.
- Fondo continuo (sin cortes).
`.trim();

            const parts = [{ text: viewPrompt }, ...imagesParts];

            const { status, data } = await geminiGenerate({
              model: MODEL_IMAGE,
              body: { contents: [{ role: "user", parts }] },
              timeoutMs: 60000,
            });

            if (status >= 400) throw new Error("Gemini product error");

            const imgB64 = extractImageBase64(data);
            if (!imgB64) throw new Error("No product image returned");

            const fileName = `generated-product-${v.key}-${Date.now()}-${Math.random()
              .toString(16)
              .slice(2)}.png`;
            const filePath = path.join("uploads", fileName);
            fs.writeFileSync(filePath, Buffer.from(imgB64, "base64"));
            return `/uploads/${fileName}`;
          })
        );

        for (const f of files) {
          try {
            fs.unlinkSync(f.path);
          } catch {}
        }

        const imageUrls = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);

        if (!imageUrls.length) {
          return res.status(500).json({ error: "No se pudo generar ninguna imagen de producto" });
        }

        return res.json({ imageUrls, promptUsed: basePrompt });
      }

      // =====================
      // MODEL MODE (1 crédito por vista)
      // =====================
      if (mode === "model") {
        const front = req.files?.front?.[0];
        const back = req.files?.back?.[0];

        if (!front) return res.status(400).json({ error: "Falta foto delantera" });

        const category = String(req.body?.category || "");
        const otherCategory = String(req.body?.other_category || "");
        const pockets = String(req.body?.pockets || "");
        const modelType = String(req.body?.model_type || "");
        const ethnicity = String(req.body?.ethnicity || "");
        const ageRange = String(req.body?.age_range || "");
        const background = String(req.body?.background || "");
        const pose = String(req.body?.pose || "");
        const bodyType = String(req.body?.body_type || "");

        const refParts = [
          {
            inlineData: {
              mimeType: front.mimetype,
              data: fs.readFileSync(front.path, { encoding: "base64" }),
            },
          },
        ];

        if (back) {
          refParts.push({
            inlineData: {
              mimeType: back.mimetype,
              data: fs.readFileSync(back.path, { encoding: "base64" }),
            },
          });
        }

        const catFinal = category === "otro" && otherCategory ? `Otro: ${otherCategory}` : category;

        const basePrompt = `
Foto de moda e-commerce, fotorealista, iluminación suave tipo estudio.
Usar EXACTAMENTE la prenda de las fotos referencia (color, textura, estampado, calce).
Misma modelo y mismo rostro en todas las vistas (consistencia total).
Sin texto, sin marcas de agua, sin logos, sin manos extra.
Categoría: ${catFinal}
Bolsillos: ${pockets}
Tipo de modelo: ${modelType}
Etnia: ${ethnicity}
Edad: ${ageRange}
Pose: ${pose}
Tipo de cuerpo: ${bodyType}
Fondo: ${background}
`.trim();

        const views = [
          { key: "front", label: "vista frontal" },
          { key: "back", label: "vista trasera" },
          { key: "left", label: "vista costado izquierdo" },
          { key: "right", label: "vista costado derecho" },
        ].filter((v) => selectedViews?.[v.key]);

        if (!views.length) {
          return res.status(400).json({ error: "Debes seleccionar al menos una vista" });
        }

        const settled = await Promise.allSettled(
          views.map(async (v) => {
            const extraBackHint =
              v.key === "back" && !back
                ? "\nLa vista trasera debe ser coherente con la delantera. Inferí la espalda basándote en la imagen frontal sin inventar cambios drásticos."
                : "";

            const viewPrompt = `
${basePrompt}

Cámara: ${v.label}.
${extraBackHint}

IMPORTANTE:
- Generar UNA SOLA imagen.
- NO collage, NO cuadrícula, NO múltiples paneles, NO duplicados.
- Un solo cuerpo completo, centrado.
- Fondo continuo (sin cortes).
`.trim();

            const parts = [{ text: viewPrompt }, ...refParts];

            const { status, data } = await geminiGenerate({
              model: MODEL_IMAGE,
              body: { contents: [{ role: "user", parts }] },
              timeoutMs: 60000,
            });

            if (status >= 400) throw new Error("Gemini model error");

            const imgB64 = extractImageBase64(data);
            if (!imgB64) throw new Error("No model image returned");

            const fileName = `generated-model-${v.key}-${Date.now()}-${Math.random()
              .toString(16)
              .slice(2)}.png`;
            const filePath = path.join("uploads", fileName);
            fs.writeFileSync(filePath, Buffer.from(imgB64, "base64"));
            return `/uploads/${fileName}`;
          })
        );

        try {
          fs.unlinkSync(front.path);
        } catch {}
        if (back) {
          try {
            fs.unlinkSync(back.path);
          } catch {}
        }

        const imageUrls = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);

        if (!imageUrls.length) {
          return res.status(500).json({ error: "No se pudo generar ninguna imagen con modelo" });
        }

        return res.json({ imageUrls, promptUsed: basePrompt });
      }

      return res.status(400).json({ error: "Modo inválido" });
    } catch (err) {
      console.error("GENERATE ERROR:", err);

      // REFUND del COST real
      try {
        if (wallet) {
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: COST } },
          });

          await prisma.creditEntry.create({
            data: {
              walletId: wallet.id,
              type: "REFUND",
              amount: COST,
              idempotencyKey: `refund:${idem}`,
              refType: "GENERATION",
              refId: consumeEntry?.id || null,
            },
          });
        }
      } catch (refundError) {
        console.error("REFUND FAILED:", refundError);
      }

      return res.status(500).json({
        error: "Error en generate",
        details: String(err?.message || err),
      });
    }
  }
);

// =====================
// MERCADO PAGO: CREATE PREFERENCE
// =====================
app.post("/mp/create-preference", requireAuth, async (req, res) => {
  try {
    const credits = Number(req.body?.credits);

    let unitPrice;

    if (credits === 50) {
      unitPrice = 1;
    } else if (credits === 200) {
      unitPrice = 1;
    } else if (credits === 900) {
      unitPrice = 1;
    } else {
      return res.status(400).json({ error: "Paquete inválido" });
    }

    const be = String(process.env.BACKEND_URL || "").trim().replace(/\/$/, "");

    const preference = await mpPreference.create({
      body: {
        items: [
          {
            title: `Créditos AI Ropa (${credits})`,
            quantity: 1,
            unit_price: unitPrice,
            currency_id: "ARS",
          },
        ],
        external_reference: String(req.userId),
        metadata: { user_id: req.userId, credits },
        notification_url: `${be}/mp/webhook?source_news=webhooks`,
        back_urls: {
          success: `${be}/pago-exitoso`,
          failure: `${be}/pago-fallido`,
          pending: `${be}/pago-pendiente`,
        },
        auto_return: "approved",
      },
    });

    return res.json({
      init_point: preference.init_point,
      id: preference.id,
    });
  } catch (err) {
    console.error("MP ERROR:", err);
    return res.status(500).json({ error: "MercadoPago preference error" });
  }
});

// =====================
// MERCADOPAGO WEBHOOK (ACREDITA)
// =====================
app.post("/mp/webhook", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.query?.id || req.query?.["data.id"];
    if (!paymentId) return res.sendStatus(200);

    const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    const payment = await r.json().catch(() => null);
    if (!r.ok || !payment) return res.sendStatus(200);
    if (payment.status !== "approved") return res.sendStatus(200);

    const userId = payment?.metadata?.user_id || payment?.external_reference;
    const credits = Number(payment?.metadata?.credits || 0);
    if (!userId || !Number.isFinite(credits) || credits <= 0) return res.sendStatus(200);

    const existing = await prisma.creditEntry.findFirst({
      where: { refType: "MP_PAYMENT", refId: String(paymentId) },
      select: { id: true },
    });
    if (existing) return res.sendStatus(200);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: String(userId) },
        include: { wallet: true },
      });
      if (!user?.wallet) throw new Error("Wallet not found");

      await tx.wallet.update({
        where: { id: user.wallet.id },
        data: { balance: { increment: credits } },
      });

      await tx.creditEntry.create({
        data: {
          walletId: user.wallet.id,
          type: "PURCHASE",
          amount: credits,
          idempotencyKey: `mp:${paymentId}`,
          refType: "MP_PAYMENT",
          refId: String(paymentId),
        },
      });
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error("MP WEBHOOK ERROR:", err);
    return res.sendStatus(200);
  }
});

// =====================
// STATIC + HEALTH
// =====================
app.use("/uploads", express.static("uploads"));
app.get("/", (req, res) => res.json({ status: "OK" }));

// =====================
// MP RETURN ROUTES
// =====================
const FRONT = (process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
app.get("/pago-exitoso", (req, res) => res.redirect(`${FRONT}/?topup=ok`));
app.get("/pago-fallido", (req, res) => res.redirect(`${FRONT}/?topup=fail`));
app.get("/pago-pendiente", (req, res) => res.redirect(`${FRONT}/?topup=pending`));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
