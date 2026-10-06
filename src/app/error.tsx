"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-mist-400">Tivemos um problema ao carregar esta página. Tente novamente.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={reset} className="h-10 rounded-xl bg-foil px-5 text-sm font-semibold text-brand-800 shadow-pop">Tentar de novo</button>
          <Link href="/" className="grid h-10 place-items-center rounded-xl px-4 text-sm text-mist-300 hover:bg-white/5">Início</Link>
        </div>
      </div>
    </div>
  );
}
