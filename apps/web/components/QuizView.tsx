"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { QuizPublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { SoundToggle, useGameSounds, playSound } from "@/lib/sound";

// ── Palette « LeBoum » (identité or / menthe / rose) ────────────────────────
const C = {
  bg: "#14102A",
  aside: "rgba(28,22,54,.72)",
  ink: "#0E0B1A",
  surface: "#1C1636",
  line: "#332A5A",
  lineFaint: "#241D45",
  text: "#F3EEFF",
  muted: "#A79FC7",
  faint: "#6E6796",
  dim: "#4A4370",
  gold: "#FFC24B",
  goldSh: "#B47F16",
  orange: "#FF8A3D",
  mint: "#46E0B0",
  mintSh: "#1E6B55",
  pink: "#FF4D8D",
  pinkSh: "#8C2A4E",
  violet: "#8B7DF6",
  cyan: "#4FC3F7",
};
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const MONO = "'Bricolage Grotesque', system-ui, sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

function hexA(hex: string, a: number) {
  const h = String(hex || "#FFC24B").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Styles de survol / enfoncement — signature « chunky » du jeu.
const SCOPED_CSS = `
.qz-tile{transition:box-shadow .12s ease,transform .06s ease}
.qz-tile:hover{box-shadow:0 0 0 1px rgba(255,194,75,.6), 0 4px 0 #241D45}
.qz-tile:active{transform:translateY(3px);box-shadow:0 0 0 1px rgba(255,194,75,.6), 0 1px 0 #241D45}
.qz-tf{transition:transform .06s ease,box-shadow .12s ease,background .12s ease}
.qz-tf-t:hover{background:rgba(70,224,176,.18)}
.qz-tf-t:active{transform:translateY(4px);box-shadow:0 0 0 1px rgba(70,224,176,.45), 0 1px 0 #1E6B55}
.qz-tf-f:hover{background:rgba(255,77,141,.18)}
.qz-tf-f:active{transform:translateY(4px);box-shadow:0 0 0 1px rgba(255,77,141,.45), 0 1px 0 #8C2A4E}
.qz-gold{transition:transform .06s ease,box-shadow .12s ease,filter .12s ease}
.qz-gold:hover{filter:brightness(1.04)}
.qz-gold:active{transform:translateY(4px);box-shadow:0 1px 0 #B47F16}
.qz-ghost{transition:border-color .12s ease,color .12s ease}
.qz-ghost:hover{border-color:#FFC24B;color:#FFC24B}
.qz-input::placeholder{color:#4A4370}
@keyframes qzPulse{0%,100%{opacity:.55}50%{opacity:1}}
`;

function initials(name: string) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

function useCountdown(deadline: number | null, now: () => number) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);
  if (deadline == null) return null;
  return Math.max(0, Math.ceil((deadline - now()) / 1000));
}

// Aurores animées en fond (réutilise les keyframes globales bmbAuroraA/B).
function Aurora({ tint = "rgba(255,194,75,.10)", tint2 = "rgba(139,125,246,.12)" }: { tint?: string; tint2?: string }) {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div data-bmb-anim style={{ position: "absolute", top: "-18%", left: "36%", width: 520, height: 520, borderRadius: "50%", filter: "blur(84px)", background: `radial-gradient(circle, ${tint}, transparent 62%)`, animation: "bmbAuroraA 19s ease-in-out infinite" }} />
      <div data-bmb-anim style={{ position: "absolute", bottom: "-16%", right: "2%", width: 440, height: 440, borderRadius: "50%", filter: "blur(84px)", background: `radial-gradient(circle, ${tint2}, transparent 62%)`, animation: "bmbAuroraB 24s ease-in-out infinite" }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export function QuizView({ room }: { room: UseRoom }) {
  useGameSounds(room);
  const game = room.game as QuizPublic;
  const you = room.you;
  const isHost = room.state?.hostId === you;
  const secs = useCountdown(game.phase === "reveal" ? null : game.deadline, room.serverNow);
  const [freeText, setFreeText] = useState("");
  const answered = you ? game.answeredIds.includes(you) : false;
  const q = game.question;

  // reset the free-text box on each new question
  const idxRef = useRef(game.index);
  useEffect(() => {
    if (idxRef.current !== game.index) { idxRef.current = game.index; setFreeText(""); }
  }, [game.index]);

  // Sound feedback
  const prevPhase = useRef(game.phase);
  useEffect(() => {
    if (prevPhase.current !== game.phase) {
      if (game.phase === "reveal") playSound(game.yourCorrect ? "correct" : "wrong");
      else if (game.phase === "final") playSound("win");
      prevPhase.current = game.phase;
    }
  }, [game.phase, game.yourCorrect]);
  const prevSec = useRef<number | null>(null);
  useEffect(() => {
    if (secs != null && secs !== prevSec.current && game.phase === "question" && secs <= 3 && secs > 0) playSound("tick");
    prevSec.current = secs;
  }, [secs, game.phase]);

  // ── Barre latérale (rail joueurs) ─────────────────────────────────────────
  const answeredCount = game.answeredIds.length;
  const railKicker = game.phase === "final" ? "Classement" : "Quiz";
  const railHeading = game.phase === "final" ? "Partie terminée" : `Question ${game.index + 1} / ${game.total}`;
  const railSub =
    game.phase === "final" ? `${game.total} questions`
    : game.phase === "reveal" ? "points de la question"
    : `${game.players.length} en jeu · ${answeredCount} ${answeredCount > 1 ? "ont répondu" : "a répondu"}`;

  function accentBox(color: string): CSSProperties {
    return { background: hexA(color, 0.1), boxShadow: `0 0 0 1px ${hexA(color, 0.55)}, 0 0 26px -12px ${hexA(color, 0.9)}` };
  }

  const RailRows = game.ranking.map((r, i) => {
    const isYou = r.id === you;
    let accent: string | null = null;
    let badge: { t: string; c: string } | null = null;
    let meta: { t: string; c: string } | null = null;
    let score: string | null = null;
    let scoreColor = C.muted;
    let rank: number | null = null;

    if (game.phase === "final") {
      rank = i + 1;
      score = r.score.toLocaleString("fr-FR");
      if (i === 0) { accent = C.mint; scoreColor = C.mint; }
      else if (isYou) scoreColor = C.gold;
    } else if (game.phase === "reveal") {
      if (isYou) accent = r.correct ? C.mint : C.gold;
      meta = r.gained > 0 ? { t: `+${r.gained}`, c: C.mint } : { t: "0", c: C.pink };
      score = r.score.toLocaleString("fr-FR");
    } else {
      if (isYou) accent = C.gold;
      if (game.answeredIds.includes(r.id)) badge = { t: "a répondu", c: r.id === you ? C.gold : C.mint };
      score = r.score.toLocaleString("fr-FR");
    }

    const teamColor = r.team === 1 ? C.cyan : C.pink;
    const eliminated = !!r.eliminated;
    return (
      <div
        key={r.id}
        style={{
          position: "relative", display: "flex", alignItems: "center", gap: 12,
          padding: accent ? "12px 14px 12px 16px" : "12px 14px", borderRadius: 14,
          opacity: eliminated ? 0.45 : 1,
          ...(accent ? accentBox(accent) : { boxShadow: `0 0 0 1px ${C.line}` }),
        }}
      >
        {accent && <span style={{ position: "absolute", left: 0, top: 13, bottom: 13, width: 3, borderRadius: 3, background: accent }} />}
        {rank != null && (
          <span style={{ flex: "none", width: 14, fontFamily: DISPLAY, fontWeight: 700, fontSize: 12, color: i === 0 ? C.mint : C.faint }}>{rank}</span>
        )}
        {r.team != null && <span style={{ flex: "none", width: 6, height: 6, borderRadius: 6, background: teamColor, boxShadow: `0 0 8px -1px ${teamColor}` }} title={`Équipe ${r.team === 1 ? "B" : "A"}`} />}
        <Avatar name={r.name} color={r.color} avatar={r.avatar} size={34} />
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.name}{isYou && <span style={{ color: C.faint, fontWeight: 400 }}> · toi</span>}
          </span>
          {r.lives != null && (
            <span style={{ display: "flex", gap: 2, alignItems: "center", fontSize: 10 }}>
              {eliminated ? (
                <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em", color: C.faint }}>éliminé</span>
              ) : (
                Array.from({ length: 3 }).map((_, k) => (
                  <span key={k} style={{ color: k < (r.lives ?? 0) ? C.pink : C.dim, lineHeight: 1 }}>♥</span>
                ))
              )}
            </span>
          )}
          {meta && (
            <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, color: meta.c }}>{meta.t}</span>
            </span>
          )}
        </span>
        {badge && (
          <span style={{ flex: "none", marginLeft: 6, whiteSpace: "nowrap", fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: badge.c }}>{badge.t}</span>
        )}
        {score != null && (
          <span style={{ flex: "none", fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: scoreColor }}>{score}</span>
        )}
      </div>
    );
  });

  const Sidebar = (
    <aside className="bmb-aside" style={{ position: "relative", width: 296, flex: "none", display: "flex", flexDirection: "column", gap: 18, padding: "24px 20px", background: C.aside, borderRight: `1px solid ${C.line}`, zIndex: 1 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.faint }}>{railKicker}</span>
        <span style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.1 }}>{railHeading}</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: C.faint }}>{railSub}</span>
      </div>
      {game.teamScores && (
        <div style={{ display: "flex", gap: 8 }}>
          {([["A", C.pink, game.teamScores[0]], ["B", C.cyan, game.teamScores[1]]] as const).map(([nm, col, sc]) => (
            <div key={nm} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 12px", borderRadius: 12, boxShadow: `0 0 0 1px ${hexA(col, 0.5)}`, background: hexA(col, 0.08) }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 12, color: col }}>Équipe {nm}</span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18, color: C.text }}>{sc}</span>
            </div>
          ))}
        </div>
      )}
      {game.mode === "survival" && game.yourLives != null && !game.yourEliminated && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 12, boxShadow: `0 0 0 1px ${hexA(C.pink, 0.45)}`, background: hexA(C.pink, 0.07) }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: C.faint }}>Tes vies</span>
          <span style={{ marginLeft: "auto", letterSpacing: 2 }}>{Array.from({ length: 3 }).map((_, k) => <span key={k} style={{ color: k < (game.yourLives ?? 0) ? C.pink : C.dim }}>♥</span>)}</span>
        </div>
      )}
      <div style={{ height: 1, flex: "none", background: "linear-gradient(90deg,transparent,rgba(243,238,255,.14) 18%,rgba(243,238,255,.14) 82%,transparent)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{RailRows}</div>
    </aside>
  );

  const shell: CSSProperties = { minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: BODY, display: "flex", flexDirection: "column" };
  const card: CSSProperties = { position: "relative", display: "flex", flex: 1, minHeight: 0, overflow: "hidden" };

  // Chrono restant (fraction) pour la barre sous la question + la barre de tour.
  const spq = game.secondsPerQuestion || 0;
  const remain = spq > 0 && secs != null ? Math.max(0, Math.min(1, secs / spq)) : 0;
  const barPct = Math.round(remain * 90) + 5; // 5%..95%

  // ══════════════════ CLASSEMENT FINAL (4f) ══════════════════
  if (game.phase === "final") {
    const winner = game.ranking[0];
    const stats = game.stats;
    const statCols = stats
      ? [
          { v: stats.fastest, label: "la plus rapide" },
          { v: stats.brain, label: "le plus de bonnes" },
          { v: stats.streak, label: "meilleure série" },
        ].filter((s) => s.v)
      : [];
    return (
      <main style={shell}>
        <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
        <div className="bmb-wrap" style={card}>
          <Aurora tint="rgba(255,194,75,.14)" tint2="rgba(139,125,246,.10)" />
          {Sidebar}
          <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${C.gold} 5%,${C.gold} 95%,transparent)` }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: 24 }}>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: C.faint, display: "inline-flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>🏆</span>Meilleur score
              </span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <span style={{ boxShadow: `0 0 60px -18px ${winner?.color ?? C.violet}` }}>
                  <Avatar name={winner?.name ?? "?"} color={winner?.color ?? C.violet} avatar={winner?.avatar} size={92} />
                </span>
                <span style={{ fontFamily: DISPLAY, fontSize: 58, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1 }}>{winner?.name ?? "—"}</span>
                <span style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 800, color: C.gold }}>{(winner?.score ?? 0).toLocaleString("fr-FR")} pts</span>
              </div>
              {statCols.length > 0 && (
                <div style={{ display: "flex", alignItems: "stretch" }}>
                  {statCols.map((s, k) => (
                    <div key={k} style={{ display: "flex", alignItems: "center" }}>
                      {k > 0 && <div style={{ width: 1, alignSelf: "stretch", background: "linear-gradient(180deg,transparent,rgba(243,238,255,.16),transparent)" }} />}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 26px" }}>
                        <span style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 800 }}>{s.v}</span>
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.faint }}>{s.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: "0 clamp(16px,4vw,40px) 34px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "22px 26px", borderRadius: 18, background: C.ink, boxShadow: `0 0 0 1px ${C.line}, inset 0 1px 0 rgba(243,238,255,.04)` }}>
                <span style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 700 }}>Partie terminée</span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: C.muted }}>{game.total} questions · {game.ranking.length} joueurs</span>
                </span>
                {isHost && <button onClick={() => room.returnLobby()} className="qz-ghost" style={btnGhost}>Salon</button>}
                {isHost && <button onClick={() => room.playAgain()} className="qz-gold" style={btnGold}>Rejouer</button>}
                {!isHost && <span style={{ fontSize: 13, color: C.faint }}>L'hôte relance la partie…</span>}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ══════════════════ QUESTION / RÉVÉLATION ══════════════════
  const reveal = game.phase === "reveal";
  const cat = q?.cat ?? "";

  // Libellé de la bonne réponse (révélation).
  const correctLabel =
    q?.type === "mcq" ? (game.correctChoice != null ? q.choices?.[game.correctChoice] : null)
    : q?.type === "truefalse" ? (game.correctBool == null ? null : game.correctBool ? "Vrai" : "Faux")
    : game.correctText;

  const fastest = reveal ? [...game.ranking].filter((r) => r.gained > 0).sort((a, b) => b.gained - a.gained)[0] : undefined;

  const progressTop = reveal
    ? `linear-gradient(90deg,transparent,${C.mint} 5%,${C.mint} 95%,transparent)`
    : `linear-gradient(90deg,transparent,${C.gold} 5%,${C.gold} ${barPct}%,rgba(255,194,75,0) ${barPct + 1}%)`;

  return (
    <main style={shell}>
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <div className="bmb-wrap" style={card}>
        <Aurora tint={reveal ? "rgba(70,224,176,.12)" : "rgba(255,194,75,.10)"} tint2={reveal ? "rgba(70,224,176,.06)" : "rgba(139,125,246,.12)"} />
        {Sidebar}

        <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ height: 3, background: progressTop }} />

          {/* En-tête */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px", gap: 12 }}>
            {reveal ? (
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.mint }}>Bonne réponse</span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.faint }}>Question {game.index + 1}</span>
                {cat && (
                  <span style={{ padding: "5px 10px", borderRadius: 8, background: hexA(C.violet, 0.14), boxShadow: `inset 0 0 0 1px ${hexA(C.violet, 0.45)}`, fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: C.violet, whiteSpace: "nowrap" }}>{cat}</span>
                )}
              </span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {reveal ? (
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.faint }}>Question suivante…</span>
              ) : (
                <SoundToggle />
              )}
            </div>
          </div>

          {reveal ? (
            /* ── 4e — Révélation ── */
            <>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 30, padding: "0 40px" }}>
                {q && <span style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.15, color: C.muted, textWrap: "pretty" as CSSProperties["textWrap"] }}>{q.prompt}</span>}
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <span style={{ display: "grid", placeItems: "center", width: 54, height: 54, flex: "none", borderRadius: 16, background: C.mint, color: C.ink }}>
                    <svg width="28" height="28" viewBox="0 0 256 256" fill="currentColor" aria-hidden><path d="M229.66 77.66l-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69L218.34 66.34a8 8 0 0 1 11.32 11.32" /></svg>
                  </span>
                  <span style={{ fontFamily: DISPLAY, fontSize: 62, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1, color: C.mint }}>{correctLabel ?? "—"}</span>
                </div>
              </div>
              <div style={{ padding: "0 40px 40px", display: "flex", alignItems: "stretch", gap: 16, flexWrap: "wrap" }}>
                {/* Ton résultat */}
                <div style={{ flex: 1, minWidth: 240, display: "flex", alignItems: "center", gap: 16, padding: "22px 26px", borderRadius: 18, background: C.ink, boxShadow: `0 0 0 1px ${game.yourCorrect ? hexA(C.mint, 0.55) : C.line}` }}>
                  {you && <Avatar name={game.ranking.find((r) => r.id === you)?.name ?? "?"} color={game.ranking.find((r) => r.id === you)?.color ?? C.violet} avatar={game.ranking.find((r) => r.id === you)?.avatar} size={26} />}
                  {game.yourCorrect ? (
                    <>
                      <span style={{ flex: 1, fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, color: C.mint }}>Bravo !</span>
                      <span style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 800, color: C.gold }}>+{game.yourGained ?? 0}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: C.faint }}>{answered ? "Raté cette fois…" : "Pas de réponse"}</span>
                      <span style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 800, color: C.faint }}>+0</span>
                    </>
                  )}
                </div>
                {fastest && (
                  <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14, padding: "22px 26px", borderRadius: 18, background: C.ink, boxShadow: `0 0 0 1px ${C.line}` }}>
                    <span style={{ fontSize: 15, lineHeight: 1 }}>⚡</span>
                    <span style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, color: C.gold }}>{fastest.name}</span>
                    <span style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 800, color: C.mint }}>+{fastest.gained}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── 4a/4b/4c/4d — Question ── */
            <>
              <div style={{ flex: q?.type === "truefalse" ? 1 : "none", display: "flex", flexDirection: "column", justifyContent: "center", gap: 26, padding: "8px 40px 0" }}>
                <span style={{ fontFamily: DISPLAY, fontSize: q?.type === "truefalse" ? 48 : 44, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1, color: answered ? C.muted : C.text, textWrap: "pretty" as CSSProperties["textWrap"] }}>
                  {q?.prompt}
                </span>
                {/* Chrono en barre sous la question */}
                {secs != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ flex: 1, height: 6, borderRadius: 99, background: C.lineFaint, overflow: "hidden" }}>
                      <span style={{ display: "block", width: `${Math.round(remain * 100)}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg,${C.orange},${C.gold})`, transition: "width .3s linear" }} />
                    </span>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, letterSpacing: ".06em", color: secs <= 5 ? C.pink : C.gold }}>{secs}s</span>
                  </div>
                )}
              </div>

              {/* Zone de réponse */}
              <div style={{ flex: q?.type === "truefalse" ? "none" : 1, display: "flex", flexDirection: "column", justifyContent: q?.type === "truefalse" ? "flex-end" : "center", padding: "26px 40px 40px" }}>
                {/* Survie : éliminé → spectateur, plus de réponse possible */}
                {game.yourEliminated && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "36px 24px", borderRadius: 18, background: C.surface, boxShadow: `0 0 0 1px ${C.line}` }}>
                    <span style={{ fontSize: 32 }}>💀</span>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, color: C.text }}>Éliminé</span>
                    <span style={{ fontSize: 14, color: C.muted, textAlign: "center" }}>Tu as épuisé tes 3 vies. Tu regardes la fin de la partie en spectateur.</span>
                  </div>
                )}
                {/* QCM */}
                {!game.yourEliminated && q?.type === "mcq" && q.choices && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {q.choices.map((choice, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const picked = game.yourAnswer === i;
                      if (answered) {
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 24px", borderRadius: 16, fontSize: 19, fontWeight: picked ? 600 : 500, background: picked ? hexA(C.gold, 0.12) : C.surface, color: picked ? C.text : C.dim, boxShadow: picked ? `0 0 0 2px ${hexA(C.gold, 0.65)}, 0 0 40px -20px ${hexA(C.gold, 0.9)}` : `0 0 0 1px ${C.lineFaint}` }}>
                            <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, flex: "none", borderRadius: 9, fontFamily: DISPLAY, fontSize: 13, fontWeight: 700, ...(picked ? { background: C.gold, color: C.ink } : { color: C.dim, boxShadow: `inset 0 0 0 1px ${C.line}` }) }}>{letter}</span>
                            <span style={{ flex: 1 }}>{choice}</span>
                            {picked && <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: C.gold }}>ton choix</span>}
                          </div>
                        );
                      }
                      return (
                        <button
                          key={i}
                          className="qz-tile"
                          onClick={() => room.quizAnswer(i)}
                          style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 24px", border: "none", borderRadius: 16, background: C.surface, color: C.text, fontFamily: BODY, fontSize: 19, fontWeight: 500, textAlign: "left", cursor: "pointer", boxShadow: `0 0 0 1px ${C.line}, 0 4px 0 ${C.lineFaint}` }}
                        >
                          <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, flex: "none", borderRadius: 9, fontFamily: DISPLAY, fontSize: 13, fontWeight: 700, color: C.muted, boxShadow: `inset 0 0 0 1px ${C.dim}` }}>{letter}</span>
                          <span>{choice}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Vrai / Faux */}
                {!game.yourEliminated && q?.type === "truefalse" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {[{ v: true, label: "Vrai", col: C.mint, sh: C.mintSh }, { v: false, label: "Faux", col: C.pink, sh: C.pinkSh }].map(({ v, label, col, sh }) => {
                      const picked = game.yourAnswer === v;
                      if (answered) {
                        return (
                          <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 30, borderRadius: 18, fontFamily: DISPLAY, fontSize: 30, fontWeight: 800, background: hexA(col, picked ? 0.14 : 0.05), color: picked ? col : C.dim, boxShadow: picked ? `0 0 0 2px ${hexA(col, 0.65)}` : `0 0 0 1px ${C.lineFaint}`, opacity: picked ? 1 : 0.6 }}>{label}</div>
                        );
                      }
                      return (
                        <button
                          key={label}
                          className={v ? "qz-tf qz-tf-t" : "qz-tf qz-tf-f"}
                          onClick={() => room.quizAnswer(v)}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 30, border: "none", borderRadius: 18, background: hexA(col, 0.1), color: col, fontFamily: DISPLAY, fontSize: 30, fontWeight: 800, cursor: "pointer", boxShadow: `0 0 0 1px ${hexA(col, 0.45)}, 0 5px 0 ${sh}` }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Réponse libre — plaque de saisie de la Bombe */}
                {!game.yourEliminated && q?.type === "free" && (
                  answered ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "24px 28px", borderRadius: 18, background: C.ink, boxShadow: `0 0 0 2px ${hexA(C.mint, 0.5)}` }}>
                      <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, flex: "none", borderRadius: 10, background: C.mint, color: C.ink }}>
                        <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden><path d="M229.66 77.66l-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69L218.34 66.34a8 8 0 0 1 11.32 11.32" /></svg>
                      </span>
                      <span style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, color: C.mint }}>Réponse envoyée</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", padding: "18px 28px", borderRadius: 18, background: C.ink, boxShadow: `0 0 0 2px ${hexA(C.gold, 0.5)}, inset 0 1px 0 rgba(243,238,255,.04), 0 20px 44px -28px rgba(0,0,0,.9)` }}>
                        <input
                          className="qz-input"
                          value={freeText}
                          onChange={(e) => setFreeText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && freeText.trim() && room.quizAnswer(freeText.trim())}
                          autoFocus
                          autoComplete="off"
                          placeholder="Ta réponse…"
                          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: C.text, fontFamily: DISPLAY, fontSize: 40, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.2, caretColor: C.gold }}
                        />
                      </div>
                      <button
                        className="qz-gold"
                        onClick={() => freeText.trim() && room.quizAnswer(freeText.trim())}
                        style={{ flex: "none", border: "none", borderRadius: 14, padding: "20px 34px", fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, lineHeight: 1, background: C.gold, color: C.ink, cursor: "pointer", boxShadow: `0 5px 0 ${C.goldSh}, 0 10px 18px -8px rgba(0,0,0,.6)` }}
                      >
                        Valider
                      </button>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

const btnGhost: CSSProperties = { flex: "none", border: `1px solid ${C.line}`, background: "transparent", color: C.muted, fontFamily: BODY, fontSize: 14, padding: "13px 22px", borderRadius: 12, cursor: "pointer" };
const btnGold: CSSProperties = { flex: "none", border: "none", borderRadius: 14, padding: "15px 30px", fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, lineHeight: 1, background: C.gold, color: C.ink, cursor: "pointer", boxShadow: `0 5px 0 ${C.goldSh}, 0 10px 18px -8px rgba(0,0,0,.6)` };
