import type { Metadata } from "next";
import { requireUserPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { changePasswordAction } from "@/app/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/forms/inputs";
import { PageHeader } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Senha e segurança" };
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await requireUserPage();
  const sessions = await db.session.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <>
      <PageHeader eyebrow="Conta" title="Senha e segurança" />
      <div className="grid gap-6 lg:grid-cols-2">
        <ActionForm action={changePasswordAction} resetOnSuccess className="surface space-y-4 p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Alterar senha</h2>
          <Field name="current" label="Senha atual"><Input name="current" type="password" autoComplete="current-password" /></Field>
          <Field name="password" label="Nova senha" hint="Mínimo de 8 caracteres, com letras e números."><Input name="password" type="password" autoComplete="new-password" /></Field>
          <Field name="passwordConfirm" label="Confirme a nova senha"><Input name="passwordConfirm" type="password" autoComplete="new-password" /></Field>
          <SubmitButton>Alterar senha</SubmitButton>
        </ActionForm>
        <div className="surface p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold">Sessões ativas</h2>
          <ul className="space-y-3 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="surface-2 p-3">
                <p className="truncate text-mist-200">{s.userAgent ?? "Dispositivo desconhecido"}</p>
                <p className="text-xs text-mist-500">Desde {formatDateTime(s.createdAt)}{s.ip ? ` · IP ${s.ip}` : ""}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-mist-500">Ao alterar a senha, todas as outras sessões são encerradas.</p>
        </div>
      </div>
    </>
  );
}
