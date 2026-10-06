import type { Metadata } from "next";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/forms/inputs";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Recuperar senha</h1>
      <p className="mt-1 text-sm text-mist-400">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
      <ActionForm action={forgotPasswordAction} className="mt-6 space-y-4">
        <Field name="email" label="E-mail"><Input name="email" type="email" autoComplete="email" required autoFocus /></Field>
        <SubmitButton size="lg" className="w-full" pendingText="Enviando…">Enviar link</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-mist-400"><Link href="/entrar" className="link">Voltar para o login</Link></p>
    </>
  );
}
