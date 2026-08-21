import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#14102A", // aubergine night — the room we play in
          deep: "#0E0B1A",
          surface: "#1C1636",
          raised: "#251C45",
          border: "#332A5A",
        },
        text: {
          DEFAULT: "#F3EEFF",
          muted: "#A79FC7",
          faint: "#6E6796",
        },
        gold: "#FFC24B", // cinema marquee — the primary accent, used sparingly
        magenta: "#FF4D8D", // comedy energy
        mint: "#46E0B0", // ready / go
        danger: "#FF5C5C",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "caret-blink": { "0%,49%": { opacity: "1" }, "50%,100%": { opacity: "0" } },
        "bulb-pulse": {
          "0%,100%": { opacity: "1", filter: "drop-shadow(0 0 6px #FFC24B)" },
          "50%": { opacity: "0.55", filter: "drop-shadow(0 0 2px #FFC24B)" },
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
