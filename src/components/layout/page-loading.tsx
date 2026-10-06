/** Esqueleto mostrado na hora em que o usuário toca num link, enquanto a página carrega */
export function PageLoading({ inset }: { inset?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={inset ? "" : "container py-6 sm:py-10"}>
      <span className="sr-only">Carregando…</span>
      <div className="relative mb-6 h-1 overflow-hidden rounded-full bg-white/[0.04]">
        <div className="absolute inset-y-0 w-1/3 animate-[loadbar_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-brand-500 via-gold-400 to-brand-500" />
      </div>
      <div className="animate-pulse space-y-4">
        <div className="h-3 w-24 rounded bg-gold-400/20" />
        <div className="h-8 w-2/3 max-w-md rounded-lg bg-white/[0.06]" />
        <div className="grid grid-cols-2 gap-3 pt-2 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      </div>
    </div>
  );
}
