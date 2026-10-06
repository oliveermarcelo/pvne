import { db } from "../db";
import { audit } from "../audit";
import { NotFoundError } from "../errors";
import { sendMail } from "../mail";
import { rateLimit } from "../rate-limit";
import { optText, parse, text, z } from "../validation";
import { notify } from "./notifications";

export const contactSchema = z.object({
  type: z.enum(["CONTACT", "SUGGESTION", "COMPLAINT"]).default("CONTACT"),
  name: text(2, 80, "Nome"),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.string().email("E-mail inválido.").max(160)),
  whatsapp: optText(20, "WhatsApp"),
  subject: text(3, 120, "Assunto"),
  message: text(10, 5000, "Mensagem"),
});

export async function createContact(input: unknown, userId: string | null, ip: string | null) {
  rateLimit(`contact:${ip}`, 5, 10 * 60_000);
  const data = parse(contactSchema, input);
  const row = await db.contactMessage.create({ data: { ...data, userId } });
  await audit(db, { actorId: userId, action: "contact.created", entityType: "contact", entityId: row.id, data: { type: data.type }, ip });
  return row;
}

const updateSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "ANSWERED", "CLOSED"]),
  adminResponse: optText(5000, "Resposta"),
  sendEmail: z.preprocess((v) => v === "on", z.boolean()),
});

export async function adminUpdateContact(adminId: string, id: string, input: unknown, ip: string | null) {
  const data = parse(updateSchema, input);
  const c = await db.contactMessage.findUnique({ where: { id } });
  if (!c) throw new NotFoundError("Solicitação");
  const answeredNow = !!data.adminResponse && data.adminResponse !== c.adminResponse;
  const status = answeredNow && data.status === "OPEN" ? "ANSWERED" : data.status;
  await db.contactMessage.update({
    where: { id },
    data: {
      status,
      adminResponse: data.adminResponse ?? null,
      ...(answeredNow ? { respondedAt: new Date(), respondedById: adminId } : {}),
    },
  });
  if (answeredNow) {
    if (c.userId) {
      await notify(db, {
        userId: c.userId,
        type: "CONTACT_ANSWERED",
        title: `Resposta à sua solicitação: ${c.subject}`,
        body: data.adminResponse!.slice(0, 200),
        link: "/conta/notificacoes",
      });
    }
    if (data.sendEmail) {
      await sendMail({
        to: c.email,
        subject: `Re: ${c.subject} — PVNE Cards`,
        text: `Olá, ${c.name}!\n\n${data.adminResponse}\n\n— Equipe PVNE Cards`,
      }).catch((e) => console.error("[contact] e-mail", e));
    }
  }
  await audit(db, { actorId: adminId, action: "admin.contact_updated", entityType: "contact", entityId: id, data: { status, answered: answeredNow }, ip });
}
