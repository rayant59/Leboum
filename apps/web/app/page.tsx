"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BoumTrailer } from "@/components/BoumTrailer";
import { generateRoomCode, isValidRoomCode, sanitizeName } from "@subtitles-party/shared";
import { getPlayerName, setPlayerName } from "@/lib/identity";

const TAGLINES = [
  "...trouve le mot avant que ça explose",
  "...devine l'image pixel par pixel",
  "...devine ce que je dessine",
  "...démasque l'imposteur",
  "...imite le son le plus drôle",
];

const ACCENTS = {
  gold: "#FFC24B",
  magenta: "#FF4D8D",
  mint: "#46E0B0",
  violet: "#8B7DF6",
  cyan: "#4CC9F0",
  orange: "#FF6B4D",
} as const;

const BORDERS = {
  gold: "rgba(255,194,75,0.32)",
  magenta: "rgba(255,77,141,0.32)",
  mint: "rgba(70,224,176,0.32)",
  violet: "rgba(139,125,246,0.4)",
  cyan: "rgba(76,201,240,0.4)",
  orange: "rgba(255,107,77,0.4)",
} as const;

type Accent = keyof typeof ACCENTS;

const GAMES: { img: string; accent: Accent; name: string; desc: string; players: string; variants: string[] }[] = [
  { img: "/games/draw.png", accent: "magenta", name: "Dessin & Devinette", desc: "Dessine le mot secret, les autres devinent — avec ses variantes.", players: "2–8", variants: ["Classique", "Faux-artiste", "Relais"] },
  { img: "/games/mimic.png", accent: "mint", name: "Mimic", desc: "Imite un son avec ta voix — une seule prise, puis on vote pour la meilleure imitation !", players: "2–8", variants: [] },
  { img: "/games/quiz.png", accent: "violet", name: "Quiz", desc: "Répondez à des questions et montrez votre culture !", players: "1–12", variants: [] },
  { img: "/games/reco.png", accent: "cyan", name: "Reconnaissance", desc: "Devinez le personnage, le lieu, l'œuvre… sur une vraie image.", players: "1–12", variants: [] },
  { img: "/games/pixel.png", accent: "mint", name: "Pixel incoming", desc: "Une image se dévoile pixel par pixel : devine le plus vite possible !", players: "1–12", variants: [] },
  { img: "/games/bombe.png", accent: "orange", name: "Bombe", desc: "Trouve vite un mot avec la syllabe avant que la bombe explose !", players: "2–12", variants: [] },
];

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
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState(" ");
  const [confetti, setConfetti] = useState<Confetto[]>([]);
  const [trailerOpen, setTrailerOpen] = useState(false);

  const machine = useRef<{ ti: number; chars: number; phase: "type" | "hold" | "erase" }>({ ti: 0, chars: 0, phase: "type" });
  const holdT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ct = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setName(getPlayerName()), []);

  // Typewriter : tape la punchline, la tient, l'efface, passe à la suivante.
  useEffect(() => {
    const tick = setInterval(() => {
      const m = machine.current;
      const full = TAGLINES[m.ti];
      if (m.phase === "hold") return;
      if (m.phase === "type") {
        if (m.chars < full.length) { m.chars += 1; setTyped(full.slice(0, m.chars)); return; }
        m.phase = "hold";
        holdT.current = setTimeout(() => { m.phase = "erase"; }, 1900);
        return;
      }
      if (m.chars > 0) { m.chars -= 1; setTyped(full.slice(0, m.chars) || " "); return; }
      m.ti = (m.ti + 1) % TAGLINES.length; m.phase = "type";
    }, 55);
    return () => { clearInterval(tick); if (holdT.current) clearTimeout(holdT.current); };
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

  function go(roomCode: string, creating = false) {
    const clean = sanitizeName(name);
    if (!clean) { setError("Choisis un pseudo pour continuer."); return; }
    setPlayerName(clean);
    burst();
    if (creating) {
      try { sessionStorage.setItem(`boum:create:${roomCode}`, "1"); } catch {}
    }
    const href = creating ? `/room/${roomCode}?create=1` : `/room/${roomCode}`;
    setTimeout(() => router.push(href), 450);
  }
  const onCreate = () => go(generateRoomCode(), true);
  function onJoin() {
    const clean = sanitizeName(name);
    if (!clean) { setError("Choisis un pseudo pour continuer."); return; }
    const c = code.trim().toUpperCase();
    if (!isValidRoomCode(c)) { setError("Ce code de partie n'existe pas (4 lettres/chiffres)."); return; }
    go(c);
  }

  return (
    <div style={{ position: "relative", minHeight: "100dvh", overflow: "hidden", backgroundColor: "#14102A", backgroundImage: "radial-gradient(130% 120% at 50% 38%, transparent 58%, rgba(6,4,14,0.5) 100%)", fontFamily: "'Inter', system-ui, sans-serif", color: "#F3EEFF" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        @keyframes bm-caretBlink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
        @keyframes bm-fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        @keyframes bm-letterPop { 0% { opacity: 0; transform: translateY(26px) scale(0.7) rotate(-8deg); } 60% { opacity: 1; transform: translateY(-6px) scale(1.08) rotate(2deg); } 100% { opacity: 1; transform: none; } }
        @keyframes bm-goldGlow { 0%,100% { text-shadow: 0 0 18px rgba(255,194,75,0.55), 0 0 2px rgba(255,194,75,0.4); } 50% { text-shadow: 0 0 34px rgba(255,194,75,0.85), 0 0 6px rgba(255,194,75,0.6); } }
        @keyframes bm-boumRing { 0% { opacity: 0; transform: scale(0.35); } 8% { opacity: 0.55; } 42% { opacity: 0; transform: scale(1.5); } 100% { opacity: 0; transform: scale(1.5); } }
        @keyframes bm-boumKick { 0%, 84%, 100% { transform: none; } 88% { transform: scale(1.035); } 93% { transform: scale(0.99); } }
        @keyframes bm-auroraA { 0% { transform: translate(-4%,-2%) scale(1); } 50% { transform: translate(6%,5%) scale(1.18); } 100% { transform: translate(-4%,-2%) scale(1); } }
        @keyframes bm-auroraB { 0% { transform: translate(3%,4%) scale(1.1); } 50% { transform: translate(-6%,-4%) scale(1); } 100% { transform: translate(3%,4%) scale(1.1); } }
        @keyframes bm-auroraC { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(-5%,6%) scale(1.22); } 100% { transform: translate(0,0) scale(1); } }
        @keyframes bm-driftUp { 0% { transform: translateY(0) translateX(0); opacity: 0; } 12% { opacity: var(--o,0.5); } 88% { opacity: var(--o,0.5); } 100% { transform: translateY(-110px) translateX(var(--dx,0)); opacity: 0; } }
        @keyframes bm-confettiFall { 0% { transform: translateY(-14vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(114vh) rotate(760deg); opacity: 0.85; } }
        @keyframes bm-sheen { 0% { transform: translateX(-140%) skewX(-18deg); } 55%, 100% { transform: translateX(340%) skewX(-18deg); } }
        @keyframes bm-playPulse { 0% { opacity: 0.5; transform: scale(1); } 70%, 100% { opacity: 0; transform: scale(1.9); } }
        @keyframes bm-shimmerLine { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
        .mn-desc { text-wrap: pretty; }
        .mn-name:focus { outline: none; border-color: #FFC24B; box-shadow: 0 0 0 3px rgba(255,194,75,0.15); }
        .mn-code:focus { outline: none; border-color: #FF4D8D; box-shadow: 0 0 0 3px rgba(255,77,141,0.15); }
        .mn-create:hover { filter: brightness(1.05); transform: translateY(-1px); }
        .mn-create:active { transform: translateY(4px); box-shadow: 0 1px 0 #B47F16; }
        .mn-join:hover { filter: brightness(1.05); transform: translateY(-1px); }
        .mn-join:active { transform: translateY(4px); box-shadow: 0 1px 0 #A1315F; }
        .mn-trailer:hover { border-color: rgba(255,194,75,0.55); color: #FFC24B; transform: translateY(-1px); }
        .mn-card:hover { transform: translateY(-5px); border-color: rgba(255,194,75,0.5); box-shadow: 0 18px 36px -22px rgba(0,0,0,0.95); }
        .mn-card:hover .mn-card-img { transform: scale(1.07); }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; } }
      ` }} />

      {/* aurora */}
      <div aria-hidden style={{ position: "absolute", inset: "-10% -10% 0 -10%", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-12%", left: "12%", width: 620, height: 620, borderRadius: "50%", filter: "blur(70px)", background: "radial-gradient(circle, rgba(255,194,75,0.16), transparent 62%)", animation: "bm-auroraA 17s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "-6%", right: "4%", width: 560, height: 560, borderRadius: "50%", filter: "blur(72px)", background: "radial-gradient(circle, rgba(255,77,141,0.14), transparent 62%)", animation: "bm-auroraB 21s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "34%", left: "46%", width: 480, height: 480, borderRadius: "50%", filter: "blur(78px)", background: "radial-gradient(circle, rgba(70,224,176,0.09), transparent 64%)", animation: "bm-auroraC 25s ease-in-out infinite" }} />
      </div>

      {/* drifting dots */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        {DOTS.map((d, i) => (
          <div key={i} style={{ position: "absolute", left: d.left, bottom: -12, width: d.size, height: d.size, borderRadius: "50%", background: d.color, ["--o" as string]: d.opacity, ["--dx" as string]: d.dx, animation: `bm-driftUp ${d.dur} linear ${d.delay} infinite` }} />
        ))}
      </div>

      {/* confetti */}
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60 }}>
        {confetti.map((c) => (
          <div key={c.id} style={{ position: "absolute", top: 0, left: c.left, width: c.size, height: c.h, background: c.color, borderRadius: 2, animation: `bm-confettiFall ${c.dur} cubic-bezier(0.3,0.5,0.7,1) ${c.delay} forwards` }} />
        ))}
      </div>

      <main style={{ position: "relative", zIndex: 1, maxWidth: 768, margin: "0 auto", padding: "40px 20px" }}>
        {/* hero */}
        <header style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ marginBottom: 20, display: "flex", justifyContent: "center", opacity: 0, animation: "bm-fadeUp 0.6s ease 0.05s both" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 6, background: "rgba(0,0,0,0.85)", padding: "6px 12px", fontFamily: "'Space Mono', monospace", fontSize: 14, letterSpacing: "0.03em", boxShadow: "0 2px 0 rgba(0,0,0,0.4)", minHeight: 20 }}>
              <span style={{ color: "#F3EEFF", display: "inline-block", whiteSpace: "pre" }}>{typed}</span>
              <span style={{ display: "inline-block", height: 16, width: 2, background: "#FFC24B", animation: "bm-caretBlink 1.1s step-end infinite" }} />
            </span>
          </div>

          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div aria-hidden style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", border: "1px solid rgba(255,194,75,0.5)", opacity: 0, animation: "bm-boumRing 5.4s cubic-bezier(0.2,0.7,0.3,1) 1.1s infinite" }} />
            <div aria-hidden style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", border: "1px solid rgba(255,77,141,0.4)", opacity: 0, animation: "bm-boumRing 5.4s cubic-bezier(0.2,0.7,0.3,1) 1.32s infinite" }} />
            <div aria-hidden style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,194,75,0.18), transparent 65%)", opacity: 0, animation: "bm-boumRing 5.4s ease-out 1.05s infinite" }} />
            <h1 style={{ position: "relative", margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 76, fontWeight: 800, lineHeight: 0.9, letterSpacing: "-0.03em", animation: "bm-boumKick 5.4s ease-in-out 1s infinite" }}>
              <span style={{ display: "inline-flex" }}>
                <span style={{ display: "inline-block", opacity: 0, animation: "bm-letterPop 0.62s cubic-bezier(0.34,1.56,0.64,1) 0.18s both" }}>B</span>
                <span style={{ display: "inline-block", color: "#FFC24B", opacity: 0, animation: "bm-letterPop 0.62s cubic-bezier(0.34,1.56,0.64,1) 0.27s both, bm-goldGlow 3s ease-in-out 1s infinite" }}>o</span>
                <span style={{ display: "inline-block", color: "#FFC24B", opacity: 0, animation: "bm-letterPop 0.62s cubic-bezier(0.34,1.56,0.64,1) 0.36s both, bm-goldGlow 3s ease-in-out 1.15s infinite" }}>u</span>
                <span style={{ display: "inline-block", opacity: 0, animation: "bm-letterPop 0.62s cubic-bezier(0.34,1.56,0.64,1) 0.45s both" }}>m</span>
              </span>
            </h1>
          </div>

          <p className="mn-desc" style={{ maxWidth: 448, margin: "16px auto 0", color: "#A79FC7", lineHeight: 1.5, opacity: 0, animation: "bm-fadeUp 0.6s ease 0.32s both" }}>
            Le party-game entre amis. Une salle, un code à partager, et une soirée de jeux absurdes — dessin, doublage, quiz et images à deviner. <span style={{ color: "#6E6796" }}>Aucun compte, jouable au téléphone.</span>
          </p>
        </header>

        {/* create / join */}
        <div style={{ maxWidth: 512, margin: "0 auto", borderRadius: 16, border: "1px solid #332A5A", background: "rgba(28,22,54,0.7)", padding: 20, backdropFilter: "blur(6px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 34px -20px rgba(0,0,0,0.85)", opacity: 0, animation: "bm-fadeUp 0.6s ease 0.44s both" }}>
          <label style={{ display: "block", opacity: 0, animation: "bm-fadeUp 0.5s ease 0.56s both" }}>
            <span style={{ marginBottom: 6, display: "block", fontSize: 14, color: "#A79FC7" }}>Ton pseudo</span>
            <input
              className="mn-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              maxLength={20}
              placeholder="ex. Camille"
              style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid #332A5A", background: "#0E0B1A", padding: "10px 14px", fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 15, color: "#F3EEFF", outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" }}
            />
          </label>

          <button
            className="mn-create"
            onClick={onCreate}
            style={{ position: "relative", overflow: "hidden", marginTop: 16, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 700, fontSize: 16, lineHeight: 1, border: "none", borderRadius: 14, padding: "13px 20px", background: "#FFC24B", color: "#0E0B1A", boxShadow: "0 5px 0 #B47F16, 0 10px 18px -8px rgba(0,0,0,.6)", transition: "transform .08s ease, filter .12s ease, box-shadow .12s ease", opacity: 0, animation: "bm-fadeUp 0.5s ease 0.62s both" }}
          >
            Créer une partie
            <span aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 42, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)", animation: "bm-sheen 4.2s ease-in-out 1.6s infinite", pointerEvents: "none" }} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, fontSize: 12, color: "#6E6796", opacity: 0, animation: "bm-fadeUp 0.5s ease 0.7s both" }}>
            <span style={{ height: 1, flex: 1, background: "linear-gradient(90deg, transparent, #332A5A)", animation: "bm-shimmerLine 4s ease-in-out infinite" }} />
            ou rejoins des amis
            <span style={{ height: 1, flex: 1, background: "linear-gradient(90deg, #332A5A, transparent)", animation: "bm-shimmerLine 4s ease-in-out 2s infinite" }} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, opacity: 0, animation: "bm-fadeUp 0.5s ease 0.78s both" }}>
            <input
              className="mn-code"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 4)); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && onJoin()}
              placeholder="CODE"
              style={{ width: 128, boxSizing: "border-box", borderRadius: 8, border: "1px solid #332A5A", background: "#0E0B1A", padding: "10px 14px", textAlign: "center", fontFamily: "'Space Mono', monospace", fontSize: 18, letterSpacing: "0.3em", color: "#F3EEFF", outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" }}
            />
            <button
              className="mn-join"
              onClick={onJoin}
              style={{ position: "relative", overflow: "hidden", flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 700, fontSize: 16, lineHeight: 1, border: "none", borderRadius: 14, padding: "13px 20px", background: "#FF4D8D", color: "#2a0716", boxShadow: "0 5px 0 #A1315F, 0 10px 18px -8px rgba(0,0,0,.6)", transition: "transform .08s ease, filter .12s ease, box-shadow .12s ease" }}
            >
              Rejoindre
              <span aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 42, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)", animation: "bm-sheen 4.2s ease-in-out 3.1s infinite", pointerEvents: "none" }} />
            </button>
          </div>

          {error && <p role="alert" style={{ margin: "12px 0 0", fontSize: 14, color: "#FF5C5C", animation: "bm-fadeUp 0.3s ease both" }}>{error}</p>}

          <button
            className="mn-trailer"
            onClick={() => setTrailerOpen(true)}
            style={{ margin: "14px auto 0", display: "flex", alignItems: "center", gap: 9, border: "1px solid #332A5A", background: "transparent", borderRadius: 999, padding: "9px 18px", fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 14, color: "#C9C2E6", cursor: "pointer", transition: "border-color .18s, color .18s, transform .18s", opacity: 0, animation: "bm-fadeUp 0.5s ease 0.88s both" }}
          >
            <span style={{ position: "relative", display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: "50%", border: "1px solid currentColor" }}>
              <span aria-hidden style={{ position: "absolute", inset: -1, borderRadius: "50%", border: "1px solid #FFC24B", animation: "bm-playPulse 2.8s ease-out infinite" }} />
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 1 }}><path d="M8 5v14l11-7z" /></svg>
            </span>
            Bande-annonce
          </button>

          <p style={{ margin: "16px 0 0", textAlign: "center", fontSize: 12, color: "#6E6796", opacity: 0, animation: "bm-fadeUp 0.5s ease 0.96s both" }}>Le choix du jeu se fait dans la salle, une fois vos amis arrivés.</p>
        </div>

        {/* games showcase */}
        <section style={{ marginTop: 48, width: "min(1100px, calc(100vw - 32px))", marginLeft: "50%", transform: "translateX(-50%)" }}>
          <p style={{ margin: "0 0 16px", textAlign: "center", fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.22em", color: "#6E6796", opacity: 0, animation: "bm-fadeUp 0.5s ease 1s both" }}>Les jeux</p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
            {GAMES.map((g, i) => {
              const delay = (1.05 + i * 0.08).toFixed(2) + "s";
              return (
                <div key={g.name} className="mn-card" style={{ flex: "0 1 205px", borderRadius: 16, border: `1px solid ${BORDERS[g.accent]}`, background: "rgba(28,22,54,0.6)", padding: 12, transition: "transform 0.24s cubic-bezier(0.3,1.2,0.5,1), border-color 0.24s, box-shadow 0.24s", opacity: 0, animation: `bm-fadeUp 0.55s ease ${delay} both` }}>
                  <div style={{ position: "relative", marginBottom: 12, borderRadius: 12, overflow: "hidden", boxShadow: `0 8px 26px -14px ${ACCENTS[g.accent]}` }}>
                    <img className="mn-card-img" src={g.img} alt={g.name} draggable={false} style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover", transition: "transform 0.5s cubic-bezier(0.2,0.8,0.2,1)" }} />
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

        <p style={{ margin: "40px 0 0", textAlign: "center", fontSize: 12, color: "#6E6796", opacity: 0, animation: "bm-fadeUp 0.6s ease 1.3s both" }}>2 à 10 joueurs · aucun compte requis · joue depuis ton téléphone</p>
      </main>

      {trailerOpen && <BoumTrailer onClose={() => setTrailerOpen(false)} onCreate={() => { setTrailerOpen(false); onCreate(); }} />}
    </div>
  );
}
