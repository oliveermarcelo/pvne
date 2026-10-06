import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { adminDeleteUserAction, adminSetUserStatusAction, adminUpdateUserAction } from "@/app/actions/admin";
import { adminSellerStatusAction } from "@/app/actions/sellers";
import { SELLER_STATUS_LABELS } from "@/lib/labels";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, Select } from "@/components/forms/inputs";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Avatar, DefinitionList, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { LISTING_STATUS_LABELS, LISTING_TYPE_LABELS, USER_STATUS_LABELS } from "@/lib/labels";
import { BR_STATES } from "@/lib/utils";

export const metadata: Metadata = { title: "Usuário · Admin" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  const u = await db.user.findUnique({
    where: { id },
    include: {
      _count: { select: { cards: true, albums: true, bids: true, ordersBuying: true, ordersSelling: true, negotiationsBuying: true, negotiationsSelling: true } },
      sellerProfile: true,
      sellerApplications: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
      listings: { orderBy: { createdAt: "desc" }, take: 15, include: { card: { select: { name: true, id: true } }, auction: { select: { id: true } } } },
    },
  });
  if (!u) notFound();
  const logs = await db.auditLog.findMany({ where: { OR: [{ actorId: id }, { entityType: "user", entityId: id }] }, orderBy: { createdAt: "desc" }, take: 15 });
  const self = admin.id === u.id;

  return (
    <>
      <PageHeader
        eyebrow="Usuário"
        title={<span className="flex items-center gap-3"><Avatar name={u.name} src={u.avatarUrl} size={40} /> {u.name}</span>}
        description={<>@{u.username} · <Badge tone={u.status === "ACTIVE" ? "ok" : "bad"}>{USER_STATUS_LABELS[u.status]}</Badge></>}
        actions={
          u.status !== "DELETED" && !self && (
            <>
              {u.status === "ACTIVE" ? (
                <ConfirmButton action={adminSetUserStatusAction.bind(null, u.id, "BLOCKED")} variant="danger" question="Bloquear e encerrar sessões?" confirmText="Bloquear">Bloquear</ConfirmButton>
              ) : (
                <ConfirmButton action={adminSetUserStatusAction.bind(null, u.id, "ACTIVE")} variant="secondary" skipConfirm>Desbloquear</ConfirmButton>
              )}
              <ConfirmButton action={adminDeleteUserAction.bind(null, u.id)} variant="danger" question="Excluir? Os dados pessoais serão anonimizados e os anúncios encerrados." confirmText="Excluir definitivamente">Excluir</ConfirmButton>
            </>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="surface p-5">
            <DefinitionList
              items={[
                { label: "E-mail", value: u.email },
                { label: "Telefone", value: u.phone },
                { label: "Cidade/UF", value: u.city ? `${u.city}/${u.state ?? ""}` : null },
                { label: "Cadastro", value: formatDateTime(u.createdAt) },
                { label: "Último login", value: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—" },
                { label: "Cards / álbuns", value: `${u._count.cards} / ${u._count.albums}` },
                { label: "Lances", value: String(u._count.bids) },
                { label: "Compras / vendas", value: `${u._count.ordersBuying} / ${u._count.ordersSelling}` },
                { label: "Negociações", value: String(u._count.negotiationsBuying + u._count.negotiationsSelling) },
              ]}
            />
            <Link href={`/colecionador/${u.username}`} className="link mt-4 inline-block text-xs">Ver perfil público →</Link>
          </section>
          <section className="surface flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <h2 className="text-sm font-semibold">Vendedor: <Badge tone={u.sellerStatus === "APPROVED" ? "ok" : u.sellerStatus === "PENDING" ? "warn" : u.sellerStatus === "NONE" ? "neutral" : "bad"}>{SELLER_STATUS_LABELS[u.sellerStatus]}</Badge></h2>
              {u.sellerProfile && <p className="mt-1 text-xs text-mist-400">{u.sellerProfile.legalName} · PIX {u.sellerProfile.pixKey}</p>}
              {u.sellerApplications[0] && <Link href={`/admin/vendedores/${u.sellerApplications[0].id}`} className="link mt-1 inline-block text-xs">Ver pedido de habilitação →</Link>}
            </div>
            {u.sellerStatus === "APPROVED" && u.role !== "ADMIN" && (
              <ActionForm action={adminSellerStatusAction.bind(null, u.id, "SUSPENDED")} className="flex items-center gap-2">
                <Input name="reason" placeholder="Motivo da suspensão" className="w-56" />
                <SubmitButton variant="danger" size="sm">Suspender vendas</SubmitButton>
              </ActionForm>
            )}
            {u.sellerStatus === "SUSPENDED" && (
              <ActionForm action={adminSellerStatusAction.bind(null, u.id, "APPROVED")}>
                <SubmitButton variant="secondary" size="sm">Reativar vendedor</SubmitButton>
              </ActionForm>
            )}
          </section>
          <section className="surface p-5">
            <h2 className="mb-3 text-sm font-semibold">Anúncios recentes</h2>
            <ul className="divide-y divide-white/5 text-sm">
              {u.listings.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={l.auction ? `/admin/leiloes/${l.auction.id}` : `/admin/cards/${l.card.id}`} className="truncate hover:text-gold-200">{l.card.name}</Link>
                  <span className="flex shrink-0 items-center gap-2 text-xs"><Badge>{LISTING_TYPE_LABELS[l.type]}</Badge><Badge tone={l.status === "ACTIVE" ? "ok" : "neutral"}>{LISTING_STATUS_LABELS[l.status]}</Badge><span className="num">{formatBRL(l.currentPriceCents)}</span></span>
                </li>
              ))}
              {u.listings.length === 0 && <li className="py-2 text-mist-500">Nenhum anúncio.</li>}
            </ul>
          </section>
          <section className="surface p-5">
            <h2 className="mb-3 text-sm font-semibold">Atividade (auditoria)</h2>
            <ul className="space-y-1.5 text-xs">
              {logs.map((l) => <li key={l.id} className="flex justify-between gap-3"><code className="text-mist-300">{l.action}</code><span className="text-mist-500">{formatDateTime(l.createdAt)}{l.ip ? ` · ${l.ip}` : ""}</span></li>)}
            </ul>
          </section>
        </div>
        {u.status !== "DELETED" && (
          <ActionForm action={adminUpdateUserAction.bind(null, u.id)} className="surface space-y-4 p-5 xl:self-start">
            <h2 className="text-sm font-semibold">Editar dados</h2>
            <Field name="name" label="Nome"><Input name="name" defaultValue={u.name} /></Field>
            <Field name="username" label="Usuário"><Input name="username" defaultValue={u.username} /></Field>
            <Field name="email" label="E-mail"><Input name="email" type="email" defaultValue={u.email} /></Field>
            <Field name="phone" label="Telefone"><Input name="phone" defaultValue={u.phone ?? ""} /></Field>
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <Field name="city" label="Cidade"><Input name="city" defaultValue={u.city ?? ""} /></Field>
              <Field name="state" label="UF"><Select name="state" defaultValue={u.state ?? ""}><option value="">—</option>{BR_STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            </div>
            <Field name="role" label="Papel"><Select name="role" defaultValue={u.role}><option value="USER">Colecionador</option><option value="ADMIN">Administrador</option></Select></Field>
            <SubmitButton>Salvar</SubmitButton>
          </ActionForm>
        )}
      </div>
    </>
  );
}
