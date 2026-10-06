import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { loginAction } from "@/app/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/forms/inputs";
import { Alert } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; senha?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect(sp.next?.startsWith("/") ? sp.next : "/conta");
  return (
    <>
      <h1 className="text-2xl font-semibold">Bem-vindo de volta</h1>
      <p className="mt-1 text-sm text-mist-400">Entre para dar lances, negociar e gerenciar sua coleção.</p>
      {sp.senha === "redefinida" && <Alert tone="ok" className="mt-5">Senha redefinida. Entre com a nova senha.</Alert>}
      <ActionForm action={loginAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <Field name="identifier" label="E-mail ou nome de usuário">
          <Input name="identifier" autoComplete="username" required autoFocus />
        </Field>
        <Field name="password" label="Senha">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <div className="flex justify-end">
          <Link href="/esqueci-senha" className="text-xs text-mist-400 hover:text-gold-200">Esqueci minha senha</Link>
        </div>
        <SubmitButton size="lg" className="w-full" pendingText="Entrando…">Entrar</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-mist-400">
        Novo por aqui? <Link href={`/cadastro${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="link">Crie sua conta</Link>
      </p>
    </>
  );
}
