import type { Metadata } from "next";
import { Instagram, Lightbulb, Mail, MessageCircle, MessageSquareWarning } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getSettings } from "@/server/settings";
import { db } from "@/server/db";
import { contactAction } from "@/app/actions/contact";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, Textarea } from "@/components/forms/inputs";
import { PageHeader, Tabs } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Contato" };
export const dynamic = "force-dynamic";

const TYPES = {
  contato: { value: "CONTACT", label: "Contato", title: "Fale com a gente", desc: "Dúvidas, parcerias ou qualquer assunto sobre a plataforma." },
  sugestao: { value: "SUGGESTION", label: "Sugestões", title: "Envie uma sugestão", desc: "Tem uma ideia para melhorar a PVNE? Queremos ouvir." },
  reclamacao: { value: "COMPLAINT", label: "Reclamações", title: "Registre uma reclamação", desc: "Problemas com uma negociação, anúncio ou usuário? Conte o que aconteceu — nossa equipe analisa cada caso." },
} as const;

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const sp = await searchParams;
  const key = (sp.tipo && sp.tipo in TYPES ? sp.tipo : "contato") as keyof typeof TYPES;
  const t = TYPES[key];
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const full = user ? await db.user.findUnique({ where: { id: user.id }, select: { phone: true } }) : null;

  return (
    <div className="container py-12">
      <PageHeader eyebrow="Atendimento" title={t.title} description={t.desc} />
      <Tabs active={key} items={Object.entries(TYPES).map(([k, v]) => ({ key: k, label: v.label, href: `/contato?tipo=${k}` }))} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
        <div className="surface p-6 sm:p-8">
          <ActionForm key={key} action={contactAction} resetOnSuccess className="space-y-4">
            <input type="hidden" name="type" value={t.value} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="name" label="Nome" required><Input name="name" defaultValue={user?.name} required /></Field>
              <Field name="email" label="E-mail" required><Input name="email" type="email" defaultValue={user?.email} required /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="whatsapp" label="WhatsApp"><Input name="whatsapp" type="tel" defaultValue={full?.phone ?? ""} placeholder="(11) 99999-9999" /></Field>
              <Field name="subject" label="Assunto" required><Input name="subject" required /></Field>
            </div>
            <Field name="message" label="Mensagem" required>
              <Textarea name="message" rows={7} required placeholder={key === "reclamacao" ? "Descreva o ocorrido, com links do card/negociação e usuários envolvidos." : ""} />
            </Field>
            <SubmitButton size="lg" pendingText="Enviando…">Enviar {t.label === "Contato" ? "mensagem" : t.label.toLowerCase().replace(/s$/, "")}</SubmitButton>
          </ActionForm>
        </div>
        <aside className="space-y-4">
          <a href={settings.whatsapp_group_url} target="_blank" rel="noopener noreferrer" className="surface flex items-center gap-4 p-5 transition hover:border-ok/30">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-ok/15 text-ok"><MessageCircle className="h-5 w-5" /></span>
            <span><b className="block text-sm">Grupo do WhatsApp</b><span className="text-xs text-mist-400">Entrar no grupo</span></span>
          </a>
          <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="surface flex items-center gap-4 p-5 transition hover:border-holo-rose/30">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-holo-rose/15 text-holo-rose"><Instagram className="h-5 w-5" /></span>
            <span><b className="block text-sm">Instagram {settings.instagram_handle}</b><span className="text-xs text-mist-400">Seguir no Instagram</span></span>
          </a>
          <div className="surface flex items-center gap-4 p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold-400/15 text-gold-300"><Mail className="h-5 w-5" /></span>
            <span><b className="block text-sm">E-mail</b><span className="text-xs text-mist-400">{settings.contact_email}</span></span>
          </div>
          <div className="surface-2 space-y-3 p-5 text-xs text-mist-400">
            <p className="flex gap-2"><Lightbulb className="h-4 w-4 shrink-0 text-gold-300" /> Sugestões são avaliadas pela equipe e ajudam a definir as próximas funcionalidades.</p>
            <p className="flex gap-2"><MessageSquareWarning className="h-4 w-4 shrink-0 text-warn" /> Reclamações recebem protocolo e acompanhamento: aberto → em análise → respondido → encerrado.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
