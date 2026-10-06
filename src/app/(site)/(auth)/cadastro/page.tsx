import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { registerAction } from "@/app/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Input, Select } from "@/components/forms/inputs";
import { BR_STATES } from "@/lib/utils";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect("/conta");
  return (
    <>
      <h1 className="text-2xl font-semibold">Crie sua conta</h1>
      <p className="mt-1 text-sm text-mist-400">Monte seus álbuns, anuncie seus cards e participe dos leilões.</p>
      <ActionForm action={registerAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <Field name="name" label="Nome" required><Input name="name" autoComplete="name" required /></Field>
        <Field name="username" label="Nome de usuário" hint="Aparece no seu perfil público: letras minúsculas, números, ponto e _" required>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-mist-500">@</span>
            <Input name="username" autoComplete="username" className="pl-8" required />
          </div>
        </Field>
        <Field name="email" label="E-mail" required><Input name="email" type="email" autoComplete="email" required /></Field>
        <Field name="phone" label="Telefone / WhatsApp" hint="Uso interno da PVNE — não é exibido para outros usuários.">
          <Input name="phone" type="tel" autoComplete="tel" placeholder="(11) 99999-9999" />
        </Field>
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field name="city" label="Cidade"><Input name="city" autoComplete="address-level2" /></Field>
          <Field name="state" label="UF">
            <Select name="state" defaultValue="">
              <option value="">—</option>
              {BR_STATES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <Field name="password" label="Senha" hint="Mínimo de 8 caracteres, com letras e números." required>
          <Input name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field name="passwordConfirm" label="Confirme a senha" required>
          <Input name="passwordConfirm" type="password" autoComplete="new-password" required />
        </Field>
        <Field name="acceptTerms">
          <Checkbox name="acceptTerms" label={<>Li e aceito os <Link href="/termos" target="_blank" className="link">Termos de Uso</Link> e a <Link href="/privacidade" target="_blank" className="link">Política de Privacidade</Link>.</>} />
        </Field>
        <SubmitButton size="lg" className="w-full" pendingText="Criando conta…">Criar conta</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-mist-400">
        Já tem conta? <Link href="/entrar" className="link">Entrar</Link>
      </p>
    </>
  );
}
