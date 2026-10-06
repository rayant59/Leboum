import type { Config } from "tailwindcss";

/** Couleur du thème, compatible avec l'opacité Tailwind (bg-gold/20…). */
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Toutes les couleurs viennent des variables CSS --c-* (app/globals.css),
      // modifiables en direct depuis l'éditeur de design (/design).
      colors: {
        ink: {
          DEFAULT: c("ink"), // aubergine night — the room we play in
          deep: c("ink-deep"),
          surface: c("ink-surface"),
          raised: c("ink-raised"),
          border: c("ink-border"),
        },
        text: {
          DEFAULT: c("text"),
          muted: c("text-muted"),
          faint: c("text-faint"),
        },
        gold: c("gold"), // cinema marquee — the primary accent, used sparingly
        magenta: c("magenta"), // comedy energy
        mint: c("mint"), // ready / go
        danger: c("danger"),
        violet: c("violet"),
        cyan: c("cyan"),
        orange: c("orange"),
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "caret-blink": { "0%,49%": { opacity: "1" }, "50%,100%": { opacity: "0" } },
        "bulb-pulse": {
          "0%,100%": { opacity: "1", filter: "drop-shadow(0 0 6px rgb(var(--c-gold)))" },
          "50%": { opacity: "0.55", filter: "drop-shadow(0 0 2px rgb(var(--c-gold)))" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        caret: "caret-blink 1.1s step-end infinite",
        bulb: "bulb-pulse 1.8s ease-in-out infinite",
        pop: "pop-in 0.22s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
