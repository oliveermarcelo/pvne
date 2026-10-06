import Link from "next/link";
import { LogoImage } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <LogoImage height={110} className="mx-auto" priority />
        <p className="mt-6 font-display text-6xl font-bold text-holo">404</p>
        <h1 className="mt-2 text-xl font-semibold">Este card não está na coleção</h1>
        <p className="mt-2 text-sm text-mist-400">A página que você procura não existe ou foi removida.</p>
        <Link href="/marketplace" className="mt-6 inline-flex h-10 items-center rounded-xl bg-foil px-5 text-sm font-semibold text-brand-800 shadow-pop">Ir para o marketplace</Link>
      </div>
    </div>
  );
}
