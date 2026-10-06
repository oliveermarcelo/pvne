import type { Metadata } from "next";
import Link from "next/link";
import { findValidResetToken } from "@/server/modules/users";
import { resetPasswordAction } from "@/app/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/forms/inputs";
import { Alert } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await findValidResetToken(token);
  return (
    <>
      <h1 className="text-2xl font-semibold">Nova senha</h1>
      {!valid ? (
        <>
          <Alert tone="bad" className="mt-5">Este link é inválido ou expirou.</Alert>
          <p className="mt-6 text-center text-sm"><Link href="/esqueci-senha" className="link">Solicitar um novo link</Link></p>
        </>
      ) : (
        <ActionForm action={resetPasswordAction} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <Field name="password" label="Nova senha" hint="Mínimo de 8 caracteres, com letras e números."><Input name="password" type="password" autoComplete="new-password" required autoFocus /></Field>
          <Field name="passwordConfirm" label="Confirme a nova senha"><Input name="passwordConfirm" type="password" autoComplete="new-password" required /></Field>
          <SubmitButton size="lg" className="w-full" pendingText="Salvando…">Redefinir senha</SubmitButton>
        </ActionForm>
      )}
    </>
  );
}
