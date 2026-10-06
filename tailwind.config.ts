import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", lg: "2rem" }, screens: { "2xl": "1320px" } },
    extend: {
      // Paleta derivada do logo: amarelo #FBDB02 / laranja #F7AC05 / azul royal #023EE6 → marinho #090A75
      colors: {
        ink: {
          950: "#03051A",
          900: "#060A26",
          850: "#0A0F33",
          800: "#0F1640",
          700: "#172052",
          600: "#232E6A",
          500: "#35428A",
        },
        mist: {
          100: "#F3F6FF",
          200: "#D4E2ED",
          300: "#A9B8DB",
          400: "#8393C0",
          500: "#5F6E9E",
        },
        // "gold" = amarelo do logo (mantido o nome para não quebrar classes)
        gold: {
          200: "#FFF3A8",
          300: "#FFE650",
          400: "#FBDB02",
          500: "#F7AC05",
          600: "#C98300",
        },
        brand: {
          200: "#BFD0FF",
          300: "#86A6FF",
          400: "#4F7BFF",
          500: "#023EE6",
          600: "#0224B8",
          700: "#021789",
          800: "#090A75",
        },
        holo: {
          violet: "#6F8CFF",
          cyan: "#3FC5FF",
          rose: "#FF6FA8",
        },
        ok: "#2FD98A",
        warn: "#FF9A3C",
        bad: "#FF5C6C",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      aspectRatio: { card: "63 / 88" },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 18px 40px -24px rgba(1,4,30,0.9)",
        glow: "0 0 0 1px rgba(251,219,2,0.35), 0 14px 40px -14px rgba(2,62,230,0.55)",
        // "extrusão" azul sob elementos amarelos, como no logo
        pop: "0 3px 0 0 #0224B8, 0 10px 26px -10px rgba(251,219,2,0.55)",
      },
      backgroundImage: {
        holo: "linear-gradient(110deg, #4F7BFF 0%, #3FC5FF 40%, #FBDB02 75%, #F7AC05 100%)",
        foil: "linear-gradient(160deg, #FFF06A 0%, #FBDB02 45%, #F7AC05 100%)",
        royal: "linear-gradient(160deg, #3D6BFF 0%, #023EE6 50%, #0224B8 100%)",
      },
      keyframes: {
        shine: { "0%": { transform: "translateX(-120%) rotate(12deg)" }, "100%": { transform: "translateX(220%) rotate(12deg)" } },
        pulseDot: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
      },
      animation: {
        shine: "shine 1.1s ease-out",
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
