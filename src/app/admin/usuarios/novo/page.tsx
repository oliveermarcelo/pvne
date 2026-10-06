import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/server/auth/guards";
import { adminCreateUserAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { AdminUserFields } from "@/components/admin/user-fields";
import { PasswordFields } from "@/components/admin/password-fields";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Novo usuário · Admin" };

export default async function AdminNewUserPage() {
  await requireAdminPage();
  return (
    <>
      <Link href="/admin/usuarios" className="mb-4 inline-flex items-center gap-1.5 text-xs text-mist-400 hover:text-gold-200"><ArrowLeft className="h-3.5 w-3.5" /> Usuários</Link>
      <PageHeader eyebrow="Administração" title="Novo usuário" description="A conta já nasce ativa. Para vender, o colecionador ainda envia o pedido de habilitação (documento e PIX)." />
      <ActionForm action={adminCreateUserAction} className="grid max-w-4xl gap-6 lg:grid-cols-[1fr_340px]">
        <section className="surface p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold">Dados</h2>
          <AdminUserFields />
        </section>
        <section className="surface space-y-5 p-5 sm:p-6 lg:self-start">
          <div>
            <h2 className="text-sm font-semibold">Senha de acesso</h2>
            <p className="mt-1 text-xs text-mist-400">Envie a senha ao usuário por um canal seguro. Ele pode trocá-la depois em Minha conta → Senha e segurança.</p>
          </div>
          <PasswordFields label="Senha" />
          <SubmitButton size="lg" className="w-full" pendingText="Criando…">Criar usuário</SubmitButton>
        </section>
      </ActionForm>
    </>
  );
}
