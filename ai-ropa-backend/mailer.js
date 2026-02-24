// mailer.js
import nodemailer from "nodemailer";

function required(name) {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`Falta ${name} en .env`);
  return v;
}

export function makeTransporter() {
  const host = required("SMTP_HOST");
  const port = Number(required("SMTP_PORT"));
  const user = required("SMTP_USER");
  const pass = required("SMTP_PASS");

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user, pass },
  });
}

export async function sendNewUserEmail({ newUser, totalUsers }) {
  const to = required("ADMIN_EMAIL");
  const from = (process.env.FROM_EMAIL || process.env.SMTP_USER || "").trim() || required("SMTP_USER");

  const transporter = makeTransporter();

  const subject = `🆕 Nuevo usuario: ${newUser.email} (Total: ${totalUsers})`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.4">
      <h2 style="margin:0 0 10px">Nuevo usuario registrado</h2>
      <p style="margin:0 0 6px"><b>Email:</b> ${escapeHtml(newUser.email)}</p>
      <p style="margin:0 0 6px"><b>Nombre:</b> ${escapeHtml(newUser.name || "-")}</p>
      <p style="margin:0 0 12px"><b>Total de usuarios:</b> ${Number(totalUsers)}</p>
      <hr />
      <p style="color:#666; font-size:12px; margin-top:12px">
        Enviado automáticamente por tu backend
      </p>
    </div>
  `;

  await transporter.sendMail({
    from,
    to,
    subject,
    html,
  });
}

// helper simple para evitar HTML roto
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}