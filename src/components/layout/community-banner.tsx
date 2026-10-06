import { Instagram, MessageCircle, Users } from "lucide-react";
import { getSettings } from "@/server/settings";

/** Convite para o grupo oficial do WhatsApp e o Instagram (links configuráveis no admin) */
export async function CommunityBanner() {
  const s = await getSettings();
  return (
    <section className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
      <div className="relative overflow-hidden rounded-3xl border border-ok/20 bg-gradient-to-br from-ok/15 via-ink-850 to-ink-850 p-7 sm:p-9">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-ok/20 blur-3xl" aria-hidden />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-ok/30 bg-ok/10 px-3 py-1 text-xs font-semibold text-ok">
            <Users className="h-3.5 w-3.5" /> Comunidade oficial
          </span>
          <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">Grupo do WhatsApp</h2>
          <p className="mt-2 max-w-md text-sm text-mist-300">{s.whatsapp_group_text}</p>
          <a href={s.whatsapp_group_url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-ok px-5 text-sm font-semibold text-ink-950 hover:brightness-110">
            <MessageCircle className="h-4 w-4" /> Entrar no grupo
          </a>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-3xl border border-holo-rose/20 bg-gradient-to-br from-holo-violet/15 via-ink-850 to-holo-rose/10 p-7 sm:p-9">
        <div className="absolute -bottom-12 -right-6 h-48 w-48 rounded-full bg-holo-rose/20 blur-3xl" aria-hidden />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-holo-rose/30 bg-holo-rose/10 px-3 py-1 text-xs font-semibold text-holo-rose">
            <Instagram className="h-3.5 w-3.5" /> {s.instagram_handle}
          </span>
          <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">No Instagram</h2>
          <p className="mt-2 max-w-sm text-sm text-mist-300">Pulls, destaques da semana e os leilões mais disputados.</p>
          <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-holo px-5 text-sm font-semibold text-brand-800 hover:brightness-110">
            <Instagram className="h-4 w-4" /> Seguir no Instagram
          </a>
        </div>
      </div>
    </section>
  );
}
