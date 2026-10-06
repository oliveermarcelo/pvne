import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    // No celular sobra espaço embaixo para a barra de abas (e para a barra de gestos do iPhone)
    <div className="flex min-h-screen flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
