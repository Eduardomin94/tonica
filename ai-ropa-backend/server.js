import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import authRoutes from "./routes/auth.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { prisma } from "./prismaClient.js";
import { MercadoPagoConfig, Preference } from "mercadopago";
import fetch from "node-fetch";
import { makeTransporter } from "./mailer.js";

dotenv.config();
console.log("ENV CHECK:", {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET ? "OK" : "MISSING",
  FRONTEND_URL: process.env.FRONTEND_URL,
  ADMIN09_PASSWORD: process.env.ADMIN09_PASSWORD ? "OK" : "MISSING",
});


const app = express();
// =====================
// QUEUE / SEMAPHORE (FIFO) para /generate
// =====================
const MAX_CONCURRENT_GENERATIONS = 12;
let activeGenerations = 0;

// Cola FIFO
const waitQueue = [];

// Esperar turno
function acquireGenerationSlot() {
  if (activeGenerations < MAX_CONCURRENT_GENERATIONS) {
    activeGenerations++;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    waitQueue.push(resolve);
  }).then(() => {
    activeGenerations++;
  });
}

// Liberar turno
function releaseGenerationSlot() {
  activeGenerations = Math.max(0, activeGenerations - 1);
  const next = waitQueue.shift();
  if (next) next();
}
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
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "https://tonica-woad.vercel.app",
  "https://fotonine.com",
  "https://www.fotonine.com",
  (process.env.FRONTEND_URL || "").trim(),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      // ✅ DEV: permitir cualquier localhost (cualquier puerto)
      if (origin.startsWith("http://localhost:")) return cb(null, true);
      if (origin.startsWith("http://127.0.0.1:")) return cb(null, true);

      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS not allowed: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key", "X-Admin-Password"],
  })
);

// Preflight
app.options("*", cors());

app.use(express.json({ limit: "10mb" }));

// =====================
// ROUTES
// =====================
app.use("/auth", authRoutes);
// =====================
// ADMIN: usuarios por periodo (bucket)
// =====================
app.get("/admin/users-by-bucket", async (req, res) => {
  try {
    const pass = String(req.header("X-Admin-Password") || "");
    if (!pass || pass !== String(process.env.ADMIN09_PASSWORD || "")) {
      return res.status(401).json({ error: "ADMIN09_UNAUTHORIZED" });
    }

    const interval = String(req.query.interval || "day"); // day | week | month
    const bucket = String(req.query.bucket || "");
    if (!bucket) return res.status(400).json({ error: "MISSING_BUCKET" });

    // Parse del bucket que te devuelve users-stats (viene como fecha ISO)
    const dt = new Date(bucket);
    if (Number.isNaN(dt.getTime())) {
      return res.status(400).json({ error: "INVALID_BUCKET" });
    }

    let start = new Date(dt);
    let end = new Date(dt);

    if (interval === "day") {
      end = new Date(start);
      end.setDate(end.getDate() + 1);
    } else if (interval === "week") {
      end = new Date(start);
      end.setDate(end.getDate() + 7);
    } else if (interval === "month") {
      end = new Date(start);
      end.setDate(end.getDate() + 30);
    } else {
      return res.status(400).json({ error: "INVALID_INTERVAL" });
    }

    // Traer usuarios creados en ese rango
    const users = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return res.json({ users });
  } catch (e) {
    console.error("users-by-bucket error:", e);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});
// =====================
// FEEDBACK FORM
// =====================
const feedbackUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

app.post("/feedback", feedbackUpload.single("screenshot"), async (req, res) => {
  const file = req.file;

  try {
    const email = String(req.body?.email || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!email || !message) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    // validación simple
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }

    const attachments = file
  ? [
      {
        filename: file.originalname || "screenshot.png",
        content: file.buffer,
        contentType: file.mimetype || "image/png",
      },
    ]
  : [];

const resend = makeTransporter();

const out = await resend.emails.send({
  from: process.env.FROM_EMAIL,
  to: process.env.ADMIN_EMAIL,
  subject: "📩 Nuevo mensaje desde formulario",
  reply_to: email,
  html: `
    <div style="font-family: Arial, sans-serif; line-height:1.4">
      <h2 style="margin:0 0 10px">Nuevo mensaje de usuario</h2>
      <p><b>Email:</b> ${email}</p>
      <p><b>Mensaje:</b></p>
      <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:10px">${escapeHtml(message)}</pre>
    </div>
  `,
  attachments,
});

console.log("RESEND feedback out:", JSON.stringify(out));

if (out?.error) {
  console.error("RESEND feedback error:", out.error);
  return res.status(500).json({ error: out.error?.message || "Resend error" });
}

return res.json({ success: true, id: out?.data?.id || out?.id });
  } catch (err) {
    console.error("FEEDBACK ERROR:", err);
    return res.status(500).json({ error: "Error enviando mensaje" });
  } finally {
  }
});

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =====================
// ADMIN09: rate limit / lockout (por IP)
// =====================

// Railway/Vercel proxy: permite leer req.ip correcto
app.set("trust proxy", 1);

const ADMIN09_MAX_ATTEMPTS = 4;
const ADMIN09_LOCK_MS = 10 * 60 * 1000; // 10 minutos
const admin09Attempts = new Map(); // key: ip -> { attempts, lockedUntil }

function admin09Key(req) {
  // 1) si viene por proxy, tomar la primera IP real
  const xf = String(req.headers["x-forwarded-for"] || "");
  let ip = xf ? xf.split(",")[0].trim() : String(req.ip || req.connection?.remoteAddress || "");

  // 2) normalizar localhost ipv6/ipv4-mapped
  if (ip === "::1") ip = "127.0.0.1";
  if (ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");

  return ip || "unknown";
}

function requireAdmin09(req, res, next) {
  const pass = String(process.env.ADMIN09_PASSWORD || "");
  if (!pass) return res.status(500).json({ error: "ADMIN09_PASSWORD missing" });

  const provided = String(req.headers["x-admin-password"] || "");
  const key = admin09Key(req);

  const now = Date.now();
  const st = admin09Attempts.get(key) || { attempts: 0, lockedUntil: 0 };

  // 1) si está bloqueado
  if (st.lockedUntil && now < st.lockedUntil) {
    const retryAfterSec = Math.ceil((st.lockedUntil - now) / 1000);
    return res.status(429).json({
      error: "ADMIN09_LOCKED",
      retryAfterSec,
      attempts: st.attempts,
      maxAttempts: ADMIN09_MAX_ATTEMPTS,
    });
  }

  // 2) check password
  const ok = provided && provided === pass;

  console.log("ADMIN09 CHECK:", {
    ip: key,
    hasProvided: !!provided,
    providedLen: provided.length,
    envLen: pass.length,
    match: ok,
    attempts: st.attempts,
    locked: st.lockedUntil ? now < st.lockedUntil : false,
  });

  if (!ok) {
    st.attempts = (st.attempts || 0) + 1;

    // al intento #4: bloquear 10 minutos
    if (st.attempts >= ADMIN09_MAX_ATTEMPTS) {
      st.lockedUntil = now + ADMIN09_LOCK_MS;
      admin09Attempts.set(key, st);

      return res.status(429).json({
        error: "ADMIN09_LOCKED",
        retryAfterSec: Math.ceil(ADMIN09_LOCK_MS / 1000),
        attempts: st.attempts,
        maxAttempts: ADMIN09_MAX_ATTEMPTS,
      });
    }

    admin09Attempts.set(key, st);

    return res.status(401).json({
      error: "ADMIN09_UNAUTHORIZED",
      attempts: st.attempts,
      maxAttempts: ADMIN09_MAX_ATTEMPTS,
      attemptsLeft: Math.max(0, ADMIN09_MAX_ATTEMPTS - st.attempts),
    });
  }

  // 3) si es correcto, resetear estado
  admin09Attempts.delete(key);
  next();
}

async function requireAdmin(req, res, next) {
  try {
    const adminEmail = String(process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    if (!adminEmail) return res.status(500).json({ error: "ADMIN_EMAIL missing" });

    const me = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true },
    });

    const myEmail = String(me?.email || "").toLowerCase().trim();
    if (!myEmail || myEmail !== adminEmail) {
      return res.status(403).json({ error: "ADMIN_ONLY" });
    }

    return next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(500).json({ error: "Admin check failed" });
  }
}

async function applyWelcomeBonusExpiry(walletId) {
  // 1) traer todos los movimientos del bonus (GRANT + CONSUME + RESTORE)
  const bonusEntries = await prisma.creditEntry.findMany({
    where: { walletId, refType: { startsWith: "WELCOME_BONUS" } },
    select: { id: true, amount: true, refType: true, metadata: true },
  });

  if (!bonusEntries.length) return;

  // 2) encontrar algún movimiento que tenga expiresAt en metadata (no depende de refType exacto)
  const withExpiry = bonusEntries.find((e) => e?.metadata?.expiresAt);
  const expiresAtIso = withExpiry?.metadata?.expiresAt;
  if (!expiresAtIso) return;

  const expiresAtMs = new Date(expiresAtIso).getTime();
  if (!Number.isFinite(expiresAtMs)) return;

  // si todavía no venció, no hacemos nada
  if (Date.now() < expiresAtMs) return;

  // 3) si ya registramos expiración, no duplicar
  const alreadyExpired = await prisma.creditEntry.findFirst({
    where: { walletId, refType: "WELCOME_BONUS_EXPIRE" },
    select: { id: true },
  });
  if (alreadyExpired) return;

  // 4) bonus restante = suma de WELCOME_BONUS* excepto EXPIRE
const remaining = Math.max(
  0,
  bonusEntries
    .filter((e) => e.refType !== "WELCOME_BONUS_EXPIRE")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0)
);

  // 5) crear movimiento "expirado" consumiendo lo que quedaba
  await prisma.creditEntry.create({
    data: {
      walletId,
      type: "CONSUME",
      amount: remaining > 0 ? -remaining : 0,
      idempotencyKey: `welcome-expire:${walletId}:${expiresAtIso}`,
      refType: "WELCOME_BONUS_EXPIRE",
      metadata: {
        expiresAt: expiresAtIso,
        expiredAt: new Date().toISOString(),
      },
    },
  });
}
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
    const allEntries = await prisma.creditEntry.findMany({
  where: { walletId: user.wallet.id },
  select: { refType: true, metadata: true, amount: true },
});
console.log("BONUS ENTRIES DEBUG:", allEntries);
    await applyWelcomeBonusExpiry(user.wallet.id);
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
        metadata: true,
      },
    });

    return res.json({ entries });
  } catch (err) {
    console.error("WALLET ENTRIES ERROR:", err);
    return res.status(500).json({ error: "Error cargando historial" });
  }
});
app.get("/admin/entries", requireAdmin09, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query?.pageSize || 50)));
    const skip = (page - 1) * pageSize;

    const userQ = String(req.query?.user || "").trim().toLowerCase();

const date = req.query?.date ? String(req.query.date) : "";
const from = req.query?.from ? new Date(String(req.query.from)) : null;
const to = req.query?.to ? new Date(String(req.query.to)) : null;

// ✅ Si viene date=YYYY-MM-DD, usamos ese día completo
let dayStart = null;
let dayEnd = null;

if (date) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    dayStart = start;
    dayEnd = end;
  }
}

    const where = {
  // ✅ prioridad: fecha exacta
  ...(dayStart && dayEnd
    ? { createdAt: { gte: dayStart, lte: dayEnd } }
    : from || to
    ? {
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      }
    : {}),

  ...(userQ
    ? {
        wallet: {
          user: {
            email: { contains: userQ, mode: "insensitive" },
          },
        },
      }
    : {}),
};

    const [items, total] = await Promise.all([
      prisma.creditEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          type: true,
          amount: true,
          refType: true,
          metadata: true,
          wallet: { select: { user: { select: { id: true, email: true, name: true } } } },
        },
      }),
      prisma.creditEntry.count({ where }),
    ]);

    const entries = items.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      userEmail: e.wallet?.user?.email || null,
      userName: e.wallet?.user?.name || null,
      movement: e.refType === "WELCOME_BONUS_EXPIRE" ? "EXPIRED" : e.type,
      amount: e.amount,
      refType: e.refType,
      mode: e.metadata?.mode ?? null,
    }));

    return res.json({ page, pageSize, total, entries });
  } catch (err) {
    console.error("ADMIN entries error:", err);
    return res.status(500).json({ error: "Error cargando entries" });
  }
});
app.get("/admin/users-stats", requireAdmin09, async (req, res) => {
  try {
  const date = req.query?.date ? String(req.query.date) : ""; // YYYY-MM-DD (ancla)
  const page = Math.max(1, Number(req.query?.page || 1));
  const pageSize = Math.min(200, Math.max(1, Number(req.query?.pageSize || 20)));
  const skip = (page - 1) * pageSize;

  // ancla: si no viene date, usamos hoy
  const anchor = date || new Date().toISOString().split("T")[0];

  // rango: desde el inicio del tiempo hasta el FIN del día ancla (inclusive)
  const anchorStart = new Date(`${anchor}T00:00:00.000Z`);
  const anchorEnd = new Date(`${anchor}T00:00:00.000Z`);
  anchorEnd.setUTCDate(anchorEnd.getUTCDate() + 1); // exclusivo (lt)

  if (Number.isNaN(anchorStart.getTime()) || Number.isNaN(anchorEnd.getTime())) {
    return res.status(400).json({ error: "INVALID_DATE" });
  }

  // total de "días distintos" hasta esa fecha (para paginación)
  const totalArr = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total
    FROM (
      SELECT date_trunc('day', "createdAt") AS bucket
      FROM "User"
      WHERE "createdAt" < ${anchorEnd}
      GROUP BY 1
    ) t;
  `;
  const total = Number(totalArr?.[0]?.total || 0);

  // 20 líneas paginadas: buckets por día (desc)
  const rows = await prisma.$queryRaw`
    SELECT
      date_trunc('day', "createdAt") AS bucket,
      COUNT(*)::int AS count
    FROM "User"
    WHERE "createdAt" < ${anchorEnd}
    GROUP BY 1
    ORDER BY 1 DESC
    OFFSET ${skip}
    LIMIT ${pageSize};
  `;

  return res.json({
    mode: "day_paged",
    anchor,
    page,
    pageSize,
    total,
    rows,
  });
} catch (err) {
    console.error("ADMIN users-stats error:", err);
    return res.status(500).json({ error: "Error stats users" });
  }
});
// =====================
// ADMIN: TOTAL USUARIOS HISTÓRICO
// =====================
app.get("/admin/users-total", requireAdmin09, async (req, res) => {
  try {
    const total = await prisma.user.count();
    return res.json({ total });
  } catch (err) {
    console.error("ADMIN users-total error:", err);
    return res.status(500).json({ error: "Error contando usuarios" });
  }
});
app.get("/admin/payments-stats", requireAdmin09, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query?.pageSize || 20)));
    const skip = (page - 1) * pageSize;

    // filtros opcionales
    let from = req.query?.from ? new Date(String(req.query.from)) : null;
let to = req.query?.to ? new Date(String(req.query.to)) : null;

// ✅ Si es misma fecha, expandimos a todo el día
if (from && to && String(req.query.from) === String(req.query.to)) {
  const start = new Date(`${req.query.from}T00:00:00.000Z`);
  const end = new Date(`${req.query.to}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);

  from = start;
  to = end;
}
    const userQ = String(req.query?.user || "").trim().toLowerCase();

    const where = {
      type: "PURCHASE",
      refType: "MP_PAYMENT",
      // solo aprobados
      metadata: { path: ["status"], equals: "approved" },
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(userQ
        ? {
            wallet: {
              user: {
                email: { contains: userQ, mode: "insensitive" },
              },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.creditEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          amount: true, // créditos
          refId: true,  // paymentId
          metadata: true,
          wallet: { select: { user: { select: { id: true, email: true, name: true } } } },
        },
      }),
      prisma.creditEntry.count({ where }),
    ]);
// Total ARS (suma de amountArs en metadata) para el mismo filtro
const allForSum = await prisma.creditEntry.findMany({
  where,
  select: { metadata: true },
});

const totalArs = allForSum.reduce((sum, e) => {
  const v = Number(e?.metadata?.amountArs ?? 0);
  return sum + (Number.isFinite(v) ? v : 0);
}, 0);
    
    const payments = items.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      email: e.wallet?.user?.email || null,
      name: e.wallet?.user?.name || null,
      credits: e.amount,
      ars: e.metadata?.amountArs ?? null,
      paymentId: e.refId ?? null,
      status: e.metadata?.status ?? null,
    }));

    return res.json({ page, pageSize, total, totalArs, payments });
  } catch (err) {
    console.error("ADMIN payments list error:", err);
    return res.status(500).json({ error: "Error cargando pagos" });
  }
});

app.get("/admin/user-balances", requireAdmin09, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query?.pageSize || 20)));
    const skip = (page - 1) * pageSize;

    const userQ = String(req.query?.user || "").trim().toLowerCase();

    const whereUser = userQ
      ? {
          OR: [
            { email: { contains: userQ, mode: "insensitive" } },
            { name: { contains: userQ, mode: "insensitive" } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where: whereUser,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          wallet: { select: { balance: true } },
        },
      }),
      prisma.user.count({ where: whereUser }),
    ]);

    const users = items.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt,
      credits: u.wallet?.balance ?? 0,
    }));

    return res.json({ page, pageSize, total, users });
  } catch (err) {
    console.error("ADMIN user-balances error:", err);
    return res.status(500).json({ error: "Error cargando balances" });
  }
});

app.get("/admin/user-movements", requireAdmin09, async (req, res) => {
  try {
    const userId = String(req.query?.userId || "").trim();
    if (!userId) return res.status(400).json({ error: "userId required" });

    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query?.pageSize || 50)));
    const skip = (page - 1) * pageSize;

   const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, wallet: { select: { id: true } } },
});

if (!user) return res.status(404).json({ error: "User not found" });

let walletId = user.wallet?.id;

// ✅ si no tiene wallet, la creamos ahora
if (!walletId) {
  const w = await prisma.wallet.create({
    data: { userId: user.id, balance: 0 },
    select: { id: true },
  });
  walletId = w.id;
}

    const [items, total] = await Promise.all([
      prisma.creditEntry.findMany({
        where: { walletId },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          type: true,
          amount: true,
          refType: true,
          metadata: true,
        },
      }),
      prisma.creditEntry.count({ where: { walletId } }),
    ]);

    const movements = items.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      type: e.type,
      refType: e.refType,
      amount: e.amount,
      mode: e.metadata?.mode ?? null,
    }));

    return res.json({ page, pageSize, total, movements });
  } catch (err) {
    console.error("ADMIN user-movements error:", err);
    return res.status(500).json({ error: "Error cargando movimientos" });
  }
});

// =====================
// ADMIN: COMPRAS (quién / cuánto / cuándo)
// =====================
app.get("/admin/purchases", requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 50)));
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.creditEntry.findMany({
        where: { type: "PURCHASE", refType: "MP_PAYMENT" },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          amount: true, // créditos comprados
          refId: true,  // paymentId de MP
          metadata: true,
          wallet: {
            select: {
              user: { select: { id: true, email: true, name: true } },
            },
          },
        },
      }),
      prisma.creditEntry.count({
        where: { type: "PURCHASE", refType: "MP_PAYMENT" },
      }),
    ]);

    const purchases = items.map((e) => ({
      id: e.id,
      when: e.createdAt,
      email: e.wallet?.user?.email || null,
      name: e.wallet?.user?.name || null,
      credits: e.amount,
      paymentId: e.refId,
      ars: e.metadata?.amountArs ?? null,
      status: e.metadata?.status ?? null,
    }));

    return res.json({ page, pageSize, total, purchases });
  } catch (err) {
    console.error("ADMIN purchases error:", err);
    return res.status(500).json({ error: "Error cargando compras" });
  }
});

// =====================
// GEMINI
// =====================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_TEXT = "gemini-flash-latest";
const MODEL_IMAGE = "gemini-2.5-flash-image";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB por archivo (ajustable)
});

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

async function retry(fn, { attempts = 2, delayMs = 800 } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastErr = err;
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}


function fallbackOptions(lang) {
  switch (lang) {
    case "en":
      return [
        "Industrial loft with concrete walls",
        "Outdoor rooftop at sunset",
        "Minimal white cyclorama studio",
        "Luxury marble interior setting",
        "Urban street background, soft daylight",
      ];
    case "pt":
      return [
        "Loft industrial com paredes de concreto",
        "Terraço ao pôr do sol",
        "Estúdio branco ciclorama minimalista",
        "Interior sofisticado com mármore",
        "Rua urbana com luz natural suave",
      ];
    case "ko":
      return [
        "콘크리트 벽의 인더스트리얼 로프트",
        "노을 지는 옥상 야외 공간",
        "미니멀 화이트 사이클로라마 스튜디오",
        "고급스러운 대리석 인테리어",
        "자연광이 부드러운 도시 거리",
      ];
    case "zh":
      return [
        "工业风混凝土墙背景",
        "日落屋顶户外场景",
        "极简白色无缝影棚",
        "大理石奢华室内空间",
        "自然光柔和的城市街景",
      ];
    case "es":
    default:
      return [
        "loft industrial con paredes de hormigón",
        "terraza urbana al atardecer",
        "estudio ciclorama blanco minimalista",
        "interior elegante con mármol",
        "calle urbana con luz natural suave",
      ];
  }
}
// =====================
// SUGGEST BACKGROUND
// =====================
app.post("/suggest-background", upload.any(), async (req, res) => {
  try {
    const { category, model_type, vibe } = req.body;
    const language = String(req.body?.language || "es").toLowerCase();

    const langLine =
      language === "en"
        ? "Write everything in English."
        : language === "pt"
        ? "Escreva tudo em português (Brasil)."
        : language === "ko"
        ? "모든 설명은 한국어로 작성하세요."
        : language === "zh"
        ? "所有描述请使用简体中文。"
        : "Escribí todo en español.";

    const front = Array.isArray(req.files)
  ? req.files.find((f) => f.fieldname === "front")
  : null;

 console.log("SUGGEST-BG FILE:", front ? {
  fieldname: front.fieldname,
  mimetype: front.mimetype,
  size: front.size,
  hasBuffer: !!front.buffer,
} : null);

    const prompt = `
${langLine}

Devolvé SOLO JSON válido:
{"option":"..."}

Tarea:
- Mirá la FOTO del producto y deducí su uso probable (ej: playa/pileta, noche/evento, gym/deporte, oficina/formal, invierno/frío, urbano casual).
- Sugerí 1 fondo/escena MUY específico para e-commerce premium.
- Debe incluir 1 detalle distintivo (ej: "arena húmeda", "luces cálidas bokeh", "ventana grande", "pared ladrillo visto").
- Máximo 10 palabras.
- Solo describí el lugar/escena, sin marcas, sin texto.
- Evitá respuestas genéricas tipo "estudio minimalista".

Contexto:
Categoría (si ayuda): ${category}
Modelo: ${model_type}
Vibe: ${vibe}
`.trim();

    // Si hay foto, la mandamos como inlineData
    const parts = front
      ? [
          { text: prompt },
          {
            inlineData: {
              mimeType: front.mimetype,
              data: front.buffer.toString("base64"),
            },
          },
        ]
      : [{ text: prompt }];

    const { status, data } = await geminiGenerate({
      model: MODEL_TEXT,
      body: { contents: [{ role: "user", parts }] },
      timeoutMs: 15000,
    });



    if (status >= 400) {
      const opts = fallbackOptions(language);
      const pick = opts[Math.floor(Math.random() * opts.length)];
      return res.json({ options: [pick] });
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
        : fallbackOptions(language)[0];

    return res.json({ options: [finalOption] });
  } catch (err) {
    console.error(err);
    try {
      const language = String(req.body?.language || "es").toLowerCase();
      const opts = fallbackOptions(language);
      const pick = opts[Math.floor(Math.random() * opts.length)];
      return res.json({ options: [pick] });
    } catch {
      return res.json({ options: ["estudio minimalista con luz suave"] });
    }
  }
});
  
// =====================
// GENERATE FACE (ROSTRO)
// =====================
app.post("/generate-face", requireAuth, async (req, res) => {
  try {
    const modelType = String(req.body?.model_type || "").trim();
    const ethnicity = String(req.body?.ethnicity || "").trim();
    const ageRange = String(req.body?.age_range || "").trim();
    const bodyType = String(req.body?.body_type || "").trim();

    if (!modelType || !ethnicity || !ageRange) {
      return res.status(400).json({ error: "Faltan datos para generar el rostro" });
    }

    const prompt = `
Retrato fotorealista tipo e-commerce, iluminación suave de estudio.
Una sola persona. Encuadre: cabeza y hombros. Fondo neutro.
Rostro nítido, sin texto, sin marcas de agua, sin logos.

Tipo de modelo: ${modelType}
Etnia: ${ethnicity}
Edad: ${ageRange}
Tipo de cuerpo: ${bodyType || "Estandar"}
`.trim();

    const { status, data } = await geminiGenerate({
      model: MODEL_IMAGE,
      body: { contents: [{ role: "user", parts: [{ text: prompt }] }] },
      timeoutMs: 60000,
    });

    if (status >= 400) {
      console.error("Gemini face error:", status, data);
      return res.status(500).json({ error: "Gemini face error" });
    }

   

    const imgB64 = extractImageBase64(data);
    if (!imgB64) return res.status(500).json({ error: "No face image returned" });

   return res.json({
  imageUrl: `data:image/png;base64,${imgB64}`,
});

  } catch (err) {
    console.error("GENERATE FACE ERROR:", err);
    return res.status(500).json({ error: "Error generando rostro" });
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
    { name: "face", maxCount: 1 },
    { name: "product_images", maxCount: 12 },
  ]),
  async (req, res) => {
    await acquireGenerationSlot();
    const mode = String(req.body?.mode || "model").toLowerCase();
    const language = String(req.body?.language || "es").toLowerCase();
    const langLine =
  language === "en"
    ? "Write everything in English."
    : language === "pt"
    ? "Escreva tudo em português (Brasil)."
    : language === "ko"
    ? "모든 설명은 한국어로 작성하세요."
    : language === "zh"
    ? "所有描述请使用简体中文。"
    : "Escribí todo en español.";
    // views para ambos modos (model y product)
    let selectedViews = {};
try {
  selectedViews = req.body?.views ? JSON.parse(String(req.body.views)) : {};
} catch (err) {
  selectedViews = {};
}

// ✅ Ajustar pant views ANTES de calcular COST (solo en modo model)
if (mode === "model") {
  const category = String(req.body?.category || "");
  const isPantsCategory =
    category === "bottom" || category === "Pantalón/Short/Pollera/Falda";

  if (!isPantsCategory) {
    selectedViews.pantFrontDetail = false;
    selectedViews.pantBackDetail = false;
    selectedViews.pantSideDetail = false;
  }
}
   const requestedKeys =
  mode === "product"
    ? ["front", "back", "left", "right"].filter((k) => !!selectedViews?.[k])
    : [
        "front",
        "back",
        "side",
        "frontDetail",
        "backDetail",
        "pantFrontDetail",
        "pantBackDetail",
        "pantSideDetail",
      ].filter((k) => !!selectedViews?.[k]);

    let COST = requestedKeys.length;

    // 🔒 FORZAR UNA SOLA VISTA
if (requestedKeys.length !== 1) {
  return res.status(400).json({
    error: "ONLY_ONE_VIEW_ALLOWED",
  });
}
    console.log("DEBUG COST", { mode, requestedKeys, COST });

    if (COST <= 0) {
      return res.status(400).json({ error: "NO_VIEWS_SELECTED" });
    }
let takeFromBonus = 0;
let takeFromPaid = 0;
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

     // ---------- COBRO (BONUS PRIMERO, LUEGO PAGO) ----------
const bonusEntries = await prisma.creditEntry.findMany({
  where: {
    walletId: wallet.id,
    refType: { startsWith: "WELCOME_BONUS" },
  },
  select: { amount: true, refType: true, metadata: true },
});

// buscar el GRANT original (tiene expiresAt)
const grant = bonusEntries.find((e) => e.refType === "WELCOME_BONUS");
const expiresAtIso = grant?.metadata?.expiresAt;
const expiresAtMs = expiresAtIso ? new Date(expiresAtIso).getTime() : null;

const bonusActive = expiresAtMs && Date.now() < expiresAtMs;

// saldo de bonus = suma de todos los entries WELCOME_BONUS* (GRANT + CONSUME + RESTORE)
const bonusBalance = bonusActive
  ? Math.max(
      0,
      bonusEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    )
  : 0;

takeFromBonus = Math.min(COST, bonusBalance);
takeFromPaid = COST - takeFromBonus;
console.log("DEBUG CHARGE SPLIT", { COST, bonusBalance, takeFromBonus, takeFromPaid });
// 1) descontar pagos (solo si hace falta)
if (takeFromPaid > 0) {
  const updated = await prisma.wallet.updateMany({
    where: { id: wallet.id, balance: { gte: takeFromPaid } },
    data: { balance: { decrement: takeFromPaid } },
  });

  if (updated.count === 0) {
    return res.status(402).json({ error: "Sin créditos suficientes" });
  }

  consumeEntry = await prisma.creditEntry.create({
    data: {
      walletId: wallet.id,
      type: "CONSUME",
      amount: -takeFromPaid,
      idempotencyKey: String(idem),
      refType: "GENERATION",
      metadata: { mode, views: selectedViews },
    },
  });
}

// 2) descontar bonus (si hace falta)  ✅ ahora afuera
if (takeFromBonus > 0) {
  await prisma.creditEntry.create({
    data: {
      walletId: wallet.id,
      type: "CONSUME",
      amount: -takeFromBonus,
      idempotencyKey: String(idem) + ":welcome",
      refType: "WELCOME_BONUS_CONSUME",
      metadata: { mode, views: selectedViews },
    },
  });
}

      // =====================
      // PRODUCT MODE (1 crédito fijo)
      // =====================
      if (mode === "product") {
        const files = req.files?.product_images || [];
        const scene = String(req.body?.scene || "").trim();
        const regenVar = String(req.body?.regen_variation || "").trim();

        if (!files.length) return res.status(400).json({ error: "Faltan fotos del producto" });
        if (!scene) return res.status(400).json({ error: "Falta escena" });

        const imagesParts = files.slice(0, 8).map((f) => ({
          inlineData: {
            mimeType: f.mimetype,
            data: f.buffer.toString("base64"),
          },
        }));

        const langLineProduct =
  language === "en"
    ? "Write the entire description in English."
    : language === "pt"
    ? "Escreva toda a descrição em português (Brasil)."
    : language === "ko"
    ? "모든 설명은 한국어로 작성하세요."
    : language === "zh"
    ? "所有描述请使用简体中文。"
    : "Escribí toda la descripción en español.";

const basePrompt = `
${langLineProduct}

FOTO DE PRODUCTO E-COMMERCE PREMIUM (FOTOREALISTA).

OBJETIVO PRINCIPAL:
Replicar EXACTAMENTE el mismo producto de las fotos de referencia.

FIDELIDAD OBLIGATORIA (NO NEGOCIABLE):
- MISMO producto (idéntico modelo).
- MISMO color (sin variaciones).
- MISMA textura/material (no “mejorar” ni “suavizar”).
- MISMO patrón/estampado/logos (si existen).
- MISMA forma/silueta/volumen.
- MISMOS detalles: costuras, cierres, botones, bordes, etiquetas, herrajes.
- NO re-diseñar. NO reinterpretar. NO estilizar diferente.

COMPOSICIÓN:
- Solo el producto (sin personas, sin manos, sin maniquí, sin perchas).
- Un solo producto (sin duplicados).
- Fondo continuo tipo estudio.
- Iluminación suave tipo estudio, sin sombras duras.

ESCENA / FONDO (sin afectar el producto):
Escena: ${scene}
`.trim();

const negativeBlock = `
PROHIBIDO:
- Cambiar color, tono o saturación del producto.
- Cambiar el material.
- Cambiar forma, proporciones o diseño.
- Quitar/agregar detalles (cierres, botones, bolsillos, costuras, etiquetas).
- Agregar texto, marca de agua, logos inventados, packaging.
- Collage, grilla, múltiples paneles, duplicados.
`.trim();
        const variationHint = regenVar
  ? `
VARIACIÓN (REHACER PRODUCTO):
- Mantener EXACTAMENTE el mismo producto (NO cambiar color, textura, forma, detalles).
- Mantener misma escena general: ${scene}.
- Cambiar NOTABLEMENTE al menos 2 cosas (sin salir de estudio e-commerce):
  1) iluminación (más suave ↔ un poco más contrastada)
  2) fondo estudio (blanco ↔ gris claro ↔ beige suave)
  3) micro-ángulo (ligero cambio de cámara, sin deformar producto)
- No repetir la imagen anterior.
- Código variación: ${regenVar}
`
  : "";

        const views = [
  { key: "front", label: "toma principal" },
  { key: "back", label: "ángulo alternativo" },
  { key: "left", label: "detalle cercano" },
  { key: "right", label: "otro ángulo" },
].filter((v) => selectedViews?.[v.key]);


        const settled = await Promise.allSettled(
          views.map((v) =>
  retry(
    async (attempt) => {
      console.log(`PRODUCT view=${v.key} attempt=${attempt}`);
              const sideHint =
  v.key === "side"
    ? `
TOMA OBLIGATORIA – COSTADO COMPLETO:

- Cuerpo completo (head-to-toe).
- Vista lateral 3/4 (no completamente de perfil).
- Modelo girada aproximadamente 45 grados.
- Piernas y pies completamente visibles.
- No recortar cabeza.
- No recortar pies.
- Cámara lo suficientemente lejos para capturar cuerpo entero.
- Formato vertical 4:5.
- Modelo centrada.

POSE:
- Postura natural, elegante.
- Una mano en bolsillo si existen.
- Hombros levemente girados hacia cámara.
`
    : "";



const viewPrompt = `
${basePrompt}
${variationHint}

Cámara: ${v.label}.
${negativeBlock}

IMPORTANTE:
- Generar UNA SOLA imagen.
- NO collage, NO cuadrícula, NO múltiples paneles, NO duplicados.
- Solo el producto (sin personas, sin manos).
- Un solo producto, centrado.
- Fondo continuo de estudio.
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

            return `data:image/png;base64,${imgB64}`;
              },
    { attempts: 2, delayMs: 900 }
  )
)
);
        
        const fulfilled = settled
  .map((r, i) => ({ r, i }))
  .filter((x) => x.r.status === "fulfilled")
  .map((x) => ({ key: views[x.i].key, url: x.r.value }));

const failed = settled
  .map((r, i) => ({ r, i }))
  .filter((x) => x.r.status === "rejected")
  .map((x) => views[x.i]?.key);

const requestedCost = views.length;
const successCost = fulfilled.length;
const refundCount = Math.max(0, requestedCost - successCost);

console.log("MODEL requested:", views.map(v => v.key));
console.log("MODEL failed:", failed);

// Si no salió ninguna, ahí sí devolvemos error (y tu catch hace refund total)
if (successCost === 0) {
  throw new Error("No se pudo generar ninguna imagen con modelo");
}

// ✅ Refund parcial (bonus primero, luego paid)
if (refundCount > 0 && wallet) {
  const refundFromBonus = Math.min(takeFromBonus, refundCount);
  const refundFromPaid = refundCount - refundFromBonus;

  if (refundFromPaid > 0) {
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: refundFromPaid } },
    });

    await prisma.creditEntry.create({
      data: {
        walletId: wallet.id,
        type: "REFUND",
        amount: refundFromPaid,
        idempotencyKey: `refund-partial:${idem}`,
        refType: "GENERATION_PARTIAL",
        refId: consumeEntry?.id || null,
        metadata: { failedViews: failed },
      },
    });
  }

  if (refundFromBonus > 0) {
    await prisma.creditEntry.create({
      data: {
        walletId: wallet.id,
        type: "GRANT",
        amount: refundFromBonus,
        idempotencyKey: `restore-partial:${idem}`,
        refType: "WELCOME_BONUS_RESTORE",
        metadata: { failedViews: failed },
      },
    });
  }
}

// ✅ Devolvemos SOLO lo que salió, con keys
return res.json({
  imageUrls: fulfilled.map(x => x.url),
  imageKeys: fulfilled.map(x => x.key),
  failedViews: failed,
  promptUsed: basePrompt,
});
      }

      // =====================
      // MODEL MODE (1 crédito por vista)
      // =====================
      if (mode === "model") {
        const regenVar = String(req.body?.regen_variation || "").trim();
        const front = req.files?.front?.[0];
        const back = req.files?.back?.[0];
        const face = req.files?.face?.[0];

        const category = String(req.body?.category || "").trim();

        if (!front) return res.status(400).json({ error: "Falta foto delantera" });

      

        const otherCategory = String(req.body?.other_category || "");
        const pockets = String(req.body?.pockets || "");
        const modelType = String(req.body?.model_type || "");
        const ethnicity = String(req.body?.ethnicity || "");
        const ageRange = String(req.body?.age_range || "");
        const background = String(req.body?.background || "");
        const pose = String(req.body?.pose || "");
        const bodyType = String(req.body?.body_type || "");

        const refParts = [];

if (face) {
  refParts.push({
    inlineData: {
      mimeType: face.mimetype,
      data: face.buffer.toString("base64"),
    },
  });
}

refParts.push({
  inlineData: {
    mimeType: front.mimetype,
    data: front.buffer.toString("base64"),
  },
});

if (back) {
  refParts.push({
    inlineData: {
      mimeType: back.mimetype,
      data: back.buffer.toString("base64"),
    },
  });
}



        const catFinal =
  (category === "other" || category === "otro") && otherCategory
    ? `Otro: ${otherCategory}`
    : category;

// ✅ 1) Auto-describir prenda desde la imagen (texto → JSON)
const garmentPrompt = `
Devolvé SOLO JSON válido con esta forma exacta:
{
  "garment_summary": "max 25 palabras",
  "must_keep": ["lista corta, max 10 items"],
  "transparency": "none|sheer|lace|mesh",
  "opening": "closed|open_front|tie_front|buttoned|zip",
  "length": "crop|waist|hip|long",
  "sleeves": "none|short|long",
  "notes": "max 25 palabras"
}

Reglas:
- Mirá la FOTO y describí la PRENDA exactamente como se ve.
- No inventes forro ni prendas interiores.
- Si es encaje/transparente, marcá transparency correctamente y agregá en must_keep: "mantener transparencia real".
`.trim();

const garmentParts = [
  { text: garmentPrompt },
  {
    inlineData: {
      mimeType: front.mimetype,
      data: front.buffer.toString("base64"),
    },
  },
];

const garmentDescResp = await geminiGenerate({
  model: MODEL_TEXT,
  body: { contents: [{ role: "user", parts: garmentParts }] },
  timeoutMs: 15000,
});

let garmentDesc = null;
try {
  const txt = garmentDescResp?.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  garmentDesc = JSON.parse(txt);
} catch {
  garmentDesc = null;
}

    
        const basePrompt = `
${langLine}

FOTO DE MODA E-COMMERCE ULTRA FIEL A REFERENCIA.

PRIORIDAD ABSOLUTA: LA PRENDA.

IMPORTANTE (LA FOTO DE REFERENCIA PUEDE ESTAR EN MANIQUÍ):
- IGNORAR el maniquí/cuerpo de referencia.
- Extraer SOLO la prenda y aplicarla a la modelo sin rediseñar.

PRENDA TRANSPARENTE / ENCAJE (CRÍTICO):
- Mantener transparencia real del encaje (se ve piel debajo).
- NO agregar forro, NO “rellenar”, NO hacerla opaca.
- NO agregar top interno debajo (no inventar remera/corpiño).
- Mantener abertura frontal (prenda abierta) y las tiras en el centro.
- Mantener los volados/ruffles del frente y el corte corto (crop).

REGLAS OBLIGATORIAS:
- Usar EXACTAMENTE la prenda de las fotos referencia.
- NO cambiar color.
- NO cambiar textura.
- NO cambiar estampado.
- NO cambiar botones.
- NO cambiar costuras.
- NO cambiar calce.
- NO agregar ni quitar detalles.
- NO reinterpretar el diseño.
- NO modificar escote, mangas ni largo.
- NO inventar bolsillos.
- NO suavizar encajes ni telas.
- NO estilizar diferente.

La prenda debe verse 100% idéntica a la foto original.

${face
  ? "Usar EXACTAMENTE el rostro de la foto de rostro como identidad fija."
  : "No es obligatorio mantener el mismo rostro entre vistas."}

Iluminación tipo estudio suave.
Sin texto.
Sin marcas de agua.
Sin logos.

Categoría: ${catFinal}
Bolsillos: ${pockets}
Tipo de modelo: ${modelType}
Etnia: ${ethnicity}
Edad: ${ageRange}
Pose: ${pose}
Tipo de cuerpo: ${bodyType}
Fondo: ${background}
${garmentDesc ? `
FICHA AUTO-DETECTADA DE PRENDA (OBLIGATORIA):
Resumen: ${garmentDesc.garment_summary}
Transparencia: ${garmentDesc.transparency}
Abertura: ${garmentDesc.opening}
Largo: ${garmentDesc.length}
Mangas: ${garmentDesc.sleeves}
MUST KEEP:
- ${Array.isArray(garmentDesc.must_keep) ? garmentDesc.must_keep.join("\n- ") : ""}
Notas: ${garmentDesc.notes}
` : ""}

`.trim();

        const views = [
  { key: "front", label: "vista frontal completa" },
  { key: "back", label: "vista trasera completa" },
  { key: "side", label: "vista costado completa (3/4, cuerpo entero)" },
  { key: "frontDetail", label: "detalle frontal plano medio (desde pecho hasta cintura)" },
  { key: "backDetail", label: "detalle espalda plano medio (desde hombros hasta cintura)" },
  { key: "pantFrontDetail", label: "detalle pantalón frente (desde cintura hasta pies)" },
  { key: "pantBackDetail", label: "detalle pantalón espalda (desde cintura hasta pies)" },
  { key: "pantSideDetail", label: "detalle pantalón costado (desde cintura hasta pies)" },




].filter((v) => selectedViews?.[v.key]);


        if (!views.length) {
          return res.status(400).json({ error: "Debes seleccionar al menos una vista" });
        }

        const settled = await Promise.allSettled(
          views.map((v) =>
  retry(async (attempt) => {
    console.log(`MODEL view=${v.key} attempt=${attempt}`);

const frontFullHint =
  v.key === "front"
    ? `
TOMA OBLIGATORIA – FRENTE COMPLETO (SIEMPRE CABEZA A PIES):

ENCUADRE:
- Cuerpo completo head-to-toe (cabeza y pies 100% visibles).
- NO recortar cabeza.
- NO recortar pies.
- Dejar aire arriba y abajo (margen visible).
- Modelo centrada.
- Formato vertical 4:5.

CÁMARA:
- Vista completamente frontal (NO 3/4, NO perfil).
- Cámara a altura del torso.
- Distancia suficiente para incluir cuerpo entero.

POSE:
- Postura natural.
- Brazos relajados.
- Manos en bolsillos si existen, sin tapar la prenda.

ILUMINACIÓN:
- Estudio blanco o gris claro.
- Luz suave y uniforme (sin sombras duras).

REGLA CRÍTICA:
- Si el encuadre no entra cabeza y pies, ALEJAR la cámara hasta que entren.
`
    : "";

const sideFullHint =
  v.key === "side"
    ? `
TOMA OBLIGATORIA – COSTADO COMPLETO (3/4) – SIEMPRE CABEZA A PIES:

ENCUADRE:
- Cuerpo completo head-to-toe (cabeza y pies 100% visibles).
- NO recortar cabeza.
- NO recortar pies.
- Dejar aire arriba y abajo (margen visible).
- Formato vertical 4:5.
- Modelo centrada.

ÁNGULO:
- Vista lateral 3/4 (NO completamente de perfil).
- Modelo girada aproximadamente 45 grados.
- Hombros levemente hacia cámara.

POSE:
- Postura natural.
- Peso en una pierna.
- Una mano en bolsillo si existen (sin tapar prenda).
- Brazos relajados.

ILUMINACIÓN:
- Estudio blanco o gris claro.
- Luz suave y uniforme.

REGLA CRÍTICA:
- Si no entra cabeza y pies, ALEJAR cámara hasta que entren.
`
    : "";

const backFullHint =
  v.key === "back"
    ? `
TOMA OBLIGATORIA – ESPALDA COMPLETA (SIEMPRE CABEZA A PIES):

ENCUADRE:
- Dejar aire arriba y abajo (margen visible).
- NO recortar cabeza.
- NO recortar pies.
- Modelo centrada.
- Formato vertical 4:5.

CÁMARA:
- Vista completamente trasera (espalda directa).
- NO 3/4.
- NO perfil.
- La cara NO debe verse (o solo mínimamente de lado si es inevitable).
- Distancia suficiente para incluir cuerpo entero.

POSE:
- Postura natural.
- Brazos relajados a los lados (no tapar la espalda de la prenda).
- Pies apoyados, cuerpo derecho.

ILUMINACIÓN:
- Estudio blanco o gris claro.
- Luz suave y uniforme.

REGLA CRÍTICA:
- Si el encuadre no entra cabeza y pies, ALEJAR la cámara hasta que entren.
`
    : "";


const extraBackHint =
  v.key === "back" && !back
    ? "\nLa vista trasera debe ser coherente con la delantera. Inferí la espalda basándote en la imagen frontal sin inventar cambios drásticos."
    : "";

const sideHint =
  v.key === "side"
    ? `
TOMA OBLIGATORIA – COSTADO COMPLETO:
- Cuerpo completo (cabeza y pies visibles), sin recortes.
- Vista lateral 3/4 (NO completamente de perfil).
- Modelo girada ~45 grados.
- Formato vertical 4:5.
- Modelo centrada.
`
    : "";


const detailHint =
  v.key === "frontDetail"
    ? `
TOMA OBLIGATORIA – DETALLE FRENTE (DESDE CINTURA HACIA ARRIBA):

ENCUADRE:
- Desde la cintura hacia arriba.
- Cabeza completamente visible.
- NO cortar cabeza.
- NO mostrar cuerpo completo.
- NO mostrar piernas completas.
- Encuadre vertical 4:5.
- Modelo centrada.

CÁMARA:
- Vista frontal directa.
- Cámara a altura del pecho.
- Distancia suficiente para incluir cabeza completa.

FOCO:
- Enfatizar textura, caída y costuras.
- Mostrar claramente el escote y parte superior.
- Mantener misma modelo y mismo rostro.

ILUMINACIÓN:
- Estudio blanco o gris claro.
- Luz suave uniforme.
`
    : "";

const backDetailHint =
  v.key === "backDetail"
    ? `
TOMA OBLIGATORIA – DETALLE ESPALDA (DESDE CINTURA HASTA CABEZA):

ENCUADRE:
- Desde la cintura hacia arriba.
- Cabeza completamente visible.
- NO cortar cabeza.
- NO mostrar cuerpo completo.
- NO mostrar piernas completas.
- Encuadre vertical 4:5.
- Modelo centrada.

ÁNGULO:
- Vista de espaldas (espalda hacia cámara).
- NO frontal.
- NO mostrar el frente de la prenda.
- Puede ser levemente 3/4 pero la ESPALDA debe dominar (como foto de referencia).

FOCO:
- Mostrar claramente espalda de la prenda: tiras, nudo/cierre, costuras y caída.
- Mantener misma modelo y mismo rostro (consistencia).

ILUMINACIÓN:
- Estudio blanco o gris claro.
- Luz suave uniforme.
`
    : "";


const pantFrontDetailHint =
  v.key === "pantFrontDetail"
    ? `
TOMA OBLIGATORIA – DETALLE PANTALÓN FRENTE:

- Encuadre desde la cintura hasta los pies.
- Vista frontal.
- NO mostrar cintura para arriba.
- NO mostrar torso superior.
- Enfocar caída de la tela y bolsillos.
- Modelo centrada.
- Fondo continuo.
- Formato vertical 4:5.
`
    : "";

const pantBackDetailHint =
  v.key === "pantBackDetail"
    ? `
TOMA OBLIGATORIA – DETALLE PANTALÓN ESPALDA:

- Encuadre desde la cintura hasta los pies.
- Vista completamente trasera.
- NO mostrar cintura para arriba.
- NO mostrar torso superior.
- Enfocar caída de la tela y parte trasera de la prenda.
- Modelo centrada.
- Fondo continuo.
- Formato vertical 4:5.
- Los pies deben verse completos.
`
    : "";

const pantSideDetailHint =
  v.key === "pantSideDetail"
    ? `
TOMA OBLIGATORIA – DETALLE PANTALÓN COSTADO:

- Encuadre desde la cintura hasta los pies.
- Vista de costado 3/4 (NO completamente de perfil).
- NO mostrar cintura para arriba.
- NO mostrar torso superior.
- Mostrar bien el lateral: costura, caída, calce y bolsillos laterales si existen.
- Modelo centrada.
- Fondo continuo.
- Formato vertical 4:5.
- Los pies deben verse completos.
`
    : "";

const variationHint = regenVar
  ? `
VARIACIÓN (REGENERAR MISMA FOTO):
REGLA #1 (CRÍTICA): el producto DEBE ser idéntico a la referencia.
PROHIBIDO cambiar: color, material, textura, forma, costuras, cierres, botones, logos, etiquetas, herrajes.

MANTENER:
- MISMO producto (idéntico modelo).
- MISMO encuadre general: producto centrado, fondo continuo.
- MISMA escena base: ${scene}

SOLO PODÉS CAMBIAR (elige 2 o 3):
1) Luz: suavidad/contraste leve, dirección ligeramente distinta (siempre estudio).
2) Fondo de estudio: blanco ↔ gris claro ↔ beige suave (sin texturas ni props).
3) Micro-ángulo: rotación leve o altura de cámara mínima (sin deformación, sin perspectiva extrema).

IMPORTANTE:
- NO agregar objetos, props ni contexto.
- NO generar collage ni duplicados.
- Debe verse como otra toma del MISMO producto, no otro producto.
- Código variación: ${regenVar}
`
  : "";

const viewPrompt = `
${basePrompt}

Cámara: ${v.label}.
${frontFullHint}
${backFullHint}
${sideFullHint}
${extraBackHint}
${sideHint}
${detailHint}
${backDetailHint}
${pantFrontDetailHint}
${pantBackDetailHint}
${pantSideDetailHint}

SALIDA:
- Devolvé una IMAGEN (no texto).
- No describas. No expliques. No devuelvas JSON.

IMPORTANTE:
- Generar UNA SOLA imagen.
- NO collage, NO cuadrícula, NO múltiples paneles, NO duplicados.
- Un solo cuerpo completo, centrado.
- Fondo continuo (sin cortes).

SALIDA OBLIGATORIA:
- Generar únicamente una imagen.
- No escribir texto.
- No describir la imagen.
- No devolver explicación.
`.trim();

            // ✅ AUTO-CROP PRENDA (TOP) DESDE LA FOTO FRONT usando sharp + bbox de Gemini
const frontBuf = front.buffer;

// 1) Pedimos a Gemini (texto) un bounding box normalizado del TOP/prenda principal
const bboxPrompt = `
Devolvé SOLO JSON válido:
{"x":0.0,"y":0.0,"w":1.0,"h":1.0}

Reglas:
- Es un bounding box alrededor de la PRENDA (top) únicamente.
- Excluir fondo, maniquí/soporte, cuello de maniquí, etc.
- Coordenadas normalizadas 0..1 respecto a la imagen.
- Si hay dudas, incluir toda la prenda (mejor grande que chico).
`.trim();

const bboxResp = await geminiGenerate({
  model: MODEL_TEXT,
  body: {
    contents: [
      {
        role: "user",
        parts: [
          { text: bboxPrompt },
          {
            inlineData: {
              mimeType: front.mimetype,
              data: frontBuf.toString("base64"),
            },
          },
        ],
      },
    ],
  },
  timeoutMs: 15000,
});

let box = null;
try {
  const txt = bboxResp?.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = JSON.parse(txt);
  if (
    parsed &&
    Number.isFinite(parsed.x) &&
    Number.isFinite(parsed.y) &&
    Number.isFinite(parsed.w) &&
    Number.isFinite(parsed.h)
  ) {
    box = parsed;
  }
} catch {
  box = null;
}

// 2) Convertimos bbox (0..1) a pixeles y recortamos (con padding)
const meta = await (await import("sharp")).default(frontBuf).metadata();
const W = meta.width || 0;
const H = meta.height || 0;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

let left, top, width, height;

if (box && W > 0 && H > 0) {
  const pad = 0.06; // 6% padding alrededor
  const x1 = clamp(box.x - pad, 0, 1);
  const y1 = clamp(box.y - pad, 0, 1);
  const x2 = clamp(box.x + box.w + pad, 0, 1);
  const y2 = clamp(box.y + box.h + pad, 0, 1);

  left = Math.floor(x1 * W);
  top = Math.floor(y1 * H);
  width = Math.max(1, Math.floor((x2 - x1) * W));
  height = Math.max(1, Math.floor((y2 - y1) * H));

  // clamp final para no pasarnos
  width = Math.min(width, W - left);
  height = Math.min(height, H - top);
} else {
  // fallback: recorte centrado (parte superior)
  left = Math.floor(W * 0.18);
  top = Math.floor(H * 0.08);
  width = Math.floor(W * 0.64);
  height = Math.floor(H * 0.62);
}

const sharpMod = (await import("sharp")).default;
const garmentCropPng = await sharpMod(frontBuf)
  .extract({ left, top, width, height })
  .png()
  .toBuffer();

const garmentPart = {
  inlineData: {
    mimeType: "image/png",
    data: garmentCropPng.toString("base64"),
  },
};

// 3) Armamos parts: primero la PRENDA recortada (para que “atienda” eso primero)
const parts = [
  { text: "IMAGEN PRENDA (RECORTE): COPIAR ESTA PRENDA EXACTA. No inventar, no rediseñar." },
  garmentPart,
  { text: viewPrompt },
  ...refParts,
];

            const { status, data } = await geminiGenerate({
              model: MODEL_IMAGE,
              body: { contents: [{ role: "user", parts }] },
              timeoutMs: 60000,
            });
if (v.key === "front" || v.key === "frontDetail") {
  const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log("DEBUG VIEW", v.key, {
    status,
    hasB64: !!extractImageBase64(data),
    hasText: typeof txt === "string" && txt.length > 0,
    textSample: typeof txt === "string" ? txt.slice(0, 120) : null,
  });
}
            if (status >= 400) throw new Error("Gemini model error");
            console.log("MODEL RAW RESPONSE:", JSON.stringify(data).slice(0, 1000));
            const imgB64 = extractImageBase64(data);
            if (!imgB64) throw new Error("No model image returned");

           return `data:image/png;base64,${imgB64}`;
      },
      { attempts: 2, delayMs: 900 }
    )
  )
);


        const fulfilled = settled
  .map((r, i) => ({ r, i }))
  .filter((x) => x.r.status === "fulfilled")
  .map((x) => ({ key: views[x.i].key, url: x.r.value }));

const failed = settled
  .map((r, i) => ({ r, i }))
  .filter((x) => x.r.status === "rejected")
  .map((x) => views[x.i]?.key);

const requestedCost = views.length;
const successCost = fulfilled.length;
const refundCount = Math.max(0, requestedCost - successCost);

console.log("MODEL requested:", views.map((v) => v.key));
console.log("MODEL failed:", failed);

// Si no salió ninguna, ahí sí devolvemos error (y tu catch hace refund total)
if (successCost === 0) {
  throw new Error("No se pudo generar ninguna imagen con modelo");
}

// ✅ Refund parcial (bonus primero, luego paid)
if (refundCount > 0 && wallet) {
  const refundFromBonus = Math.min(takeFromBonus, refundCount);
  const refundFromPaid = refundCount - refundFromBonus;

  if (refundFromPaid > 0) {
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: refundFromPaid } },
    });

    await prisma.creditEntry.create({
      data: {
        walletId: wallet.id,
        type: "REFUND",
        amount: refundFromPaid,
        idempotencyKey: `refund-partial:${idem}`,
        refType: "GENERATION_PARTIAL",
        refId: consumeEntry?.id || null,
        metadata: { failedViews: failed },
      },
    });
  }

  if (refundFromBonus > 0) {
    await prisma.creditEntry.create({
      data: {
        walletId: wallet.id,
        type: "GRANT",
        amount: refundFromBonus,
        idempotencyKey: `restore-partial:${idem}`,
        refType: "WELCOME_BONUS_RESTORE",
        metadata: { failedViews: failed },
      },
    });
  }
}

// ✅ Devolvemos SOLO lo que salió, con keys
return res.json({
  imageUrls: fulfilled.map((x) => x.url),
  imageKeys: fulfilled.map((x) => x.key),
  failedViews: failed,
  promptUsed: basePrompt,
});
      }

      return res.status(400).json({ error: "Modo inválido" });
} catch (err) {
  console.error("GENERATE ERROR:", err);

  // REFUND (devolver pagos y bonus)
  try {
    if (wallet) {
      if (takeFromPaid > 0) {
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: takeFromPaid } },
        });

        await prisma.creditEntry.create({
          data: {
            walletId: wallet.id,
            type: "REFUND",
            amount: takeFromPaid,
            idempotencyKey: `refund:${idem}`,
            refType: "GENERATION",
            refId: consumeEntry?.id || null,
          },
        });
      }

      if (takeFromBonus > 0) {
        await prisma.creditEntry.create({
          data: {
            walletId: wallet.id,
            type: "GRANT",
            amount: takeFromBonus,
            idempotencyKey: `restore:${idem}`,
            refType: "WELCOME_BONUS_RESTORE",
          },
        });
      }
    }
  } catch (refundError) {
    console.error("REFUND FAILED:", refundError);
  }

  return res.status(500).json({
    error: "Error en generate",
    details: String(err?.message || err),
  });
} finally{
  releaseGenerationSlot();
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
  unitPrice = 75000;
} else if (credits === 100) {
  unitPrice = 150000;
} else if (credits === 200) {
  unitPrice = 300000;
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
        notification_url: `${be}/mp/webhook`,
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
    metadata: {
      status: payment?.status ?? null,
      amountArs: payment?.transaction_amount ?? null,
      currency: payment?.currency_id ?? "ARS",
      payerEmail: payment?.payer?.email ?? null,
      dateApproved: payment?.date_approved ?? null,
      creditsPurchased: credits,
    },
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
app.get("/", (req, res) => res.json({ status: "OK" }));

app.get("/admin09-test", requireAdmin09, (req, res) => {
  res.json({ ok: true, message: "Admin09 autorizado correctamente" });
});

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
