import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";
import { CommunityBanner } from "@/components/layout/community-banner";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Quem Somos" };
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  return (
    <>
      <ContentPage
        slug="quem-somos"
        eyebrow="Institucional"
        aside={
          <div className="surface p-6">
            <p className="font-display text-lg font-semibold">Pronto para começar?</p>
            <p className="mt-1 text-sm text-mist-400">Crie sua conta, organize seus álbuns e anuncie seu primeiro card em minutos.</p>
            <div className="mt-5 grid gap-2">
              <LinkButton href="/cadastro">Criar minha conta</LinkButton>
              <LinkButton href="/marketplace" variant="outline">Explorar o marketplace</LinkButton>
            </div>
          </div>
        }
      />
      <div className="container"><CommunityBanner /></div>
    </>
  );
}
