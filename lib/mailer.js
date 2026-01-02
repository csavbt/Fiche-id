import nodemailer from "nodemailer";

export function getTransport() {
  const host = (process.env.SMTP_HOST || "").trim();
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = (process.env.SMTP_SECURE || "0").toString() === "1";
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendMail({ to, subject, html, attachments }) {
  const transport = getTransport();
  if (!transport) return { ok: false, reason: "SMTP not configured" };
  const from = (process.env.MAIL_FROM || "support@groupecqfd.com").toString();
  const info = await transport.sendMail({ from, to, subject, html, attachments });
  return { ok: true, info };
}
