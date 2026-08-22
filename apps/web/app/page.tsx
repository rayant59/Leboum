"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BoumTrailer } from "@/components/BoumTrailer";
import { generateRoomCode, isValidRoomCode, sanitizeName } from "@subtitles-party/shared";
import { getPlayerName, setPlayerName } from "@/lib/identity";

const TAGLINES = [
  "...à toi d'écrire la suite",
  "...devine ce que je dessine",
  "...démasque l'imposteur",
  "...improvise les voix",
];

const ACCENTS = {
  gold: { tint: "#FFC24B", tintBg: "rgba(255,194,75,0.12)", tintBorder: "rgba(255,194,75,0.32)" },
  magenta: { tint: "#FF4D8D", tintBg: "rgba(255,77,141,0.12)", tintBorder: "rgba(255,77,141,0.32)" },
  mint: { tint: "#46E0B0", tintBg: "rgba(70,224,176,0.12)", tintBorder: "rgba(70,224,176,0.32)" },
  violet: { tint: "#8B7DF6", tintBg: "rgba(139,125,246,0.14)", tintBorder: "rgba(139,125,246,0.4)" },
  cyan: { tint: "#4CC9F0", tintBg: "rgba(76,201,240,0.14)", tintBorder: "rgba(76,201,240,0.4)" },
} as const;

const GAMES = [
  { img: "/games/subtitles.png", accent: "gold", name: "Sous-titres", desc: "Inventez les dialogues d'une scène muette, votez pour le plus drôle.", players: "3–8", variants: [] as string[] },
  { img: "/games/draw.png", accent: "magenta", name: "Dessin & Devinette", desc: "Dessine le mot secret, les autres devinent — avec ses variantes.", players: "2–8", variants: ["Classique", "Faux-artiste", "Relais"] },
  { img: "/games/doublage.png", accent: "mint", name: "Doublage", desc: "Doublez une vidéo à votre sauce et improvisez les voix.", players: "2–10", variants: [] as string[] },
  { img: "/games/quiz.png", accent: "violet", name: "Quiz", desc: "Répondez à des questions et montrez votre culture !", players: "1–12", variants: [] as string[] },
  { img: "/games/reco.png", accent: "cyan", name: "Reconnaissance", desc: "Devinez le personnage, le lieu, l'œuvre… sur une vraie image.", players: "1–12", variants: [] as string[] },
] as const;

const DOT_COLORS = ["rgba(255,194,75,0.7)", "rgba(255,77,141,0.6)", "rgba(70,224,176,0.6)", "rgba(243,238,255,0.5)"];
const DOTS = Array.from({ length: 14 }, (_, i) => ({
  left: ((i * 67) % 100) + "%",
  size: (3 + (i % 3) * 2) + "px",
  color: DOT_COLORS[i % DOT_COLORS.length],
  opacity: (0.35 + (i % 3) * 0.12).toFixed(2),
  dx: (i % 2 ? 1 : -1) * (10 + (i % 4) * 8) + "px",
  dur: (11 + (i % 5) * 3) + "s",
  delay: (i * 0.9).toFixed(1) + "s",
}));

type Confetto = { id: string; left: string; color: string; size: string; h: string; delay: string; dur: string };

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ti, setTi] = useState(0);
  const [confetti, setConfetti] = useState<Confetto[]>([]);
  const ct = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setName(getPlayerName()), []);
  useEffect(() => {
    const id = setInterval(() => setTi((s) => (s + 1) % TAGLINES.length), 2600);
    return () => clearInterval(id);
  }, []);
  useEffect(() => () => { if (ct.current) clearTimeout(ct.current); }, []);

  function burst() {
    const colors = ["#FFC24B", "#FF4D8D", "#46E0B0", "#F3EEFF", "#9184d9"];
    setConfetti(
      Array.from({ length: 46 }, (_, i) => ({
        id: Date.now() + "-" + i,
        left: (Math.random() * 100).toFixed(1) + "%",
        color: colors[i % colors.length],
        size: (6 + Math.random() * 6).toFixed(0) + "px",
        h: (9 + Math.random() * 8).toFixed(0) + "px",
        delay: (Math.random() * 0.35).toFixed(2) + "s",
        dur: (1.5 + Math.random() * 1.1).toFixed(2) + "s",
      })),
    );
    if (ct.current) clearTimeout(ct.current);
    ct.current = setTimeout(() => setConfetti([]), 3200);
  }

  function go(roomCode: string) {
    const clean = sanitizeName(name);
    if (!clean) { setError("Choisis un pseudo pour continuer."); return; }
    setPlayerName(clean);
    burst();
    setTimeout(() => router.push(`/room/${roomCode}`), 450);
  }
  const create = () => go(generateRoomCode());
  function join() {
    const clean = sanitizeName(name);
    if (!clean) { setError("Choisis un pseudo pour continuer."); return; }
    const c = code.trim().toUpperCase();
    if (!isValidRoomCode(c)) { setError("Ce code de partie n'existe pas (4 lettres/chiffres)."); return; }
    go(c);
  }

  return (
    <div style={{ position: "relative", minHeight: "100dvh", overflow: "hidden", backgroundColor: "#14102A", backgroundImage: "radial-gradient(130% 120% at 50% 38%, transparent 58%, rgba(6,4,14,0.5) 100%)", fontFamily: "'Inter', system-ui, sans-serif", color: "#F3EEFF" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Space+Mono:wght@400;700&display=swap');
        @keyframes caretBlink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
        @keyframes tagIn { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        @keyframes titlePop { 0% { opacity: 0; transform: scale(0.82) translateY(12px); } 55% { transform: scale(1.05) translateY(0); } 100% { opacity: 1; transform: none; } }
        @keyframes wiggle { 0%,100% { transform: rotate(0); } 20% { transform: rotate(16deg); } 55% { transform: rotate(-11deg); } 80% { transform: rotate(6deg); } }
        @keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes goldGlow { 0%,100% { text-shadow: 0 0 18px rgba(255,194,75,0.55), 0 0 2px rgba(255,194,75,0.4); } 50% { text-shadow: 0 0 34px rgba(255,194,75,0.85), 0 0 6px rgba(255,194,75,0.6); } }
        @keyframes auroraA { 0% { transform: translate(-4%,-2%) scale(1); } 50% { transform: translate(6%,5%) scale(1.18); } 100% { transform: translate(-4%,-2%) scale(1); } }
        @keyframes auroraB { 0% { transform: translate(3%,4%) scale(1.1); } 50% { transform: translate(-6%,-4%) scale(1); } 100% { transform: translate(3%,4%) scale(1.1); } }
        @keyframes auroraC { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(-5%,6%) scale(1.22); } 100% { transform: translate(0,0) scale(1); } }
        @keyframes driftUp { 0% { transform: translateY(0) translateX(0); opacity: 0; } 12% { opacity: var(--o,0.5); } 88% { opacity: var(--o,0.5); } 100% { transform: translateY(-110px) translateX(var(--dx,0)); opacity: 0; } }
        @keyframes confettiFall { 0% { transform: translateY(-14vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(114vh) rotate(760deg); opacity: 0.85; } }
        @keyframes sheen { 0% { transform: translateX(-140%) skewX(-18deg); } 100% { transform: translateX(340%) skewX(-18deg); } }
        .boum-input:focus { border-color: #FFC24B !important; }
        .boum-code:focus { border-color: #FF4D8D !important; }
        .boum-gold:hover { transform: translateY(-2px); box-shadow: 0 14px 30px -12px rgba(255,194,75,0.95); }
        .boum-gold:active { transform: translateY(0); }
        .boum-magenta:hover { background: rgba(255,77,141,0.2); transform: translateY(-1px); }
        .boum-card:hover { transform: translateY(-3px); border-color: rgba(255,194,75,0.5); box-shadow: 0 16px 34px -22px rgba(0,0,0,0.9); }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; } }
      ` }} />

      {/* aurora */}
      <div aria-hidden style={{ position: "absolute", inset: "-10% -10% 0 -10%", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-12%", left: "12%", width: 620, height: 620, borderRadius: "50%", filter: "blur(70px)", background: "radial-gradient(circle, rgba(255,194,75,0.16), transparent 62%)", animation: "auroraA 17s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "-6%", right: "4%", width: 560, height: 560, borderRadius: "50%", filter: "blur(72px)", background: "radial-gradient(circle, rgba(255,77,141,0.14), transparent 62%)", animation: "auroraB 21s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "34%", left: "46%", width: 480, height: 480, borderRadius: "50%", filter: "blur(78px)", background: "radial-gradient(circle, rgba(70,224,176,0.09), transparent 64%)", animation: "auroraC 25s ease-in-out infinite" }} />
      </div>

      {/* drifting dots */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        {DOTS.map((d, i) => (
          <div key={i} style={{ position: "absolute", left: d.left, bottom: -12, width: d.size, height: d.size, borderRadius: "50%", background: d.color, ["--o" as string]: d.opacity, ["--dx" as string]: d.dx, animation: `driftUp ${d.dur} linear ${d.delay} infinite` }} />
        ))}
      </div>

      {/* confetti */}
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60 }}>
        {confetti.map((c) => (
          <div key={c.id} style={{ position: "absolute", top: 0, left: c.left, width: c.size, height: c.h, background: c.color, borderRadius: 2, animation: `confettiFall ${c.dur} cubic-bezier(0.3,0.5,0.7,1) ${c.delay} forwards` }} />
        ))}
      </div>

      <main style={{ position: "relative", zIndex: 1, maxWidth: 768, margin: "0 auto", padding: "40px 20px" }}>
        {/* hero */}
        <header style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ marginBottom: 20, display: "flex", justifyContent: "center", opacity: 0, animation: "fadeUp 0.6s ease 0.05s both" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 6, background: "rgba(0,0,0,0.85)", padding: "6px 12px", fontFamily: "'Space Mono', monospace", fontSize: 14, letterSpacing: "0.03em", boxShadow: "0 2px 0 rgba(0,0,0,0.4)" }}>
              <span key={ti} style={{ color: "#F3EEFF", display: "inline-block", animation: "tagIn 0.45s ease both" }}>{TAGLINES[ti]}</span>
              <span style={{ display: "inline-block", height: 16, width: 2, background: "#FFC24B", animation: "caretBlink 1.1s step-end infinite" }} />
            </span>
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 76, fontWeight: 800, lineHeight: 0.9, letterSpacing: "-0.03em", opacity: 0, animation: "titlePop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.15s both" }}>
            B<span style={{ color: "#FFC24B", animation: "goldGlow 3s ease-in-out infinite" }}>ou</span>m
            <span style={{ display: "inline-block", marginLeft: 4, verticalAlign: "top", fontSize: 34, animation: "wiggle 2.6s ease-in-out 0.9s infinite", transformOrigin: "60% 80%" }}>🎉</span>
          </h1>
          <p style={{ maxWidth: 448, margin: "16px auto 0", color: "#A79FC7", lineHeight: 1.5, opacity: 0, animation: "fadeUp 0.6s ease 0.32s both" }}>
            Le party-game entre amis. Une salle, un code à partager, et une soirée de jeux absurdes — dessin, impro, doublage et plus. <span style={{ color: "#6E6796" }}>Aucun compte, jouable au téléphone.</span>
          </p>
        </header>

        {/* create / join */}
        <div style={{ maxWidth: 512, margin: "0 auto", borderRadius: 16, border: "1px solid #332A5A", background: "rgba(28,22,54,0.7)", padding: 20, backdropFilter: "blur(6px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 34px -20px rgba(0,0,0,0.85)", opacity: 0, animation: "fadeUp 0.6s ease 0.44s both" }}>
          <label style={{ display: "block" }}>
            <span style={{ marginBottom: 6, display: "block", fontSize: 14, color: "#A79FC7" }}>Ton pseudo</span>
            <input
              className="boum-input"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              maxLength={20}
              placeholder="ex. Camille"
              style={{ width: "100%", borderRadius: 8, border: "1px solid #332A5A", background: "#0E0B1A", padding: "10px 14px", fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 15, color: "#F3EEFF", outline: "none", transition: "border-color 0.15s" }}
            />
          </label>
          <button
            className="arc arc-p arc-block"
            onClick={create}
            style={{ marginTop: 16, fontSize: 16 }}
          >
            Créer une partie
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, fontSize: 12, color: "#6E6796" }}>
            <span style={{ height: 1, flex: 1, background: "#332A5A" }} />
            ou rejoins des amis
            <span style={{ height: 1, flex: 1, background: "#332A5A" }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <input
              className="boum-code"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 4)); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && join()}
              placeholder="CODE"
              style={{ width: 128, borderRadius: 8, border: "1px solid #332A5A", background: "#0E0B1A", padding: "10px 14px", textAlign: "center", fontFamily: "'Space Mono', monospace", fontSize: 18, letterSpacing: "0.3em", color: "#F3EEFF", outline: "none", transition: "border-color 0.15s" }}
            />
            <button className="arc arc-mag" onClick={join} style={{ flex: 1, fontSize: 16 }}>
              Rejoindre
            </button>
          </div>
          {error && <p role="alert" style={{ margin: "12px 0 0", fontSize: 14, color: "#FF5C5C", animation: "fadeUp 0.3s ease both" }}>{error}</p>}
          <button
            onClick={() => setTrailerOpen(true)}
            style={{ margin: "14px auto 0", display: "flex", alignItems: "center", gap: 8, border: "1px solid #332A5A", background: "transparent", borderRadius: 999, padding: "9px 18px", fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 14, color: "#C9C2E6", cursor: "pointer", transition: "border-color .15s, color .15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,194,75,0.55)"; e.currentTarget.style.color = "#FFC24B"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#332A5A"; e.currentTarget.style.color = "#C9C2E6"; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Bande-annonce
          </button>
          <p style={{ margin: "16px 0 0", textAlign: "center", fontSize: 12, color: "#6E6796" }}>Le choix du jeu se fait dans la salle, une fois vos amis arrivés.</p>
        </div>

        {/* games showcase */}
        <section style={{ marginTop: 48, width: "min(1100px, calc(100vw - 32px))", marginLeft: "50%", transform: "translateX(-50%)" }}>
          <p style={{ margin: "0 0 16px", textAlign: "center", fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.22em", color: "#6E6796" }}>Les jeux</p>
          <div className="showcase-grid">
            {GAMES.map((g, i) => {
              const a = ACCENTS[g.accent];
              const delay = (0.55 + i * 0.08).toFixed(2) + "s";
              return (
                <div key={g.name} className="boum-card" style={{ borderRadius: 16, border: `1px solid ${a.tintBorder}`, background: "rgba(28,22,54,0.6)", padding: 12, transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s", opacity: 0, animation: `fadeUp 0.55s ease ${delay} both` }}>
                  <div style={{ position: "relative", marginBottom: 12, borderRadius: 12, overflow: "hidden", boxShadow: `0 8px 26px -14px ${a.tint}` }}>
                    <img src={g.img} alt={g.name} style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }} draggable={false} />
                    <span style={{ position: "absolute", top: 8, right: 8, borderRadius: 999, background: "rgba(14,11,26,0.75)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.12)", padding: "2px 8px", fontSize: 11, color: "#F3EEFF" }}>{g.players} joueurs</span>
                  </div>
                  <h3 style={{ margin: "0 4px", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 17, fontWeight: 700, color: "#F3EEFF" }}>{g.name}</h3>
                  <p style={{ margin: "4px 4px 0", fontSize: 13.5, color: "#A79FC7", lineHeight: 1.45 }}>{g.desc}</p>
                  {g.variants.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 4px 2px" }}>
                      {g.variants.map((v) => (
                        <span key={v} style={{ borderRadius: 999, border: "1px solid #332A5A", background: "#0E0B1A", padding: "2px 8px", fontSize: 11, color: "#A79FC7" }}>{v}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <p style={{ margin: "40px 0 0", textAlign: "center", fontSize: 12, color: "#6E6796", opacity: 0, animation: "fadeUp 0.6s ease 0.8s both" }}>2 à 10 joueurs · aucun compte requis · joue depuis ton téléphone</p>
      </main>
      {trailerOpen && <BoumTrailer onClose={() => setTrailerOpen(false)} onCreate={() => { setTrailerOpen(false); create(); }} />}
    </div>
  );
}
