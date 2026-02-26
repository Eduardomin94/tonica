"use client";
import React, { useEffect, useMemo, useState } from "react";

const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

function fmt(d: any) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
}

export default function Admin09Page() {
  const [passInput, setPassInput] = useState("");
  const [savedPass, setSavedPass] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
const [lockedUntil, setLockedUntil] = useState<number>(0); // timestamp ms
const [nowTick, setNowTick] = useState(Date.now()); // para refrescar countdown

  useEffect(() => {
  try {
    setSavedPass(sessionStorage.getItem("admin09_pass") || "");

    const untilStr = sessionStorage.getItem("admin09_locked_until");
    const attemptsStr = sessionStorage.getItem("admin09_attempts");

    const until = untilStr ? Number(untilStr) : 0;
    const attempts = attemptsStr ? Number(attemptsStr) : 0;

    if (Number.isFinite(until) && until > Date.now()) {
      setLockedUntil(until);
      setLoginAttempts(Number.isFinite(attempts) ? attempts : 4);
      setLoginError("Demasiados intentos. Bloqueado por 10 minutos.");
    } else {
      // si ya venció, limpiamos storage
      sessionStorage.removeItem("admin09_locked_until");
      sessionStorage.removeItem("admin09_attempts");
      setLockedUntil(0);
      setLoginAttempts(0);
    }
  } catch {}
}, []);

 useEffect(() => {
  const t = setInterval(() => {
    const now = Date.now();
    setNowTick(now);

    // si venció el lock, limpiar y permitir intentar de nuevo
    setLockedUntil((prev) => {
      if (prev && now >= prev) {
        try {
          sessionStorage.removeItem("admin09_locked_until");
          sessionStorage.removeItem("admin09_attempts");
        } catch {}
        setLoginAttempts(0);
        setLoginError(null);
        return 0;
      }
      return prev;
    });
  }, 1000);

  return () => clearInterval(t);
}, []);

 const adminPass = String(savedPass || ""); // ✅ siempre string

  const headers = useMemo(() => {
  const h: Record<string, string> = {};
  if (adminPass) h["X-Admin-Password"] = adminPass;
  return h;
}, [adminPass]);


  const [payments, setPayments] = useState<any[]>([]);
const [paymentsPage, setPaymentsPage] = useState(1);
const [paymentsTotal, setPaymentsTotal] = useState(0);
const [paymentsTotalArs, setPaymentsTotalArs] = useState(0);
const PAY_PAGE_SIZE = 20;

const [payUserQ, setPayUserQ] = useState("");
const [payFrom, setPayFrom] = useState("");
const [payTo, setPayTo] = useState("");
  // ===== Tabla 1 filtros =====
  const [userQ, setUserQ] = useState("");
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState("");     // YYYY-MM-DD
  const [entries, setEntries] = useState<any[]>([]);
  const [entriesPage, setEntriesPage] = useState(1);
const [entriesTotal, setEntriesTotal] = useState(0);
const PAGE_SIZE = 20;
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
const [userMovements, setUserMovements] = useState<Record<string, any[]>>({});
const [userMovementsLoading, setUserMovementsLoading] = useState<Record<string, boolean>>({});

  // ===== Tabla 2/3 intervalos =====
  const [usersInterval, setUsersInterval] = useState<"day" | "week" | "month">("day");
  const [payInterval, setPayInterval] = useState<"day" | "week" | "month">("day");

  const [usersRows, setUsersRows] = useState<any[]>([]);
  const [payRows, setPayRows] = useState<any[]>([]);
  const [openMovements, setOpenMovements] = useState(true);
const [openUsers, setOpenUsers] = useState(false);
const [openPayments, setOpenPayments] = useState(false);
// Tabla 4: Créditos por usuario
const [openBalances, setOpenBalances] = useState(false);
const [balances, setBalances] = useState<any[]>([]);
const [balancesPage, setBalancesPage] = useState(1);
const [balancesTotal, setBalancesTotal] = useState(0);
const BAL_PAGE_SIZE = 20;
const [balUserQ, setBalUserQ] = useState("");
const [balancesLoading, setBalancesLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  async function loadEntries() {
    if (!API) return alert("Falta NEXT_PUBLIC_API_URL");
    if (!adminPass) return;

    setEntriesLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(entriesPage));
qs.set("pageSize", String(PAGE_SIZE));
      if (userQ.trim()) qs.set("user", userQ.trim());
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);

      const r = await fetch(`${API}/admin/entries?${qs.toString()}`, { headers });
const data = await r.json().catch(() => ({}));

if (!r.ok) {
  if (data?.error === "ADMIN09_UNAUTHORIZED") {
    try { sessionStorage.removeItem("admin09_pass"); } catch {}
    setSavedPass("");
    setPassInput("");
    alert("Contraseña incorrecta. Volvé a intentarlo");
    return;
  }
  throw new Error(data?.error || "Error cargando entries");
}

setEntries(Array.isArray(data?.entries) ? data.entries : []);
setEntriesTotal(Number(data?.total || 0));

      
    } catch (e: any) {
      alert(e?.message || String(e));
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  }

async function loadBalances() {
  if (!API) return alert("Falta NEXT_PUBLIC_API_URL");
  if (!adminPass) return;

  setBalancesLoading(true);
  try {
    const qs = new URLSearchParams();
    qs.set("page", String(balancesPage));
    qs.set("pageSize", String(BAL_PAGE_SIZE));
    if (balUserQ.trim()) qs.set("user", balUserQ.trim());

    const r = await fetch(`${API}/admin/user-balances?${qs.toString()}`, { headers });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Error cargando balances");

    setBalances(Array.isArray(data?.users) ? data.users : []);
    setBalancesTotal(Number(data?.total || 0));
  } catch (e: any) {
    alert(e?.message || String(e));
    setBalances([]);
    setBalancesTotal(0);
  } finally {
    setBalancesLoading(false);
  }
}

async function loadUserMovements(userId: string) {
  if (!API) return alert("Falta NEXT_PUBLIC_API_URL");
  if (!adminPass) return;

  // si ya lo estamos cargando, no repetir
  if (userMovementsLoading[userId]) return;

  setUserMovementsLoading((m) => ({ ...m, [userId]: true }));

  try {
    const r = await fetch(
      `${API}/admin/user-movements?userId=${encodeURIComponent(userId)}&page=1&pageSize=50`,
      { headers }
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Error cargando movimientos");

    setUserMovements((prev) => ({ ...prev, [userId]: Array.isArray(data?.movements) ? data.movements : [] }));
  } catch (e: any) {
    alert(e?.message || String(e));
    setUserMovements((prev) => ({ ...prev, [userId]: [] }));
  } finally {
    setUserMovementsLoading((m) => ({ ...m, [userId]: false }));
  }
}

  async function loadStats() {
    if (!API) return alert("Falta NEXT_PUBLIC_API_URL");
    if (!adminPass) return;

    setStatsLoading(true);
    try {
     const uRes = await fetch(`${API}/admin/users-stats?interval=${usersInterval}`, { headers });
const u = await uRes.json().catch(() => ({}));

if (!uRes.ok) {
  if (u?.error === "ADMIN09_UNAUTHORIZED") {
    try { sessionStorage.removeItem("admin09_pass"); } catch {}
    setSavedPass("");
    setPassInput("");
    alert("Contraseña incorrecta. Volvé a intentarlo");
    return;
  }
  throw new Error(u?.error || "Error users-stats");
}

setUsersRows(Array.isArray(u?.rows) ? u.rows : []);

// ===== Pagos como listado (NO por día) =====
const payQs = new URLSearchParams();
payQs.set("page", String(paymentsPage));
payQs.set("pageSize", String(PAY_PAGE_SIZE));
if (payUserQ.trim()) payQs.set("user", payUserQ.trim());
if (payFrom) payQs.set("from", payFrom);
if (payTo) payQs.set("to", payTo);

const pRes = await fetch(`${API}/admin/payments-stats?${payQs.toString()}`, { headers });
const p = await pRes.json().catch(() => ({}));
if (!pRes.ok) throw new Error(p?.error || "Error payments");

setPayments(Array.isArray(p?.payments) ? p.payments : []);
setPaymentsTotal(Number(p?.total || 0));
setPaymentsTotalArs(Number(p?.totalArs || 0));
    } catch (e: any) {
      alert(e?.message || String(e));
      setUsersRows([]);
      setPayRows([]);
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    if (!adminPass) return;
    loadEntries();
    loadStats();
    loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPass]);

  if (!adminPass) {
    return (
      <div style={{ maxWidth: 520, margin: "80px auto", padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ marginBottom: 8 }}>Admin 09</h1>
        <div style={{ color: "#64748b", marginBottom: 14 }}>
          Ingresá la contraseña para ver las tablas.
        </div>

        <input
          type="password"
          value={passInput}
          disabled={Date.now() < lockedUntil}
          onChange={(e) => {
  setPassInput(e.target.value);
  if (loginError) setLoginError(null);
}}
          placeholder="Contraseña"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            opacity: Date.now() < lockedUntil ? 0.6 : 1,
cursor: Date.now() < lockedUntil ? "not-allowed" : "text",
          }}
        />


        {loginError && (
  <div
    style={{
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #fecaca",
      background: "#fff1f2",
      color: "#991b1b",
      fontWeight: 900,
      fontSize: 13,
    }}
  >
    {loginError}
  </div>
)}

<div
  style={{
    marginTop: 10,
    fontSize: 12,
    fontWeight: 900,
    color: "#94a3b8",
  }}
>
  Intentos: {Math.min(loginAttempts, 4)}/4
  {Date.now() < lockedUntil ? (
    <>
      {" "}
      · Bloqueado:{" "}
      {Math.max(0, Math.ceil((lockedUntil - nowTick) / 1000))}s
    </>
  ) : null}
</div>

        <button
          onClick={async () => {
  setLoginError(null);

  // si está bloqueado, no permitir intentar
  if (Date.now() < lockedUntil) {
  // solo UI: mostramos el mensaje, pero igual podrías intentar;
  // el backend va a responder 429 si sigue bloqueado.
  setLoginError("Demasiados intentos. Bloqueado por 10 minutos.");
  // NO return
}

  const p = passInput.trim();
  if (!p) {
    setLoginError("Ingresá una contraseña");
    return;
  }

  try {
    const r = await fetch(`${API}/admin09-test`, {
      headers: { "X-Admin-Password": p },
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      setPassInput("");

      if (data?.error === "ADMIN09_LOCKED") {
        const retry = Number(data?.retryAfterSec || 600);
        const until = Date.now() + retry * 1000;

        setLockedUntil(until);
        setLoginAttempts(Number(data?.attempts || 4));
        setLoginError("Demasiados intentos. Bloqueado por 10 minutos.");

        try {
          sessionStorage.setItem("admin09_locked_until", String(until));
          sessionStorage.setItem("admin09_attempts", String(Number(data?.attempts || 4)));
        } catch {}

        return;
      }

      if (data?.error === "ADMIN09_UNAUTHORIZED") {
        setLoginAttempts(Number(data?.attempts || 1));
        setLoginError(`Contraseña incorrecta. Intento ${data?.attempts || 1}/${data?.maxAttempts || 4}`);

        try {
          sessionStorage.setItem("admin09_attempts", String(Number(data?.attempts || 1)));
        } catch {}

        return;
      }

      setLoginError("Error validando contraseña");
      return;
    }

    // ✅ éxito: limpiar lock + attempts
    setLoginAttempts(0);
    setLockedUntil(0);
    setLoginError(null);

    try {
      sessionStorage.removeItem("admin09_locked_until");
      sessionStorage.removeItem("admin09_attempts");
    } catch {}

    sessionStorage.setItem("admin09_pass", p);
    setSavedPass(p);
  } catch (e) {
    setLoginError("No se pudo validar la contraseña (error de conexión)");
  }
}}
disabled={false}
          style={{
            marginTop: 12,
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "none",
            fontWeight: 900,
            opacity: Date.now() < lockedUntil ? 0.6 : 1,
cursor: Date.now() < lockedUntil ? "not-allowed" : "pointer",
pointerEvents: Date.now() < lockedUntil ? "none" : "auto",
          }}
        >
          Entrar
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 20, fontFamily: "system-ui", color: "#0f172a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Admin 09</h1>
        <button
          onClick={() => {
            sessionStorage.removeItem("admin09_pass");
            setSavedPass("");
            setPassInput("");
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>

      {/* Tabla 1 */}
<section style={{ marginTop: 22, padding: 16, border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff" }}>
  <div
    onClick={() => setOpenMovements((v) => !v)}
    style={{
      cursor: "pointer",
      fontWeight: 900,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    }}
  >
    <span>
  1) Movimientos{" "}
  <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
    (Total: {entriesTotal})
  </span>
</span>
    <span>{openMovements ? "▲" : "▼"}</span>
  </div>

  <div
    style={{
      overflow: "hidden",
      maxHeight: openMovements ? 6000 : 0,
      opacity: openMovements ? 1 : 0,
      transition: "max-height 0.35s ease, opacity 0.25s ease",
    }}
  >
    <div style={{ paddingTop: 6 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 180px 140px", gap: 10, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Usuario (email contiene)</div>
          <input
            value={userQ}
            onChange={(e) => setUserQ(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Desde</div>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Hasta</div>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
          />
        </div>

        <button
          onClick={() => {
            setEntriesPage(1);
            setTimeout(loadEntries, 0);
          }}
          style={{ padding: 10, borderRadius: 12, border: "none", fontWeight: 900, cursor: "pointer" }}
        >
          {entriesLoading ? "Cargando..." : "Filtrar"}
        </button>
      </div>

      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#f8fafc" }}>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Fecha</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Movimiento</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Usuario</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{fmt(e.createdAt)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>
                  {e.movement} {e.mode ? `(${e.mode})` : ""}
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{e.userEmail || "—"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 900 }}>
                  {e.amount}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 12, color: "#64748b" }}>
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {(() => {
          const totalPages = Math.max(1, Math.ceil(entriesTotal / PAGE_SIZE));
          if (totalPages <= 1) return null;

          return (
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center", paddingTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setEntriesPage((p) => Math.max(1, p - 1));
                  setTimeout(loadEntries, 0);
                }}
                disabled={entriesPage <= 1}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  fontWeight: 900,
                  cursor: entriesPage <= 1 ? "not-allowed" : "pointer",
                  opacity: entriesPage <= 1 ? 0.5 : 1,
                }}
              >
                Anterior
              </button>

              <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>
                Página {entriesPage} de {totalPages}
              </div>

              <button
                type="button"
                onClick={() => {
                  setEntriesPage((p) => Math.min(totalPages, p + 1));
                  setTimeout(loadEntries, 0);
                }}
                disabled={entriesPage >= totalPages}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "#0f172a",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: entriesPage >= totalPages ? "not-allowed" : "pointer",
                  opacity: entriesPage >= totalPages ? 0.5 : 1,
                }}
              >
                Siguiente
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  </div>
</section>
{/* Tabla 2 */}
<section style={{ marginTop: 16, padding: 16, border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff" }}>
  <div
    onClick={() => setOpenUsers((v) => !v)}
    style={{
      cursor: "pointer",
      fontWeight: 900,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    }}
  >
    <span>
  2) Usuarios nuevos{" "}
  <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
    (Total: {usersRows.reduce((sum, r) => sum + Number(r.count || 0), 0)})
  </span>
</span>
    <span>{openUsers ? "▲" : "▼"}</span>
  </div>

  <div
    style={{
      overflow: "hidden",
      maxHeight: openUsers ? 3000 : 0,
      opacity: openUsers ? 1 : 0,
      transition: "max-height 0.35s ease, opacity 0.25s ease",
    }}
  >
    <div style={{ paddingTop: 6 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <select
          value={usersInterval}
          onChange={(e) => setUsersInterval(e.target.value as any)}
          style={{ padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
        >
          <option value="day">Día</option>
          <option value="week">Semana</option>
          <option value="month">Mes</option>
        </select>

        <button
          onClick={loadStats}
          style={{ padding: 10, borderRadius: 12, border: "none", fontWeight: 900, cursor: "pointer" }}
        >
          {statsLoading ? "Cargando..." : "Actualizar"}
        </button>
      </div>
<div
  style={{
    marginTop: 12,
    marginBottom: 8,
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    flexWrap: "wrap",
  }}
>
  <div style={{ fontWeight: 900, color: "#0f172a" }}>Total usuarios</div>

  <div style={{ fontSize: 26, fontWeight: 1000, color: "#0f172a", letterSpacing: -0.5 }}>
    {usersRows.reduce((sum, r) => sum + Number(r.count || 0), 0).toLocaleString("es-AR")}
  </div>

  <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
    ({usersInterval === "day" ? "por día" : usersInterval === "week" ? "por semana" : "por mes"})
  </div>
</div>
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#f8fafc" }}>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Periodo</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>Usuarios</th>
            </tr>
          </thead>
          <tbody>
            {usersRows.map((r, i) => (
              <tr key={i}>
                <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{fmt(r.bucket)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 900 }}>
                  {r.count}
                </td>
              </tr>
            ))}
            {usersRows.length === 0 && (
              <tr>
                <td colSpan={2} style={{ padding: 12, color: "#64748b" }}>
                  Sin datos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>
     {/* Tabla 3 */}
<section style={{ marginTop: 16, padding: 16, border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff" }}>
  <div
    onClick={() => setOpenPayments((v) => !v)}
    style={{
      cursor: "pointer",
      fontWeight: 900,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    }}
  >
    <span>
  3) Pagos aprobados{" "}
  <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
    (Total: {paymentsTotal})
  </span>
</span>
    <span>{openPayments ? "▲" : "▼"}</span>
  </div>

  <div
    style={{
      overflow: "hidden",
      maxHeight: openPayments ? 3000 : 0,
      opacity: openPayments ? 1 : 0,
      transition: "max-height 0.35s ease, opacity 0.25s ease",
    }}
  >
    <div style={{ paddingTop: 6 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <select
          value={payInterval}
          onChange={(e) => {
  const value = e.target.value as any;
  setPayInterval(value);

  const now = new Date();
  let start = new Date();

  if (value === "day") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (value === "week") {
    start = new Date();
    start.setDate(now.getDate() - 7);
  }

  if (value === "month") {
    start = new Date();
    start.setDate(now.getDate() - 30);
  }

  setPayFrom(start.toISOString().split("T")[0]);
  setPayTo(now.toISOString().split("T")[0]);

  setPaymentsPage(1);
  setTimeout(loadStats, 0);
}}
          style={{ padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
        >
          <option value="day">Día</option>
          <option value="week">Semana</option>
          <option value="month">Mes</option>
        </select>

        <button
          onClick={loadStats}
          style={{ padding: 10, borderRadius: 12, border: "none", fontWeight: 900, cursor: "pointer" }}
        >
          {statsLoading ? "Cargando..." : "Actualizar"}
        </button>
      </div>
<div
  style={{
    marginTop: 12,
    marginBottom: 8,
    padding: "16px 18px",
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
  }}
>
  <div>
    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>
      Total ARS
    </div>
    <div style={{ fontSize: 28, fontWeight: 1000, color: "#0f172a" }}>
      ${Number(paymentsTotalArs || 0).toLocaleString("es-AR")}
    </div>
  </div>

  <div>
    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>
      Cantidad de pagos
    </div>
    <div style={{ fontSize: 28, fontWeight: 1000, color: "#0f172a" }}>
      {paymentsTotal}
    </div>
  </div>
</div>
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
  <tr style={{ textAlign: "left", background: "#f8fafc" }}>
    <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Fecha</th>
    <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Usuario</th>
    <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>Créditos</th>
    <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>ARS</th>
    <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Payment ID</th>
  </tr>
</thead>
          <tbody>
  {payments.map((p) => (
    <tr key={p.id}>
      <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>
        {fmt(p.createdAt)}
      </td>

      <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>
        {p.email || "—"}
      </td>

      <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 900 }}>
        {p.credits}
      </td>

      <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 900 }}>
        {p.ars ?? "—"}
      </td>

      <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>
        {p.paymentId || "—"}
      </td>
    </tr>
  ))}

  {payments.length === 0 && (
    <tr>
      <td colSpan={5} style={{ padding: 12, color: "#64748b" }}>
        Sin pagos.
      </td>
    </tr>
  )}
</tbody>
        </table>
      </div>
    </div>
  </div>
</section>
{/* Tabla 4 */}
<section style={{ marginTop: 16, padding: 16, border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff" }}>
  <div
    onClick={() => setOpenBalances((v) => !v)}
    style={{
      cursor: "pointer",
      fontWeight: 900,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    }}
  >
    <span>
      4) Créditos por usuario{" "}
      <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
        (Total: {balancesTotal})
      </span>
    </span>
    <span>{openBalances ? "▲" : "▼"}</span>
  </div>

  <div
    style={{
      overflow: "hidden",
      maxHeight: openBalances ? 6000 : 0,
      opacity: openBalances ? 1 : 0,
      transition: "max-height 0.35s ease, opacity 0.25s ease",
    }}
  >
    <div style={{ paddingTop: 6 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Usuario (email o nombre)</div>
          <input
            value={balUserQ}
            onChange={(e) => setBalUserQ(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
          />
        </div>

        <button
          onClick={() => {
            setBalancesPage(1);
            setTimeout(loadBalances, 0);
          }}
          style={{ padding: 10, borderRadius: 12, border: "none", fontWeight: 900, cursor: "pointer" }}
        >
          {balancesLoading ? "Cargando..." : "Filtrar"}
        </button>
      </div>

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#f8fafc" }}>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Usuario</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Email</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>Créditos</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Alta</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((u: any) => {
  const isOpen = openUserId === u.id;
  const moves = userMovements[u.id] || [];
  const isLoading = !!userMovementsLoading[u.id];

  return (
    <React.Fragment key={u.id}>
      <tr
        onClick={() => {
          const nextOpen = isOpen ? null : u.id;
          setOpenUserId(nextOpen);

          // cargar movimientos al abrir
          if (!isOpen && !userMovements[u.id]) {
            loadUserMovements(u.id);
          }
        }}
        style={{ cursor: "pointer" }}
      >
        <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>
          {u.name || "—"} <span style={{ color: "#64748b", fontWeight: 900 }}>{isOpen ? "▲" : "▼"}</span>
        </td>
        <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{u.email || "—"}</td>
        <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 900 }}>
          {u.credits}
        </td>
        <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{fmt(u.createdAt)}</td>
      </tr>

      {isOpen && (
        <tr>
          <td colSpan={4} style={{ padding: 12, background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Movimientos</div>

            {isLoading ? (
              <div style={{ color: "#64748b", fontWeight: 800 }}>Cargando...</div>
            ) : moves.length === 0 ? (
              <div style={{ color: "#64748b", fontWeight: 800 }}>Sin movimientos.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#fff", borderRadius: 12 }}>
                  <thead>
                    <tr style={{ textAlign: "left", background: "#ffffff" }}>
                      <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Fecha</th>
                      <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Tipo</th>
                      <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Ref</th>
                      <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moves.map((m: any) => (
                      <tr key={m.id}>
                        <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{fmt(m.createdAt)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>
                          {m.type}{m.mode ? ` (${m.mode})` : ""}
                        </td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{m.refType || "—"}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 900 }}>
                          {m.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </React.Fragment>
  );
})}

            {balances.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 12, color: "#64748b" }}>
                  Sin usuarios.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {(() => {
          const totalPages = Math.max(1, Math.ceil(balancesTotal / BAL_PAGE_SIZE));
          if (totalPages <= 1) return null;

          return (
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center", paddingTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setBalancesPage((p) => Math.max(1, p - 1));
                  setTimeout(loadBalances, 0);
                }}
                disabled={balancesPage <= 1}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  fontWeight: 900,
                  cursor: balancesPage <= 1 ? "not-allowed" : "pointer",
                  opacity: balancesPage <= 1 ? 0.5 : 1,
                }}
              >
                Anterior
              </button>

              <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>
                Página {balancesPage} de {totalPages}
              </div>

              <button
                type="button"
                onClick={() => {
                  setBalancesPage((p) => Math.min(totalPages, p + 1));
                  setTimeout(loadBalances, 0);
                }}
                disabled={balancesPage >= totalPages}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "#0f172a",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: balancesPage >= totalPages ? "not-allowed" : "pointer",
                  opacity: balancesPage >= totalPages ? 0.5 : 1,
                }}
              >
                Siguiente
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  </div>
</section>
    </div>
  );
}