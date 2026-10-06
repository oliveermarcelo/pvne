import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { adminUpdateContactAction } from "@/app/actions/admin";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Select, Textarea } from "@/components/forms/inputs";
import { DefinitionList, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";
import { CONTACT_STATUS_LABELS, CONTACT_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Solicitação · Admin" };

export default async function AdminContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.contactMessage.findUnique({ where: { id }, include: { user: { select: { id: true, username: true } }, respondedBy: { select: { name: true } } } });
  if (!c) notFound();
  return (
    <>
      <PageHeader eyebrow={`Protocolo #${c.id.slice(-6).toUpperCase()}`} title={c.subject} description={<><Badge tone={c.type === "COMPLAINT" ? "bad" : "gold"}>{CONTACT_TYPE_LABELS[c.type]}</Badge> · recebido em {formatDateTime(c.createdAt)}</>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <section className="surface p-5">
            <DefinitionList
              items={[
                { label: "Nome", value: c.name },
                { label: "E-mail", value: <a href={`mailto:${c.email}`} className="link">{c.email}</a> },
                { label: "WhatsApp", value: c.whatsapp },
                { label: "Usuário", value: c.user ? <Link href={`/admin/usuarios/${c.user.id}`} className="link">@{c.user.username}</Link> : "Visitante" },
              ]}
            />
            <div className="mt-6 border-t border-white/5 pt-5">
              <p className="whitespace-pre-line text-sm leading-relaxed text-mist-200">{c.message}</p>
            </div>
          </section>
          {c.adminResponse && (
            <section className="surface border-ok/20 p-5">
              <p className="text-xs text-mist-500">Resposta de {c.respondedBy?.name ?? "administração"}{c.respondedAt ? ` em ${formatDateTime(c.respondedAt)}` : ""}</p>
              <p className="mt-2 whitespace-pre-line text-sm text-mist-200">{c.adminResponse}</p>
            </section>
          )}
        </div>
        <ActionForm action={adminUpdateContactAction.bind(null, c.id)} className="surface space-y-4 p-5 xl:self-start">
          <h2 className="text-sm font-semibold">Tratar solicitação</h2>
          <Field name="status" label="Status">
            <Select name="status" defaultValue={c.status}>{Object.entries(CONTACT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          </Field>
          <Field name="adminResponse" label="Resposta" hint={c.userId ? "O usuário recebe uma notificação na plataforma." : undefined}>
            <Textarea name="adminResponse" defaultValue={c.adminResponse ?? ""} rows={6} />
          </Field>
          <Checkbox name="sendEmail" label={`Enviar a resposta por e-mail para ${c.email}`} defaultChecked />
          <SubmitButton>Salvar</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
