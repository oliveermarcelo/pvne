/**
 * Marca d'água do hero: arte ORIGINAL com linguagem visual de anime/TCG
 * (linhas de velocidade de mangá, retícula, silhuetas de cartas e símbolos de energia genéricos).
 * Não usa personagens nem símbolos de marcas. Opcionalmente sobrepõe uma imagem enviada no admin.
 */

// Gerador pseudo-aleatório determinístico (mesmo resultado no servidor e no navegador)
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const W = 1440;
const H = 760;

const GLYPHS = {
  card: (
    <g>
      <rect x="-21" y="-29" width="42" height="58" rx="5" fill="none" strokeWidth="2" />
      <rect x="-15" y="-23" width="30" height="30" rx="3" fill="none" strokeWidth="1.5" />
      <path d="M-14 13h28M-14 19h18" strokeWidth="1.5" />
    </g>
  ),
  sparkle: <path d="M0-16C2-4 4-2 16 0 4 2 2 4 0 16-2 4-4 2-16 0-4-2-2-4 0-16Z" />,
  bolt: <path d="M4-18-10 3h9l-4 15L13-4H4l4-14Z" />,
  flame: <path d="M0-18c6 8 12 12 12 21a12 12 0 0 1-24 0c0-5 3-8 5-11 1 4 3 5 5 5-2-6 0-11 2-15Z" />,
  drop: <path d="M0-18C6-8 12-2 12 5a12 12 0 0 1-24 0c0-7 6-13 12-23Z" />,
  leaf: <path d="M-12 12C-14-4-4-14 14-14 14 4 4 14-12 12Zm0 0L6-6" />,
  swirl: <path d="M0-14a14 14 0 1 1-14 14 9 9 0 0 1 9-9 5 5 0 0 1 5 5" fill="none" strokeWidth="2.5" />,
  shard: <path d="M0-18 10 0 0 18-10 0Z" />,
};
type GlyphKey = keyof typeof GLYPHS;

export function HeroWatermark({ imageUrl }: { imageUrl?: string | null }) {
  const r = rng(20261001);
  const keys = Object.keys(GLYPHS) as GlyphKey[];

  // Símbolos espalhados, mais densos nas bordas e raros no centro do texto
  const items = Array.from({ length: 46 }, (_, i) => {
    const x = r() * W;
    const y = r() * H;
    const k = keys[Math.floor(r() * keys.length)]!;
    const scale = 0.7 + r() * 1.6;
    const rot = Math.round(r() * 360);
    const yellow = r() < 0.22;
    return { i, x, y, k, scale, rot, yellow };
  });

  // Linhas de velocidade (estilo mangá) irradiando de trás do leque de cards
  const cx = W * 0.74;
  const cy = H * 0.46;
  const rays = Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2 + r() * 0.04;
    const inner = 190 + r() * 90;
    const outer = 900;
    const spread = 0.006 + r() * 0.012;
    const p = (ang: number, rad: number) => `${(cx + Math.cos(ang) * rad).toFixed(1)},${(cy + Math.sin(ang) * rad).toFixed(1)}`;
    return `M${p(a, inner)}L${p(a - spread, outer)}L${p(a + spread, outer)}Z`;
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-[0.13] mix-blend-luminosity [mask-image:radial-gradient(ellipse_at_70%_45%,black_20%,transparent_75%)]"
        />
      )}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id="wm-halftone" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
            <circle cx="3" cy="3" r="1.4" fill="#4F7BFF" />
          </pattern>
          <radialGradient id="wm-halo" cx="0.74" cy="0.46" r="0.55">
            <stop offset="0" stopColor="#023EE6" stopOpacity="0.35" />
            <stop offset="1" stopColor="#023EE6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="wm-fade-rays" cx="0.74" cy="0.46" r="0.6">
            <stop offset="0.25" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="wm-rays-mask">
            <rect width={W} height={H} fill="url(#wm-fade-rays)" />
          </mask>
          <linearGradient id="wm-fade-left" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0.15" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id="wm-glyph-mask">
            <rect width={W} height={H} fill="url(#wm-fade-left)" />
          </mask>
          <radialGradient id="wm-dots-fade" cx="0.9" cy="0.1" r="0.7">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="wm-dots-mask">
            <rect width={W} height={H} fill="url(#wm-dots-fade)" />
          </mask>
        </defs>

        <rect width={W} height={H} fill="url(#wm-halo)" />
        <g mask="url(#wm-rays-mask)" fill="#4F7BFF" opacity="0.13">
          {rays.map((d, i) => <path key={i} d={d} />)}
        </g>
        <rect width={W} height={H} fill="url(#wm-halftone)" opacity="0.10" mask="url(#wm-dots-mask)" />
        <g mask="url(#wm-glyph-mask)" strokeLinecap="round" strokeLinejoin="round">
          {items.map((it) => (
            <g
              key={it.i}
              transform={`translate(${it.x.toFixed(1)} ${it.y.toFixed(1)}) rotate(${it.rot}) scale(${it.scale.toFixed(2)})`}
              stroke={it.yellow ? "#FBDB02" : "#6F8CFF"}
              fill={it.k === "card" || it.k === "swirl" ? "none" : it.yellow ? "#FBDB02" : "#4F7BFF"}
              opacity={it.yellow ? 0.15 : 0.11}
            >
              {GLYPHS[it.k]}
            </g>
          ))}
        </g>
      </svg>
      {/* Garante leitura do texto no lado esquerdo */}
      <div className="absolute inset-0 bg-gradient-to-r from-ink-900/70 via-ink-900/20 to-transparent" />
    </div>
  );
}
