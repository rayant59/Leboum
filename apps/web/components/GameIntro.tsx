"use client";

// Écran d'annonce « prochain jeu », affiché brièvement au démarrage de chaque
// jeu (overlay plein écran). Couleur d'accent tirée du jeu ; compte à rebours
// visuel 3 → 1 puis auto-disparition (gérée par le parent) ou clic pour passer.

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";

type IntroPlayer = {
  id: string;
  name: string;
  color: string;
  avatar?: string | null;
  isConnected: boolean;
};

const INTRO_META: Record<string, { name: string; img: string; accent: string; tagline: string }> = {
  subtitles:  { name: "Sous-titres",   img: "/games/subtitles.png", accent: "#FFC24B", tagline: "Invente les meilleures répliques." },
  draw:       { name: "Boum Dessin",   img: "/games/draw.png",      accent: "#FF4D8D", tagline: "Dessine le mot secret, les autres devinent." },
  fakeartist: { name: "Faux-artiste",  img: "/games/draw.png",      accent: "#FF6B6B", tagline: "Un imposteur ignore le mot — démasquez-le au vote." },
  relay:      { name: "Relais",        img: "/games/draw.png",      accent: "#4CC9F0", tagline: "Deux joueurs se relaient au crayon." },
  mimic:      { name: "Mimic Boum",    img: "/games/mimic.png",     accent: "#46E0B0", tagline: "Imite un son avec ta voix — une seule prise." },
  quiz:       { name: "Ça te parle ?", img: "/games/quiz.png",      accent: "#8B7DF6", tagline: "Réponds vite et montre ta culture." },
  reco:       { name: "Œil de Boum",   img: "/games/reco.png",      accent: "#4FC3F7", tagline: "Devine le personnage, le film, le lieu…" },
  pixel:      { name: "Pixel Panic",   img: "/games/pixel.png",     accent: "#46E0B0", tagline: "L'image se dévoile pixel par pixel." },
  bombe:      { name: "Boum Rush",     img: "/games/bombe.png",     accent: "#FF6B4D", tagline: "Trouve un mot avec la syllabe avant l'explosion." },
  doublage:   { name: "Doublage",      img: "/games/doublage.png",  accent: "#FFC24B", tagline: "Double la scène à ta façon." },
};

const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

export function GameIntro({
  gameId,
  players,
  onDone,
}: {
  gameId: string;
  players: IntroPlayer[];
  onDone: () => void;
}) {
  const meta =
    INTRO_META[gameId] ?? { name: "Prochain jeu", img: "/games/draw.png", accent: "#FFC24B", tagline: "" };
  const a = meta.accent;

  const [count, setCount] = useState(3);
  useEffect(() => {
    const id = window.setInterval(() => setCount((c) => (c > 1 ? c - 1 : c)), 900);
    return () => window.clearInterval(id);
  }, []);

  const connected = players.filter((p) => p.isConnected);
  const shown = connected.slice(0, 8);
  const extra = Math.max(0, connected.length - shown.length);
  const C = 301; // circonférence ≈ 2π·48

  return (
    <div
      onClick={onDone}
      role="button"
      tabIndex={0}
      aria-label="Passer l'introduction"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onDone();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        background: "radial-gradient(120% 90% at 50% 0%, #241A54 0%, #14102A 52%, #0B0918 100%)",
        fontFamily: DISPLAY,
        color: "#F3EEFF",
        animation: "gi-in .35s ease both",
      }}
    >
      <style>{`
        @keyframes gi-in { 0% { opacity: 0 } 100% { opacity: 1 } }
        @keyframes gi-halo { to { transform: rotate(360deg) } }
        @keyframes gi-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes gi-pulse { 0%,100% { transform: scale(1); opacity:.85 } 50% { transform: scale(1.06); opacity:1 } }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, padding: "0 32px", textAlign: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".28em", textTransform: "uppercase", color: "#A79FC7" }}>
          Prochain jeu
        </span>

        <div style={{ position: "relative", width: 200, height: 200, display: "grid", placeItems: "center", animation: "gi-float 4.2s ease-in-out infinite" }}>
          <div aria-hidden style={{ position: "absolute", inset: -16, borderRadius: "50%", background: `conic-gradient(from 0deg, ${a}00, ${a}, rgba(139,125,246,.6), rgba(255,77,141,.6), ${a}00)`, filter: "blur(12px)", opacity: 0.8, animation: "gi-halo 8s linear infinite" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meta.img} alt={meta.name} width={180} height={180} style={{ position: "relative", width: 180, height: 180, borderRadius: 36, objectFit: "cover", boxShadow: "0 0 0 1px rgba(255,255,255,.08), 0 24px 50px -18px rgba(0,0,0,.9)" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 46, fontWeight: 800, letterSpacing: "-.02em" }}>{meta.name}</h1>
          {meta.tagline && (
            <p style={{ margin: 0, maxWidth: 460, fontSize: 15, lineHeight: 1.5, color: "#A79FC7" }}>{meta.tagline}</p>
          )}
        </div>

        <div style={{ position: "relative", width: 108, height: 108, display: "grid", placeItems: "center" }}>
          <div aria-hidden style={{ position: "absolute", inset: -50, borderRadius: "50%", background: `radial-gradient(circle, ${a}80, ${a}28 40%, ${a}00 70%)`, animation: "gi-pulse 1s ease-in-out infinite" }} />
          <svg width="108" height="108" viewBox="0 0 108 108" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
            <circle cx="54" cy="54" r="48" fill="none" stroke="#332A5A" strokeWidth="6" />
            <circle cx="54" cy="54" r="48" fill="none" stroke={a} strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - (count / 3) * C} style={{ transition: "stroke-dashoffset .4s ease", filter: `drop-shadow(0 0 8px ${a}b3)` }} />
          </svg>
          <span style={{ position: "relative", fontSize: 48, fontWeight: 800, color: a }}>{count}</span>
        </div>

        {connected.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderRadius: 999, border: "1px solid #332A5A", background: "rgba(28,22,54,.55)" }}>
            <div style={{ display: "flex" }}>
              {shown.map((p, i) => (
                <span key={p.id} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: 9, boxShadow: "0 0 0 2px #14102A" }}>
                  <Avatar name={p.name} color={p.color} avatar={p.avatar} size={30} />
                </span>
              ))}
              {extra > 0 && (
                <span style={{ marginLeft: -8, width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: "#251C45", color: "#A79FC7", fontWeight: 800, fontSize: 11, boxShadow: "0 0 0 2px #14102A" }}>
                  +{extra}
                </span>
              )}
            </div>
            <span style={{ fontSize: 13, color: "#A79FC7" }}>
              <b style={{ color: "#46E0B0" }}>{connected.length} joueur{connected.length > 1 ? "s" : ""}</b> · prêts
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
