import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { adminReviewSellerAction } from "@/app/actions/sellers";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Textarea } from "@/components/forms/inputs";
import { Alert, DefinitionList, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatDocument, formatZip } from "@/lib/documents";
import { PIX_KEY_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Pedido de vendedor · Admin" };

export default async function AdminSellerApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await db.sellerApplication.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, username: true, email: true, phone: true, createdAt: true, _count: { select: { ordersBuying: true, cards: true } } } },
      reviewedBy: { select: { name: true } },
    },
  });
  if (!a) notFound();
  const previous = await db.sellerApplication.findMany({ where: { userId: a.userId, id: { not: a.id } }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, createdAt: true, rejectionReason: true } });
  const docs = [
    { label: "Documento — frente", url: a.docFrontUrl },
    ...(a.docBackUrl ? [{ label: "Documento — verso", url: a.docBackUrl }] : []),
    { label: "Selfie com documento", url: a.selfieUrl },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Pedido de vendedor"
        title={a.legalName}
        description={<><Link href={`/admin/usuarios/${a.user.id}`} className="link">@{a.user.username}</Link> · enviado em {formatDateTime(a.createdAt)} · <Badge tone={a.status === "PENDING" ? "warn" : a.status === "APPROVED" ? "ok" : "bad"}>{a.status === "PENDING" ? "Em análise" : a.status === "APPROVED" ? "Aprovado" : "Recusado"}</Badge></>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="surface p-5">
            <h2 className="mb-4 text-sm font-semibold">Dados informados</h2>
            <DefinitionList
              items={[
                { label: "Tipo", value: a.personType === "PF" ? "Pessoa física" : "Pessoa jurídica" },
                { label: a.personType === "PF" ? "CPF" : "CNPJ", value: <span className="font-mono">{formatDocument(a.document)}</span> },
                { label: "Nascimento", value: a.birthDate ? formatDate(a.birthDate) : "—" },
                { label: "Telefone", value: a.phone },
                { label: "E-mail da conta", value: a.user.email },
                { label: "Conta criada", value: formatDate(a.user.createdAt) },
                { label: "Endereço", value: `${a.street}, ${a.number}${a.complement ? ` — ${a.complement}` : ""}` },
                { label: "Bairro / cidade", value: `${a.district} · ${a.city}/${a.state}` },
                { label: "CEP", value: formatZip(a.zip) },
                { label: "Chave PIX", value: `${PIX_KEY_TYPE_LABELS[a.pixKeyType]}: ${a.pixKey}` },
                { label: "Compras na PVNE", value: String(a.user._count.ordersBuying) },
                { label: "Cards cadastrados", value: String(a.user._count.cards) },
              ]}
            />
            {a.notes && <p className="mt-5 border-t border-white/5 pt-4 text-sm text-mist-300">{a.notes}</p>}
          </section>
          <section className="surface p-5">
            <h2 className="mb-4 text-sm font-semibold">Documentos</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {docs.map((d) => (
                <a key={d.url} href={d.url} target="_blank" rel="noopener noreferrer" className="group block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.url} alt={d.label} className="aspect-[4/3] w-full rounded-xl border border-white/10 object-cover transition group-hover:border-gold-400/50" />
                  <p className="mt-1.5 text-xs text-mist-400">{d.label} · abrir ↗</p>
                </a>
              ))}
            </div>
            <p className="mt-4 text-xs text-mist-500">Confira se o nome e o CPF/CNPJ batem com o documento, se a selfie corresponde à foto e se a chave PIX pertence ao mesmo titular.</p>
          </section>
          {previous.length > 0 && (
            <section className="surface p-5 text-sm">
              <h2 className="mb-3 font-semibold">Pedidos anteriores</h2>
              <ul className="space-y-1.5 text-xs text-mist-400">
                {previous.map((p) => <li key={p.id}><Link href={`/admin/vendedores/${p.id}`} className="link">{formatDateTime(p.createdAt)}</Link> — {p.status}{p.rejectionReason ? `: ${p.rejectionReason}` : ""}</li>)}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-4 xl:self-start">
          {a.status === "PENDING" ? (
            <>
              <ActionForm action={adminReviewSellerAction.bind(null, a.id, "approve")} className="surface space-y-3 p-5">
                <h2 className="text-sm font-semibold">Aprovar</h2>
                <p className="text-xs text-mist-400">O usuário passa a poder anunciar; os dados de repasse (PIX) ficam salvos no perfil de vendedor.</p>
                <SubmitButton>Aprovar vendedor</SubmitButton>
              </ActionForm>
              <ActionForm action={adminReviewSellerAction.bind(null, a.id, "reject")} className="surface space-y-3 p-5">
                <h2 className="text-sm font-semibold text-bad">Recusar</h2>
                <Field name="reason" label="Motivo (enviado ao usuário)"><Textarea name="reason" rows={3} placeholder="Ex.: foto do documento ilegível; nome da chave PIX diferente do titular…" /></Field>
                <SubmitButton variant="danger">Recusar pedido</SubmitButton>
              </ActionForm>
            </>
          ) : (
            <Alert tone={a.status === "APPROVED" ? "ok" : "bad"}>
              {a.status === "APPROVED" ? "Aprovado" : "Recusado"} por {a.reviewedBy?.name ?? "—"} em {a.reviewedAt ? formatDateTime(a.reviewedAt) : "—"}.
              {a.rejectionReason && <> Motivo: {a.rejectionReason}</>}
            </Alert>
          )}
        </div>
      </div>
    </>
  );
}
