import { db } from "../db";
import { audit } from "../audit";
import { DomainError, ForbiddenError, NotFoundError } from "../errors";
import { isPrivateUrlOf } from "../storage";
import { lockRow, transaction } from "../tx";
import { optText, parse, text, z } from "../validation";
import { isValidCNPJ, isValidCPF, onlyDigits } from "@/lib/documents";
import { BR_STATES } from "@/lib/utils";
import { notify, notifyAdmins } from "./notifications";

/**
 * Habilitação de vendedores: qualquer usuário compra e dá lances, mas só anuncia
 * depois que a administração aprova o pedido (dados + documento com foto + selfie).
 */

export function canSell(u: { role: string; sellerStatus: string }) {
  return u.role === "ADMIN" || u.sellerStatus === "APPROVED";
}

export async function assertCanSell(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { role: true, sellerStatus: true, status: true } });
  if (!u || u.status !== "ACTIVE") throw new ForbiddenError("Conta inativa.");
  if (!canSell(u)) {
    const msg =
      u.sellerStatus === "PENDING"
        ? "Seu pedido para vender está em análise. Você poderá anunciar assim que for aprovado."
        : u.sellerStatus === "SUSPENDED"
          ? "Sua habilitação de vendedor está suspensa. Fale com a administração."
          : "Para anunciar é preciso ser vendedor aprovado. Envie seu pedido em “Vender na PVNE”.";
    throw new DomainError(msg, "SELLER_NOT_APPROVED");
  }
}

const digits = (v: unknown) => (typeof v === "string" ? onlyDigits(v) : v);

export const applicationSchema = z
  .object({
    personType: z.enum(["PF", "PJ"], { errorMap: () => ({ message: "Selecione pessoa física ou jurídica." }) }),
    legalName: text(3, 120, "Nome completo / razão social"),
    document: z.preprocess(digits, z.string()),
    birthDate: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").optional()),
    phone: z.preprocess(digits, z.string().min(10, "Telefone inválido.").max(13, "Telefone inválido.")),
    zip: z.preprocess(digits, z.string().length(8, "CEP inválido.")),
    street: text(3, 120, "Rua"),
    number: text(1, 20, "Número"),
    complement: optText(60, "Complemento"),
    district: text(2, 80, "Bairro"),
    city: text(2, 80, "Cidade"),
    state: z.preprocess((v) => (typeof v === "string" ? v.toUpperCase() : v), z.enum(BR_STATES, { errorMap: () => ({ message: "UF inválida." }) })),
    pixKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"], { errorMap: () => ({ message: "Selecione o tipo da chave PIX." }) }),
    pixKey: text(5, 120, "Chave PIX"),
    docFrontUrl: z.string({ required_error: "Envie a foto do documento (frente)." }).min(1, "Envie a foto do documento (frente)."),
    docBackUrl: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
    selfieUrl: z.string({ required_error: "Envie a selfie segurando o documento." }).min(1, "Envie a selfie segurando o documento."),
    notes: optText(1000, "Observações"),
    acceptTerms: z.literal("on", { errorMap: () => ({ message: "É preciso aceitar as regras para vendedores." }) }),
  })
  .superRefine((d, ctx) => {
    if (d.personType === "PF" && !isValidCPF(d.document)) ctx.addIssue({ code: "custom", path: ["document"], message: "CPF inválido." });
    if (d.personType === "PJ" && !isValidCNPJ(d.document)) ctx.addIssue({ code: "custom", path: ["document"], message: "CNPJ inválido." });
    if (d.personType === "PF") {
      if (!d.birthDate) ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Informe a data de nascimento." });
      else {
        const age = (Date.now() - new Date(d.birthDate).getTime()) / (365.25 * 86_400_000);
        if (!(age >= 18 && age < 120)) ctx.addIssue({ code: "custom", path: ["birthDate"], message: "É preciso ter 18 anos ou mais para vender." });
      }
    }
    const k = d.pixKey.trim();
    const ok =
      d.pixKeyType === "CPF" ? isValidCPF(k)
      : d.pixKeyType === "CNPJ" ? isValidCNPJ(k)
      : d.pixKeyType === "EMAIL" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k)
      : d.pixKeyType === "PHONE" ? onlyDigits(k).length >= 10 && onlyDigits(k).length <= 13
      : /^[0-9a-f-]{32,36}$/i.test(k);
    if (!ok) ctx.addIssue({ code: "custom", path: ["pixKey"], message: "Chave PIX inválida para o tipo selecionado." });
  });

export async function submitSellerApplication(userId: string, input: unknown, ip: string | null) {
  const data = parse(applicationSchema, input);
  for (const [field, url] of [["docFrontUrl", data.docFrontUrl], ["selfieUrl", data.selfieUrl], ...(data.docBackUrl ? [["docBackUrl", data.docBackUrl]] : [])] as [string, string][]) {
    if (!isPrivateUrlOf(url, "kyc", userId)) throw new DomainError("Envie as imagens pelo formulário.", "VALIDATION", { [field]: "Arquivo inválido." });
  }
  const pixKey = ["CPF", "CNPJ", "PHONE"].includes(data.pixKeyType) ? onlyDigits(data.pixKey) : data.pixKey.trim();

  return transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { sellerStatus: true, status: true, name: true, username: true } });
    if (user.status !== "ACTIVE") throw new ForbiddenError();
    if (user.sellerStatus === "APPROVED") throw new DomainError("Você já é um vendedor aprovado.");
    if (user.sellerStatus === "PENDING") throw new DomainError("Você já tem um pedido em análise.");
    if (user.sellerStatus === "SUSPENDED") throw new DomainError("Sua habilitação está suspensa. Fale com a administração.");

    const app = await tx.sellerApplication.create({
      data: {
        userId,
        personType: data.personType,
        legalName: data.legalName,
        document: data.document,
        birthDate: data.birthDate ? new Date(`${data.birthDate}T00:00:00Z`) : null,
        phone: data.phone,
        zip: data.zip,
        street: data.street,
        number: data.number,
        complement: data.complement ?? null,
        district: data.district,
        city: data.city,
        state: data.state,
        pixKeyType: data.pixKeyType,
        pixKey,
        docFrontUrl: data.docFrontUrl,
        docBackUrl: data.docBackUrl ?? null,
        selfieUrl: data.selfieUrl,
        notes: data.notes ?? null,
      },
    });
    await tx.user.update({ where: { id: userId }, data: { sellerStatus: "PENDING" } });
    await notifyAdmins(tx, { type: "SELLER_STATUS", title: `Novo pedido de vendedor: @${user.username}`, body: data.legalName, link: `/admin/vendedores/${app.id}` });
    await audit(tx, { actorId: userId, action: "seller.application_submitted", entityType: "seller_application", entityId: app.id, ip });
    return app;
  });
}

export function latestApplication(userId: string) {
  return db.sellerApplication.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
}

// ─── Administração ────────────────────────────────────────────

export async function adminReviewApplication(adminId: string, applicationId: string, decision: "approve" | "reject", reasonInput: unknown, ip: string | null) {
  const reason = typeof reasonInput === "string" ? reasonInput.trim().slice(0, 500) : "";
  if (decision === "reject" && reason.length < 5) throw new DomainError("Informe o motivo da recusa (o usuário verá essa mensagem).", "VALIDATION", { reason: "Obrigatório." });

  return transaction(async (tx) => {
    await lockRow(tx, "seller_applications", applicationId);
    const app = await tx.sellerApplication.findUniqueOrThrow({ where: { id: applicationId } });
    if (app.status !== "PENDING") throw new DomainError("Este pedido já foi analisado.");
    const now = new Date();

    if (decision === "approve") {
      await tx.sellerApplication.update({ where: { id: applicationId }, data: { status: "APPROVED", reviewedById: adminId, reviewedAt: now } });
      const profile = {
        applicationId,
        personType: app.personType,
        legalName: app.legalName,
        document: app.document,
        city: app.city,
        state: app.state,
        pixKeyType: app.pixKeyType,
        pixKey: app.pixKey,
        approvedAt: now,
      };
      await tx.sellerProfile.upsert({ where: { userId: app.userId }, create: { userId: app.userId, ...profile }, update: profile });
      await tx.user.update({ where: { id: app.userId }, data: { sellerStatus: "APPROVED" } });
      await notify(tx, {
        userId: app.userId,
        type: "SELLER_STATUS",
        title: "Você foi aprovado como vendedor!",
        body: "Já pode anunciar seus cards em venda direta, negociação ou leilão.",
        link: "/conta/cards",
      });
    } else {
      await tx.sellerApplication.update({ where: { id: applicationId }, data: { status: "REJECTED", reviewedById: adminId, reviewedAt: now, rejectionReason: reason } });
      await tx.user.update({ where: { id: app.userId }, data: { sellerStatus: "REJECTED" } });
      await notify(tx, { userId: app.userId, type: "SELLER_STATUS", title: "Seu pedido para vender não foi aprovado", body: `${reason} Você pode corrigir e enviar novamente.`, link: "/conta/vender" });
    }
    await audit(tx, { actorId: adminId, action: `admin.seller_${decision}`, entityType: "seller_application", entityId: applicationId, data: { userId: app.userId, reason: reason || null }, ip });
  });
}

/** Suspende ou reativa um vendedor. Na suspensão, anúncios sem lances são encerrados. */
export async function adminSetSellerStatus(adminId: string, userId: string, status: "SUSPENDED" | "APPROVED", reasonInput: unknown, ip: string | null) {
  const reason = typeof reasonInput === "string" && reasonInput.trim() ? reasonInput.trim().slice(0, 300) : null;
  const user = await db.user.findUnique({ where: { id: userId }, include: { sellerProfile: true } });
  if (!user) throw new NotFoundError("Usuário");
  if (status === "APPROVED" && !user.sellerProfile) throw new DomainError("Este usuário não tem dados de vendedor aprovados. Ele precisa enviar um pedido.");
  await db.user.update({ where: { id: userId }, data: { sellerStatus: status } });

  if (status === "SUSPENDED") {
    const { cancelListing } = await import("./listings");
    const active = await db.listing.findMany({ where: { sellerId: userId, status: "ACTIVE" }, include: { auction: { select: { bidCount: true } } } });
    for (const l of active) {
      if (l.auction && l.auction.bidCount > 0) continue; // leilões com lances seguem até o fim
      await cancelListing({ id: adminId, role: "ADMIN" }, l.id, reason ?? "Vendedor suspenso.");
    }
  }
  await notify(db, {
    userId,
    type: "SELLER_STATUS",
    title: status === "SUSPENDED" ? "Sua habilitação de vendedor foi suspensa" : "Sua habilitação de vendedor foi reativada",
    body: reason ?? undefined,
    link: "/conta/vender",
  });
  await audit(db, { actorId: adminId, action: status === "SUSPENDED" ? "admin.seller_suspended" : "admin.seller_reactivated", entityType: "user", entityId: userId, data: { reason }, ip });
}
