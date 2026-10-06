/**
 * Gera os ícones e as telas de abertura (splash) do app (PWA) a partir de public/logo.svg.
 *
 *   node scripts/generate-pwa-assets.mjs
 *
 * Rode de novo sempre que trocar o logo. Usa o "sharp", que já vem instalado com o Next.js.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "pwa");
const BG = "#060A26";
const LOGO_RATIO = 1443.34 / 874.25;

const logoSvg = await readFile(path.join(ROOT, "public", "logo.svg"));

/** Logo rasterizado na largura pedida */
const logo = (width) => sharp(logoSvg, { density: 600 }).resize({ width: Math.round(width) }).png().toBuffer();

/** Fundo do app: marinho com brilho azul royal e um toque de amarelo, como no site */
function background(w, h, { rounded = 0 } = {}) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <radialGradient id="a" cx="0.5" cy="0.42" r="0.62">
        <stop offset="0" stop-color="#023EE6" stop-opacity="0.55"/>
        <stop offset="0.55" stop-color="#090A75" stop-opacity="0.35"/>
        <stop offset="1" stop-color="${BG}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="b" cx="0.15" cy="0.05" r="0.5">
        <stop offset="0" stop-color="#FBDB02" stop-opacity="0.10"/>
        <stop offset="1" stop-color="#FBDB02" stop-opacity="0"/>
      </radialGradient>
      <clipPath id="c"><rect width="${w}" height="${h}" rx="${rounded}"/></clipPath>
    </defs>
    <g clip-path="url(#c)">
      <rect width="${w}" height="${h}" fill="${BG}"/>
      <rect width="${w}" height="${h}" fill="url(#a)"/>
      <rect width="${w}" height="${h}" fill="url(#b)"/>
    </g>
  </svg>`);
}

async function compose(w, h, logoWidth, { rounded = 0, offsetY = 0 } = {}) {
  const lw = Math.round(logoWidth);
  const lh = Math.round(lw / LOGO_RATIO);
  return sharp(background(w, h, { rounded }))
    .composite([{ input: await logo(lw), left: Math.round((w - lw) / 2), top: Math.round((h - lh) / 2 + offsetY) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

await mkdir(OUT, { recursive: true });
const files = [];
const save = async (name, buf) => {
  await writeFile(path.join(OUT, name), buf);
  files.push(name);
};

// Ícone padrão ("any"): quadrado cheio — o sistema aplica o próprio recorte
for (const s of [192, 512]) await save(`icon-${s}.png`, await compose(s, s, s * 0.86));
// Ícone "maskable": logo dentro da zona segura (círculo de 80%) para Android recortar em qualquer formato
await save("maskable-512.png", await compose(512, 512, 512 * 0.64));
await save("maskable-192.png", await compose(192, 192, 192 * 0.64));
// iOS (tela de início): sem transparência, senão o iPhone pinta os cantos de preto
await save("apple-touch-icon.png", await compose(180, 180, 180 * 0.84));
// Selo monocromático da notificação (Android): silhueta branca de um card com brilho
await save(
  "badge-96.png",
  await sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect x="22" y="10" width="52" height="76" rx="9" fill="none" stroke="#fff" stroke-width="8"/>
      <path d="M48 28c2 9 5 12 14 14-9 2-12 5-14 14-2-9-5-12-14-14 9-2 12-5 14-14Z" fill="#fff"/>
    </svg>`),
  )
    .png()
    .toBuffer(),
);

// Telas de abertura do iPhone (retrato). [largura, altura, dpr] em pixels físicos
export const SPLASH = [
  [1320, 2868, 3], [1206, 2622, 3], [1290, 2796, 3], [1179, 2556, 3], [1284, 2778, 3],
  [1170, 2532, 3], [1125, 2436, 3], [1242, 2688, 3], [828, 1792, 2], [750, 1334, 2],
  [2048, 2732, 2], [1668, 2388, 2], [1640, 2360, 2], [1620, 2160, 2],
];
for (const [w, h] of SPLASH) await save(`splash-${w}x${h}.png`, await compose(w, h, Math.min(w, h) * 0.52, { offsetY: -h * 0.04 }));

console.log(`Gerados ${files.length} arquivos em public/pwa/`);
