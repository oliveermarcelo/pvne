import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSettings } from "@/server/settings";
import { PwaProvider } from "@/components/pwa/pwa-provider";

// Tudo é renderizado sob demanda (dados vivos do banco; nada é pré-gerado no build)
export const dynamic = "force-dynamic";

// Telas de abertura do app no iPhone/iPad (geradas por scripts/generate-pwa-assets.mjs)
const SPLASH: [number, number, number][] = [
  [1320, 2868, 3], [1206, 2622, 3], [1290, 2796, 3], [1179, 2556, 3], [1284, 2778, 3],
  [1170, 2532, 3], [1125, 2436, 3], [1242, 2688, 3], [828, 1792, 2], [750, 1334, 2],
  [2048, 2732, 2], [1668, 2388, 2], [1640, 2360, 2], [1620, 2160, 2],
];

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: `${s.site_name} — ${s.site_tagline}`, template: `%s · ${s.site_name}` },
    description: "Marketplace de cards colecionáveis: Pokémon, One Piece, Disney Lorcana, Magic, Yu-Gi-Oh! e mais. Venda direta, negociação e leilões.",
    applicationName: s.site_name,
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180" }],
    },
    appleWebApp: {
      capable: true,
      title: s.site_name,
      statusBarStyle: "black-translucent",
      startupImage: SPLASH.map(([w, h, d]) => ({
        url: `/pwa/splash-${w}x${h}.png`,
        media: `(device-width: ${w / d}px) and (device-height: ${h / d}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait)`,
      })),
    },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#060A26",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Ocupa a tela inteira no iPhone (notch / barra de gestos); as margens seguras são tratadas no CSS
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: extensões do navegador (ex.: LanguageTool, Grammarly) injetam
    // atributos em <html>/<body> antes do React carregar; isso não é erro do site.
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        {children}
        <PwaProvider />
      </body>
    </html>
  );
}
