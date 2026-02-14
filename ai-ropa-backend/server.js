import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
const PORT = 3001;

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.FRONTEND_URL, // para producción
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // permitir requests sin origin (ej: Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("CORS not allowed"));
      }
    },
  })
);
app.options(/.*/, cors());
app.use(express.json({ limit: "10mb" }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Texto (si lo usás en otro lado). Para suggest ahora NO se usa.
const MODEL_TEXT = "gemini-flash-latest";

// Imagen (Nano Banana)
const MODEL_IMAGE = "gemini-2.5-flash-image";

const upload = multer({ dest: "uploads/" });

// --- helper Gemini (sin timeouts raros por ahora)
async function geminiGenerate({ model, body, timeoutMs = 60000 }) {
  if (!GEMINI_API_KEY) {
    throw new Error("Falta GEMINI_API_KEY en .env");
  }

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
    // cuando aborta por timeout, fetch tira error
    const msg = err?.name === "AbortError" ? `Timeout (${timeoutMs}ms)` : String(err?.message || err);
    return { status: 599, data: { error: msg } };
  } finally {
    clearTimeout(t);
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
      console.error(data);
      // fallback rápido
      return res.json({ options: ["estudio blanco seamless con luz suave"] });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }

    const option = String(parsed.option || "").trim();
    const finalOption = option && option.split(/\s+/).length <= 10
      ? option
      : "estudio blanco seamless con luz suave";

    // tu front espera "options" array → mandamos 1 sola
    return res.json({ options: [finalOption] });
  } catch (err) {
    console.error(err);
    return res.json({ options: ["estudio blanco seamless con luz suave"] });
  }
});

function extractImageBase64(data) {
  const cand = data?.candidates?.[0];
  const parts = cand?.content?.parts || [];

  // 1) buscar en parts (formatos comunes)
  for (const p of parts) {
    const b64 =
      p?.inlineData?.data ||
      p?.inline_data?.data ||
      p?.fileData?.data ||
      p?.file_data?.data;

    if (typeof b64 === "string" && b64.length > 1000) return b64;
  }

  // 2) fallback: buscar cualquier "data":"<base64...>" grande dentro del JSON
  try {
    const s = JSON.stringify(data);
    const m = s.match(/"data"\s*:\s*"([A-Za-z0-9+/=]{1000,})"/);
    return m?.[1] || null;
  } catch {
    return null;
  }
}


// =====================
// GENERATE IMAGES (4 en paralelo)
// =====================
app.post(
  "/generate",
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
    { name: "product_images", maxCount: 12 },
  ]),
  async (req, res) => {
    try {
      const mode = String(req.body?.mode || "model");

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

    const parts = [
  { text: viewPrompt },
  ...imagesParts,
];


    const { status, data } = await geminiGenerate({
      model: MODEL_IMAGE,
      body: { contents: [{ role: "user", parts }] },
      timeoutMs: 60000,
    });

    if (status >= 400) {
      console.error("Gemini product error:", JSON.stringify(data, null, 2));
      throw new Error("Gemini product error");
    }

    const imgB64 = extractImageBase64(data);
    if (!imgB64) throw new Error("No product image returned");

    const fileName = `generated-product-${v.key}-${Date.now()}-${Math.random().toString(16).slice(2)}.png`;
    const filePath = path.join("uploads", fileName);
    fs.writeFileSync(filePath, Buffer.from(imgB64, "base64"));

    return `/uploads/${fileName}`;
  })
);

// limpiar temporales
for (const f of files) {
  try { fs.unlinkSync(f.path); } catch {}
}

const imageUrls = settled
  .filter((r) => r.status === "fulfilled")
  .map((r) => r.value);

if (!imageUrls.length) {
  return res.status(500).json({ error: "No se pudo generar ninguna imagen de producto" });
}

return res.json({ imageUrls, promptUsed: basePrompt });

      }

      const front = req.files?.front?.[0];
const back = req.files?.back?.[0]; // opcional

if (!front) return res.status(400).json({ error: "Falta imagen front" });

const {
  category,
  other_category,
  pockets,
  model_type,
  ethnicity,
  age_range,
  background,
  pose,
  body_type,
} = req.body;

const basePrompt = `
Foto de catálogo e-commerce premium, fotorealista, iluminación de estudio suave, alta calidad.
Una sola persona, sin texto, sin marcas de agua, sin logos.
Modelo: ${model_type}, ${ethnicity}, ${age_range}.
Prenda: categoría ${category}. ${other_category ? `Detalle: ${other_category}.` : ""}
Bolsillos: ${pockets || "no especificado"}.
Fondo: ${background}.
Pose: ${pose}.
Contexto de cuerpo: ${
  body_type === "Plus Size"
    ? "cuerpo curvy/plus size realista, proporciones naturales"
    : "cuerpo estándar"
}.
Mantener la misma prenda, color, textura y calce en todas las tomas.
`.trim();

const frontBase64 = fs.readFileSync(front.path, { encoding: "base64" });
const backBase64 = back ? fs.readFileSync(back.path, { encoding: "base64" }) : null;

const views = [
  { key: "front", label: "vista delantera" },
  { key: "back", label: "vista trasera" },
  { key: "left", label: "perfil izquierdo (la cara del modelo mira hacia la derecha, hombro izquierdo más cercano a cámara)" },
  { key: "right", label: "perfil derecho (la cara del modelo mira hacia la izquierda, hombro derecho más cercano a cámara)" },
];


const settled = await Promise.allSettled(
  views.map(async (v) => {
    const viewPrompt = `
${basePrompt}

TOMA OBLIGATORIA: ${v.label}.
No repetir la misma orientación que otra toma.
Si es perfil izquierdo, mostrar claramente el lado izquierdo del cuerpo y de la prenda.
Si es perfil derecho, mostrar claramente el lado derecho del cuerpo y de la prenda.
Encuadre cuerpo entero, centrado.
`.trim();


    const parts = [
      { text: viewPrompt },
      {
        inlineData: {
          mimeType: front.mimetype,
          data: frontBase64,
        },
      },
    ];

    if (backBase64) {
      parts.push({
        inlineData: {
          mimeType: back.mimetype,
          data: backBase64,
        },
      });
    }

    const { status, data } = await geminiGenerate({
      model: MODEL_IMAGE,
      body: { contents: [{ role: "user", parts }] },
      timeoutMs: 60000,
    });

    if (status >= 400) {
      console.error("Gemini image error:", JSON.stringify(data, null, 2));
      throw new Error(`Gemini image error (${v.key})`);
    }

    const imgB64 = extractImageBase64(data);
    if (!imgB64) {
      console.error("No image returned. Raw:", JSON.stringify(data, null, 2));
      throw new Error(`No se generó imagen (${v.key})`);
    }

    const fileName = `generated-${v.key}-${Date.now()}-${Math.random().toString(16).slice(2)}.png`;
    const filePath = path.join("uploads", fileName);
    fs.writeFileSync(filePath, Buffer.from(imgB64, "base64"));

    return `/uploads/${fileName}`;
  })
);

// limpiar temporales
try { fs.unlinkSync(front.path); } catch {}
if (back) { try { fs.unlinkSync(back.path); } catch {} }

const imageUrls = settled
  .filter((r) => r.status === "fulfilled")
  .map((r) => r.value);

if (!imageUrls.length) {
  return res.status(500).json({ error: "No se pudo generar ninguna imagen" });
}

return res.json({ imageUrls, promptUsed: basePrompt });


    } catch (err) {
      console.error("GENERATE ERROR:", err);
      return res.status(500).json({
        error: "Error en generate",
        details: String(err?.message || err),
      });
    }
  }
);


// =====================
// STATIC + HEALTH
// =====================
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => res.json({ status: "OK" }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
