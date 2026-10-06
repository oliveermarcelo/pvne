import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { updateProfileAction } from "@/app/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, Select, Textarea } from "@/components/forms/inputs";
import { ImageUploader } from "@/components/forms/image-uploader";
import { PageHeader } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { BR_STATES } from "@/lib/utils";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Meu perfil" };
export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const session = await requireUserPage();
  const u = await db.user.findUniqueOrThrow({ where: { id: session.id } });
  return (
    <>
      <PageHeader
        eyebrow="Conta"
        title="Perfil"
        description={`Membro desde ${formatDate(u.createdAt)} · ${u.email}`}
        actions={<LinkButton href={`/colecionador/${u.username}`} variant="secondary"><ExternalLink className="h-4 w-4" /> Ver perfil público</LinkButton>}
      />
      <ActionForm action={updateProfileAction} className="surface space-y-5 p-5 sm:p-6">
        <div className="grid gap-6 sm:grid-cols-[140px_1fr]">
          <Field name="avatarUrl" label="Foto de perfil">
            <ImageUploader name="avatarUrl" initial={u.avatarUrl ? [u.avatarUrl] : []} max={1} folder="avatars" aspect="square" />
          </Field>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="name" label="Nome" required><Input name="name" defaultValue={u.name} required /></Field>
              <Field name="username" label="Nome de usuário" required><Input name="username" defaultValue={u.username} required /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_96px]">
              <Field name="phone" label="Telefone / WhatsApp"><Input name="phone" type="tel" defaultValue={u.phone ?? ""} /></Field>
              <Field name="city" label="Cidade"><Input name="city" defaultValue={u.city ?? ""} /></Field>
              <Field name="state" label="UF">
                <Select name="state" defaultValue={u.state ?? ""}>
                  <option value="">—</option>
                  {BR_STATES.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
            <Field name="bio" label="Sobre você" hint="Aparece no seu perfil público."><Textarea name="bio" defaultValue={u.bio ?? ""} rows={3} maxLength={500} /></Field>
          </div>
        </div>
        <SubmitButton>Salvar perfil</SubmitButton>
      </ActionForm>
    </>
  );
}
