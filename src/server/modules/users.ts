import { db } from "../db";
import { audit } from "../audit";
import { DomainError, NotFoundError } from "../errors";
import { hashPassword, verifyPassword } from "../auth/password";
import { randomToken, sha256 } from "../auth/tokens";
import { sendMail } from "../mail";
import { rateLimit } from "../rate-limit";
import { optText, optUploadUrl, parse, text, z } from "../validation";
import { BR_STATES } from "@/lib/utils";
import { maskText } from "@/lib/contact-filter";
import type { UserRole, UserStatus } from "@/generated/prisma/enums";

// ─── Schemas ──────────────────────────────────────────────────

const password = z
  .string({ required_error: "Informe a senha." })
  .min(8, "A senha deve ter ao menos 8 caracteres.")
  .max(100)
  .regex(/[A-Za-z]/, "A senha deve conter letras.")
  .regex(/\d/, "A senha deve conter números.");

const username = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z
    .string({ required_error: "Informe o nome de usuário." })
    .min(3, "O nome de usuário deve ter ao menos 3 caracteres.")
    .max(24, "O nome de usuário deve ter no máximo 24 caracteres.")
    .regex(/^[a-z0-9_.]+$/, "Use apenas letras minúsculas, números, ponto e sublinhado."),
);

const email = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.string({ required_error: "Informe o e-mail." }).email("E-mail inválido.").max(160),
);

const phone = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/\D/g, "") || undefined : v),
  z.string().min(10, "Telefone inválido.").max(13, "Telefone inválido.").optional(),
);

const state = z.preprocess(
  (v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : undefined),
  z.enum(BR_STATES, { errorMap: () => ({ message: "Estado inválido." }) }).optional(),
);

export const registerSchema = z
  .object({
    name: text(2, 80, "Nome"),
    username,
    email,
    phone,
    city: optText(80, "Cidade"),
    state,
    password,
    passwordConfirm: z.string(),
    acceptTerms: z.literal("on", { errorMap: () => ({ message: "É preciso aceitar os termos de uso." }) }),
  })
  .refine((d) => d.password === d.passwordConfirm, { message: "As senhas não conferem.", path: ["passwordConfirm"] });

export const profileSchema = z.object({
  name: text(2, 80, "Nome"),
  username,
  phone,
  city: optText(80, "Cidade"),
  state,
  bio: optText(500, "Bio"),
  avatarUrl: optUploadUrl,
});

type Meta = { ip: string | null; userAgent: string | null };

const RESERVED_USERNAMES = new Set(["admin", "administrador", "suporte", "pvne", "pvnecards", "sistema", "root", "conta"]);

async function assertUnique(emailValue: string | undefined, usernameValue: string | undefined, exceptId?: string) {
  if (usernameValue && RESERVED_USERNAMES.has(usernameValue)) {
    throw new DomainError("Este nome de usuário não está disponível.", "VALIDATION", { username: "Este nome de usuário não está disponível." });
  }
  const clash = await db.user.findFirst({
    where: {
      OR: [...(emailValue ? [{ email: emailValue }] : []), ...(usernameValue ? [{ username: usernameValue }] : [])],
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { email: true, username: true },
  });
  if (!clash) return;
  if (emailValue && clash.email === emailValue) {
    throw new DomainError("Este e-mail já está cadastrado.", "VALIDATION", { email: "Este e-mail já está cadastrado." });
  }
  throw new DomainError("Este nome de usuário já está em uso.", "VALIDATION", { username: "Este nome de usuário já está em uso." });
}

// ─── Conta ────────────────────────────────────────────────────

export async function registerUser(input: unknown, meta: Meta) {
  rateLimit(`register:${meta.ip}`, 10, 60 * 60_000);
  const data = parse(registerSchema, input);
  await assertUnique(data.email, data.username);
  const user = await db.user.create({
    data: {
      name: data.name,
      username: data.username,
      email: data.email,
      phone: data.phone,
      city: data.city,
      state: data.state,
      passwordHash: await hashPassword(data.password),
    },
  });
  await audit(db, { actorId: user.id, action: "user.register", entityType: "user", entityId: user.id, ip: meta.ip });
  return user;
}

// Hash fixo usado quando o usuário não existe, para o tempo de resposta não revelar contas.
const DUMMY_HASH = "$2b$12$fQfSxM11nm4txkgctuA20urpQJI9CsPlIZ/A8QU10CBbGnNIRK5Ty";

export async function authenticate(identifier: string, plain: string, meta: Meta) {
  const id = String(identifier ?? "").trim().toLowerCase();
  rateLimit(`login:${meta.ip}`, 20, 15 * 60_000);
  rateLimit(`login:${id}`, 8, 15 * 60_000);
  if (!id || !plain) throw new DomainError("Informe e-mail/usuário e senha.");

  const user = await db.user.findFirst({ where: { OR: [{ email: id }, { username: id }] } });
  const ok = await verifyPassword(String(plain), user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || user.status === "DELETED") {
    await audit(db, { actorId: user?.id, action: "auth.login_failed", data: { identifier: id }, ip: meta.ip });
    throw new DomainError("E-mail/usuário ou senha incorretos.", "INVALID_CREDENTIALS");
  }
  if (user.status === "BLOCKED") throw new DomainError("Sua conta está bloqueada. Fale com o suporte.", "BLOCKED");

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(db, { actorId: user.id, action: "auth.login", entityType: "user", entityId: user.id, ip: meta.ip });
  return user;
}

export async function updateProfile(userId: string, input: unknown) {
  const data = parse(profileSchema, input);
  await assertUnique(undefined, data.username, userId);
  return db.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      username: data.username,
      phone: data.phone ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      bio: maskText(data.bio) ?? null,
      avatarUrl: data.avatarUrl ?? null,
    },
  });
}

const changePasswordSchema = z
  .object({ current: z.string().min(1, "Informe a senha atual."), password, passwordConfirm: z.string() })
  .refine((d) => d.password === d.passwordConfirm, { message: "As senhas não conferem.", path: ["passwordConfirm"] });

export async function changePassword(userId: string, input: unknown, currentSessionId: string, meta: Meta) {
  const data = parse(changePasswordSchema, input);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(data.current, user.passwordHash))) {
    throw new DomainError("Senha atual incorreta.", "VALIDATION", { current: "Senha atual incorreta." });
  }
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(data.password) } }),
    // Encerra as outras sessões por segurança
    db.session.deleteMany({ where: { userId, id: { not: currentSessionId } } }),
  ]);
  await audit(db, { actorId: userId, action: "auth.password_changed", entityType: "user", entityId: userId, ip: meta.ip });
}

export async function requestPasswordReset(emailInput: string, meta: Meta) {
  rateLimit(`reset:${meta.ip}`, 5, 15 * 60_000);
  const parsed = email.safeParse(emailInput);
  if (!parsed.success) throw new DomainError("Informe um e-mail válido.", "VALIDATION", { email: "Informe um e-mail válido." });
  const user = await db.user.findUnique({ where: { email: parsed.data } });
  // Resposta é sempre a mesma, exista ou não a conta.
  if (!user || user.status !== "ACTIVE") return;

  const token = randomToken();
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60_000) },
  });
  const link = `${process.env.APP_URL ?? "http://localhost:3000"}/redefinir-senha/${token}`;
  await sendMail({
    to: user.email,
    subject: "Redefinição de senha — PVNE Cards",
    text: `Olá, ${user.name}!\n\nRecebemos um pedido para redefinir sua senha. Use o link abaixo (válido por 1 hora):\n\n${link}\n\nSe não foi você, ignore este e-mail.`,
  });
  await audit(db, { actorId: user.id, action: "auth.password_reset_requested", entityType: "user", entityId: user.id, ip: meta.ip });
}

const resetSchema = z
  .object({ token: z.string().min(10), password, passwordConfirm: z.string() })
  .refine((d) => d.password === d.passwordConfirm, { message: "As senhas não conferem.", path: ["passwordConfirm"] });

export async function findValidResetToken(token: string) {
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

export async function resetPassword(input: unknown, meta: Meta) {
  const data = parse(resetSchema, input);
  const row = await findValidResetToken(data.token);
  if (!row) throw new DomainError("Link inválido ou expirado. Solicite um novo.");
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(data.password) } }),
    db.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null } }),
    db.session.deleteMany({ where: { userId: row.userId } }),
  ]);
  await audit(db, { actorId: row.userId, action: "auth.password_reset", entityType: "user", entityId: row.userId, ip: meta.ip });
}

// ─── Perfil público ───────────────────────────────────────────

export async function getPublicProfile(usernameValue: string) {
  const user = await db.user.findUnique({
    where: { username: usernameValue.toLowerCase() },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      bio: true,
      city: true,
      state: true,
      createdAt: true,
      status: true,
      albums: {
        where: { status: "PUBLIC" },
        orderBy: { createdAt: "desc" },
        include: { category: true, _count: { select: { cards: { where: { status: "ACTIVE" } } } } },
      },
      _count: {
        select: {
          cards: { where: { status: "ACTIVE" } },
          ordersSelling: true,
          listings: { where: { status: "ACTIVE" } },
        },
      },
    },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return user;
}

// ─── Administração ────────────────────────────────────────────

const adminUserSchema = z.object({
  name: text(2, 80, "Nome"),
  username,
  email,
  phone,
  city: optText(80, "Cidade"),
  state,
  bio: optText(500, "Bio"),
  avatarUrl: optUploadUrl,
  role: z.enum(["USER", "ADMIN"], { errorMap: () => ({ message: "Papel inválido." }) }),
});

const adminCreateUserSchema = adminUserSchema
  .extend({ password, passwordConfirm: z.string() })
  .refine((d) => d.password === d.passwordConfirm, { message: "As senhas não conferem.", path: ["passwordConfirm"] });

const adminPasswordSchema = z
  .object({ password, passwordConfirm: z.string(), endSessions: z.literal("on").optional() })
  .refine((d) => d.password === d.passwordConfirm, { message: "As senhas não conferem.", path: ["passwordConfirm"] });

/** Administrador cria uma conta já ativa (sem passar pelo cadastro público). */
export async function adminCreateUser(adminId: string, input: unknown, ip: string | null) {
  const data = parse(adminCreateUserSchema, input);
  await assertUnique(data.email, data.username);
  const user = await db.user.create({
    data: {
      name: data.name,
      username: data.username,
      email: data.email,
      phone: data.phone ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      bio: maskText(data.bio) ?? null,
      avatarUrl: data.avatarUrl ?? null,
      role: data.role as UserRole,
      // Administradores podem vender; colecionadores passam pela habilitação de vendedor normalmente
      sellerStatus: data.role === "ADMIN" ? "APPROVED" : "NONE",
      passwordHash: await hashPassword(data.password),
    },
  });
  await audit(db, { actorId: adminId, action: "admin.user_created", entityType: "user", entityId: user.id, data: { role: data.role }, ip });
  return user;
}

export async function adminUpdateUser(adminId: string, userId: string, input: unknown, ip: string | null) {
  const data = parse(adminUserSchema, input);
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || target.status === "DELETED") throw new NotFoundError("Usuário");
  if (adminId === userId && data.role !== "ADMIN") throw new DomainError("Você não pode remover seu próprio acesso de administrador.", "VALIDATION", { role: "Você não pode remover seu próprio acesso de administrador." });
  await assertUnique(data.email, data.username, userId);
  await db.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      username: data.username,
      email: data.email,
      phone: data.phone ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      bio: maskText(data.bio) ?? null,
      avatarUrl: data.avatarUrl ?? null,
      role: data.role as UserRole,
      ...(data.role === "ADMIN" && target.sellerStatus === "NONE" ? { sellerStatus: "APPROVED" as const } : {}),
    },
  });
  const changed = (["name", "username", "email", "phone", "city", "state", "role"] as const).filter((k) => (target[k] ?? null) !== ((data as Record<string, unknown>)[k] ?? null));
  await audit(db, { actorId: adminId, action: "admin.user_updated", entityType: "user", entityId: userId, data: { changed }, ip });
}

/**
 * Administrador define uma nova senha para qualquer usuário (inclusive a própria).
 * Por padrão encerra as sessões abertas do usuário — exceto a sessão atual do próprio admin.
 */
export async function adminSetPassword(adminId: string, userId: string, input: unknown, currentSessionId: string, ip: string | null) {
  const data = parse(adminPasswordSchema, input);
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || target.status === "DELETED") throw new NotFoundError("Usuário");
  const endSessions = data.endSessions === "on";
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(data.password) } }),
    db.passwordResetToken.deleteMany({ where: { userId } }),
    ...(endSessions ? [db.session.deleteMany({ where: { userId, id: { not: currentSessionId } } })] : []),
  ]);
  await audit(db, { actorId: adminId, action: "admin.user_password_set", entityType: "user", entityId: userId, data: { endSessions }, ip });
}

export async function adminSetUserStatus(adminId: string, userId: string, status: Extract<UserStatus, "ACTIVE" | "BLOCKED">, ip: string | null) {
  if (adminId === userId) throw new DomainError("Você não pode bloquear a própria conta.");
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || target.status === "DELETED") throw new NotFoundError("Usuário");
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { status } }),
    ...(status === "BLOCKED" ? [db.session.deleteMany({ where: { userId } })] : []),
  ]);
  await audit(db, { actorId: adminId, action: status === "BLOCKED" ? "admin.user_blocked" : "admin.user_unblocked", entityType: "user", entityId: userId, ip });
}

/**
 * "Excluir" usuário = anonimizar e desativar. Lances, pedidos e negociações
 * permanecem íntegros (o histórico é imutável), mas sem dados pessoais.
 */
export async function adminDeleteUser(adminId: string, userId: string, ip: string | null) {
  if (adminId === userId) throw new DomainError("Você não pode excluir a própria conta.");
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || target.status === "DELETED") throw new NotFoundError("Usuário");

  // Encerra anúncios ativos do usuário (inclusive leilões, notificando participantes)
  const { cancelListing } = await import("./listings");
  const active = await db.listing.findMany({ where: { sellerId: userId, status: "ACTIVE" }, select: { id: true } });
  for (const l of active) await cancelListing({ id: adminId, role: "ADMIN" }, l.id, "Conta do vendedor removida.");

  const suffix = userId.slice(-8);
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: {
        name: "Usuário removido",
        username: `removido_${suffix}`,
        email: `removido+${userId}@invalid.local`,
        phone: null,
        avatarUrl: null,
        bio: null,
        city: null,
        state: null,
        status: "DELETED",
        role: "USER",
        passwordHash: await hashPassword(randomToken()),
      },
    }),
    db.session.deleteMany({ where: { userId } }),
    db.album.updateMany({ where: { ownerId: userId }, data: { status: "PRIVATE" } }),
    db.card.updateMany({ where: { ownerId: userId, status: "ACTIVE" }, data: { status: "REMOVED" } }),
  ]);
  await audit(db, { actorId: adminId, action: "admin.user_deleted", entityType: "user", entityId: userId, ip });
}
