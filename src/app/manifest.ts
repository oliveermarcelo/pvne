import type { MetadataRoute } from "next";
import { loadSettings } from "@/server/settings";

// Nome do app acompanha o nome do site configurado no admin
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await loadSettings();
  return {
    id: "/",
    name: s.site_name,
    short_name: s.site_name.length > 12 ? s.site_name.split(" ")[0]! : s.site_name,
    description: `${s.site_tagline}. Compre, venda, negocie e dispute leilões de cards colecionáveis.`,
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/?origem=app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#060A26",
    theme_color: "#060A26",
    categories: ["shopping", "entertainment", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    screenshots: [
      { src: "/pwa/screenshot-mobile-1.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Marketplace de cards" },
      { src: "/pwa/screenshot-mobile-2.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Leilões ao vivo" },
      { src: "/pwa/screenshot-wide.png", sizes: "1440x900", type: "image/png", form_factor: "wide", label: "Página inicial" },
    ],
    shortcuts: [
      { name: "Marketplace", short_name: "Buscar", url: "/marketplace?origem=atalho", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Leilões ao vivo", short_name: "Leilões", url: "/leiloes?origem=atalho", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Compras e vendas", short_name: "Pedidos", url: "/conta/pedidos?origem=atalho", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Notificações", short_name: "Avisos", url: "/conta/notificacoes?origem=atalho", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
