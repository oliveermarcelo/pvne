import nodemailer from "nodemailer";

type Mail = { to: string; subject: string; text: string; html?: string };

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/** Envia e-mail. Sem SMTP configurado, registra no log (útil em desenvolvimento). */
export async function sendMail(mail: Mail) {
  const t = getTransporter();
  if (!t) {
    console.info(`[mail] SMTP não configurado. Para: ${mail.to} | Assunto: ${mail.subject}\n${mail.text}`);
    return;
  }
  await t.sendMail({ from: process.env.SMTP_FROM ?? "PVNE Cards <nao-responda@localhost>", ...mail });
}
