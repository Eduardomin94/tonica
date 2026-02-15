import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import authRoutes from "./routes/auth.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { prisma } from "./prisma.js";

import { MercadoPagoConfig, Preference } from "mercadopago";

dotenv.config();

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
  (process.env.FRONTEND_URL || "").trim(), // producción (si lo usás)
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
// GENERATE (PROTEGIDO + COBRO)
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
    let wallet = null;
    let consumeEntry = null;
    const COST = 1;

    const userId = req.userId;
    const idem =
      req.headers["x-idempotency-key"] || `${userId}:${Date.now()}:${Math.random()}`;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      wallet = user?.wallet;
      if (!wallet) return res.status(400).json({ error: "Wallet not found" });

      const updated = await prisma.wallet.updateMany({
        where: { id: wallet.id, balance: { gte: COST } },
        data: { balance: { decrement: COST } },
      });

      if (updated.count === 0) {
        return res.status(402).json({ error: "Sin créditos" });
      }

      consumeEntry = await prisma.creditEntry.create({
        data: {
          walletId: wallet.id,
          type: "CONSUME",
          amount: -COST,
          idempotencyKey: String(idem),
          refType: "GENERATION",
        },
      });

      const mode = String(req.body?.mode || "model");

      // ---- PRODUCT MODE
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
          { key: "a", label: "toma principal" },
          { key: "b", label: "ángulo alternativo" },
          { key: "c", label: "detalle cercano" },
          { key: "d", label: "otro ángulo" },
        ];

        const settled = await Promise.allSettled(
          views.map(async (v) => {
            const viewPrompt = `${basePrompt}\n\nCámara: ${v.label}.`;
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

        const imageUrls = settled
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value);

        if (!imageUrls.length) {
          return res.status(500).json({ error: "No se pudo generar ninguna imagen de producto" });
        }

        return res.json({ imageUrls, promptUsed: basePrompt });
      }

      // ---- MODEL MODE (tu lógica existente)
      return res.status(400).json({ error: "Modo model no incluido en este snippet" });
    } catch (err) {
      console.error("GENERATE ERROR:", err);

      // REFUND
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
    console.log("MP ACCESS TOKEN:", process.env.MP_ACCESS_TOKEN?.slice(0, 10));
    const userId = req.userId;
const credits = Number(req.body?.credits ?? 10);
const unitPrice = credits * 100;

const backendBase = process.env.BACKEND_URL;   // ej: https://gleaming-rejoicing-production.up.railway.app
const frontendBase = process.env.FRONTEND_URL; // ej: https://tu-frontend.com

const externalReference = `u:${userId}|c:${credits}|t:${Date.now()}`;
console.log("MP BACK_URLS:", {
  FRONTEND_URL: process.env.FRONTEND_URL,
  success: `${process.env.FRONTEND_URL}/pago-exitoso`,
  failure: `${process.env.FRONTEND_URL}/pago-fallido`,
  pending: `${process.env.FRONTEND_URL}/pago-pendiente`,
});
const fe = String(process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
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

  // 👇 clave para mapear y debug
  external_reference: `u:${req.userId}|c:${credits}|t:${Date.now()}`,

  // 👇 clave para acreditar en webhook (lo vamos a usar)
  metadata: { userId: req.userId, credits },

  // 👇 clave: obliga a MP a llamarte al webhook
  notification_url: `${be}/mp/webhook?source_news=webhooks`,
  back_urls: {
  success: "https://google.com",
  failure: "https://google.com",
  pending: "https://google.com",
},



  auto_return: "approved",
},

});

    return res.json({
  init_point: preference.sandbox_init_point,
  id: preference.id,
});

  } catch (err) {
    console.error("MP ERROR:", err);
    return res.status(500).json({ error: "MercadoPago preference error" });
  }
});

// =====================
// MERCADOPAGO WEBHOOK (por ahora solo log + firma)
// =====================
app.post("/mp/webhook", express.json({ type: "*/*" }), (req, res) => {
  try {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) return res.sendStatus(200);

    const xSignature = req.headers["x-signature"];
    const xRequestId = req.headers["x-request-id"];
    if (!xSignature || !xRequestId) return res.sendStatus(200);

    const rawBody = JSON.stringify(req.body);
    const manifest = `id:${xRequestId};body:${rawBody};`;

    const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

    if (!String(xSignature).includes(expected)) {
      console.warn("Invalid webhook signature");
      return res.sendStatus(200);
    }

    console.log("✅ MP WEBHOOK OK:", req.body);
    return res.sendStatus(200);
  } catch (err) {
    console.error("MP WEBHOOK ERROR:", err);
    return res.sendStatus(200);
  }
});

// =====================
// STATIC + HEALTH (UNA SOLA VEZ)
// =====================
app.use("/uploads", express.static("uploads"));
app.get("/", (req, res) => res.json({ status: "OK" }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
