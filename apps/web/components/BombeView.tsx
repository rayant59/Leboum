"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BOMBE_ALPHABET } from "@subtitles-party/shared";
import type { BombePublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { isSoundOn, setSoundOn, playSound } from "@/lib/sound";
import {
  preloadBombeSounds, playBombe, playTouche,
  startChrono, stopChrono, playCountdown, stopBombeTimers,
} from "@/lib/bombeSound";

// ── Palette « LeBoum » (identité or / menthe / rose) ────────────────────────
const C = {
  bg: "#14102A",
  aside: "rgba(28,22,54,.72)",
  ink: "#0E0B1A",
  line: "#332A5A",
  lineFaint: "#241D45",
  text: "#F3EEFF",
  muted: "#A79FC7",
  faint: "#6E6796",
  dim: "#4A4370",
  gold: "#FFC24B",
  goldSh: "#B47F16",
  mint: "#46E0B0",
  pink: "#FF4D8D",
  fuse: "#FF8A3D",
  violet: "#8B7DF6",
};
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const MONO = "'Bricolage Grotesque', system-ui, sans-serif";
const BODY = "'Inter', system-ui, sans-serif";
const RING = 112;
const RING_C = 2 * Math.PI * RING; // ≈ 703.7

function initials(name: string) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

/** Mèche calée sur la VRAIE échéance : la bombe explose pile au bout. */
function useFuse(game: BombePublic, serverNow: () => number) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 80);
    return () => clearInterval(id);
  }, []);
  if (game.phase !== "playing" || game.deadline == null) return { frac: 0, secs: 0 };
  const now = serverNow();
  const total = Math.max(1, game.deadline - game.turnStartedAt);
  const frac = Math.max(0, Math.min(1, (now - game.turnStartedAt) / total));
  const secs = Math.max(0, (game.deadline - now) / 1000);
  return { frac, secs };
}

// Avatar carré à initiales.
function Plate({ name, color, size = 34, dim = false }: { name: string; color?: string; size?: number; dim?: boolean }) {
  return (
    <span
      style={{
        display: "grid", placeItems: "center", width: size, height: size, flex: "none",
        borderRadius: size >= 60 ? 22 : 10, background: dim ? C.dim : color || C.violet,
        fontFamily: DISPLAY, fontWeight: 700, fontSize: size >= 60 ? 32 : size >= 30 ? 12 : 10,
        color: C.ink,
      }}
    >
      {initials(name)}
    </span>
  );
}

function Hearts({ lives, max }: { lives: number; max: number }) {
  if (max > 6) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>❤️</span>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, color: C.faint }}>×{lives}</span>
      </span>
    );
  }
  return (
    <>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ fontSize: 14, lineHeight: 1, opacity: i < lives ? 1 : 0.28, filter: i < lives ? "none" : "grayscale(1)" }}>❤️</span>
      ))}
    </>
  );
}

// Aurores animées en fond.
function Aurora({ tint = "rgba(255,138,61,.13)", tint2 = "rgba(255,77,141,.10)" }: { tint?: string; tint2?: string }) {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div data-bmb-anim style={{ position: "absolute", top: "-18%", left: "34%", width: 520, height: 520, borderRadius: "50%", filter: "blur(80px)", background: `radial-gradient(circle, ${tint}, transparent 62%)`, animation: "bmbAuroraA 18s ease-in-out infinite" }} />
      <div data-bmb-anim style={{ position: "absolute", bottom: "-16%", right: "4%", width: 460, height: 460, borderRadius: "50%", filter: "blur(84px)", background: `radial-gradient(circle, ${tint2}, transparent 62%)`, animation: "bmbAuroraB 23s ease-in-out infinite" }} />
    </div>
  );
}

// Bombe (anneau + syllabe).
function Bomb({ syllable, secs, frac, color, exploded }: { syllable: string; secs: number; frac: number; color: string; exploded: boolean }) {
  const off = RING_C * frac;
  return (
    <div style={{ position: "relative", width: 238, height: 238, display: "grid", placeItems: "center" }}>
      {exploded ? (
        <>
          <div data-bmb-anim style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: `0 0 0 3px ${C.pink}b3`, animation: "bmbBlast .9s ease-out infinite" }} />
          <div style={{ position: "absolute", inset: 22, borderRadius: "50%", background: `radial-gradient(circle, rgba(255,77,141,.28), transparent 68%)` }} />
          <svg width="238" height="238" viewBox="0 0 238 238" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
            <circle cx="119" cy="119" r={RING} fill="none" stroke="rgba(255,77,141,.35)" strokeWidth="6" strokeDasharray="14 24" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 32, lineHeight: 1 }}>💥</span>
            <span style={{ fontFamily: DISPLAY, fontSize: 44, fontWeight: 800, lineHeight: 1, color: C.pink }}>0s</span>
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: ".16em", color: C.muted }}>{syllable}</span>
          </div>
        </>
      ) : (
        <>
          <svg width="238" height="238" viewBox="0 0 238 238" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
            <circle cx="119" cy="119" r={RING} fill="none" stroke={C.lineFaint} strokeWidth="6" />
            <circle cx="119" cy="119" r={RING} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={off} />
          </svg>
          <div data-bmb-anim style={{ position: "absolute", inset: 26, borderRadius: "50%", background: `radial-gradient(circle at 50% 42%, ${color}33, transparent 70%)`, animation: "bmbFuseGlow 1.1s ease-in-out infinite" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>💣</span>
            <span style={{ fontFamily: DISPLAY, fontSize: 62, fontWeight: 800, letterSpacing: ".05em", lineHeight: 1, textShadow: `0 2px 20px ${color}80` }}>{syllable.toUpperCase()}</span>
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: ".14em", color }}>{Math.ceil(secs)}s</span>
          </div>
        </>
      )}
    </div>
  );
}

// Surligne la syllabe dans le texte tapé.
function Highlighted({ text, syllable, tint }: { text: string; syllable: string; tint: string }) {
  const t = text || "";
  const idx = t.toLowerCase().indexOf(syllable.toLowerCase());
  if (idx < 0 || !syllable) return <span>{t}</span>;
  return (
    <>
      <span>{t.slice(0, idx)}</span>
      <span style={{ color: tint }}>{t.slice(idx, idx + syllable.length)}</span>
      <span>{t.slice(idx + syllable.length)}</span>
    </>
  );
}

function Caret({ tint }: { tint: string }) {
  return <span data-bmb-anim style={{ display: "inline-block", width: 4, height: 44, marginLeft: 7, verticalAlign: -6, background: tint, animation: "bmbCaret 1.05s step-end infinite" }} />;
}

function SonButton() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(isSoundOn()), []);
  return (
    <button
      onClick={() => { const n = !on; setSoundOn(n); setOn(n); if (!n) stopBombeTimers(); }}
      aria-label={on ? "Couper le son" : "Activer le son"}
      title={on ? "Couper le son" : "Activer le son"}
      style={{ display: "grid", placeItems: "center", width: 36, height: 36, border: `1px solid ${C.line}`, background: "transparent", color: on ? C.gold : C.faint, borderRadius: 10, cursor: "pointer" }}
    >
      <svg width="17" height="17" viewBox="0 0 256 256" fill="currentColor" aria-hidden>
        <path d="M155.51 24.81a8 8 0 0 0-8.42.88L77.25 80H32a16 16 0 0 0-16 16v64a16 16 0 0 0 16 16h45.25l69.84 54.31A8 8 0 0 0 160 224V32a8 8 0 0 0-4.49-7.19M32 96h40v64H32Z" />
        {on ? (
          <path d="M208 128a39.94 39.94 0 0 1-10 26.46 8 8 0 0 1-12-10.58 24 24 0 0 0 0-31.72 8 8 0 1 1 12-10.58A39.94 39.94 0 0 1 208 128m40 0a79.9 79.9 0 0 1-20.37 53.34 8 8 0 0 1-11.92-10.67 64 64 0 0 0 0-85.33 8 8 0 1 1 11.92-10.67A79.83 79.83 0 0 1 248 128" />
        ) : (
          <path d="M231.6 208a8 8 0 0 1-11.31 0L192 179.31l-28.28 28.28a8 8 0 0 1-11.32-11.31L180.69 168l-28.29-28.28a8 8 0 0 1 11.32-11.32L192 156.69l28.29-28.29a8 8 0 0 1 11.31 11.32L203.31 168l28.29 28.29a8 8 0 0 1 0 11.31" />
        )}
      </svg>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export function BombeView({ room }: { room: UseRoom }) {
  const game = room.game as BombePublic;
  const you = room.you;
  const isHost = room.state?.hostId === you;
  const fuse = useFuse(game, room.serverNow);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastTypedRef = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const byId = new Map(game.players.map((p) => [p.id, p]));
  const nameOf = (id: string | null) => (id ? byId.get(id)?.name ?? "?" : "?");
  const colorOf = (id: string | null) => (id ? byId.get(id)?.color : undefined);

  // Live typing (throttlé) — joueur actif seulement.
  function pushTyping(v: string) {
    const val = v.trim().slice(0, 48);
    const now = Date.now();
    const elapsed = now - lastTypedRef.current;
    if (elapsed >= 120) { lastTypedRef.current = now; room.sendBombeTyping(val); }
    else {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => { lastTypedRef.current = Date.now(); room.sendBombeTyping(val); }, 120 - elapsed);
    }
  }
  function onType(v: string) {
    const prev = text;
    setText(v);
    if (room.error) room.clearError();
    if (game.youAreCurrent && game.phase === "playing") {
      if (v.length > prev.length) playTouche();
      else if (v.length < prev.length) playBombe("effacer", 0.8);
    }
    if (game.youAreCurrent) pushTyping(v);
  }
  function send() {
    const t = text.trim();
    if (!t) return;
    room.bombeSubmit(t);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    lastTypedRef.current = Date.now();
    room.sendBombeTyping("");
  }

  // Reset input au changement de tour + refocus.
  const turnKey = `${game.currentId}|${game.syllable}|${game.usedCount}`;
  const prevTurn = useRef(turnKey);
  useEffect(() => {
    if (prevTurn.current !== turnKey) {
      prevTurn.current = turnKey;
      setText("");
      room.clearError();
      if (game.youAreCurrent) setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [turnKey, game.youAreCurrent, room]);

  // ── Sons ──────────────────────────────────────────────────────────────────
  useEffect(() => { preloadBombeSounds(); return () => stopBombeTimers(); }, []);

  // Décompte de départ : tic sur les 3 dernières secondes.
  const cdTick = useRef(-1);
  useEffect(() => {
    if (game.phase !== "countdown" || game.deadline == null) return;
    const left = Math.ceil((game.deadline - room.serverNow()) / 1000);
    if (left !== cdTick.current && left >= 1 && left <= 3) { cdTick.current = left; playSound("tick"); }
  });

  const prevCurrent = useRef<string | null>(null);
  const cdPlayed = useRef(false);
  useEffect(() => {
    const yourTurn = game.phase === "playing" && game.youAreCurrent && !game.justExploded;
    if (yourTurn && prevCurrent.current !== game.currentId) playSound("yourTurn");
    prevCurrent.current = game.currentId;
    cdPlayed.current = false;
    if (yourTurn) startChrono();
    else stopBombeTimers();
  }, [game.currentId, game.youAreCurrent, game.phase, game.justExploded]);

  const prevUsed = useRef(game.usedCount);
  useEffect(() => {
    if (game.usedCount > prevUsed.current) { playBombe("bonmot"); if (game.youAreCurrent) stopChrono(); }
    prevUsed.current = game.usedCount;
  }, [game.usedCount, game.youAreCurrent]);

  const prevErr = useRef<string | null>(null);
  useEffect(() => {
    const code = room.error?.code ?? null;
    if (code && code !== prevErr.current && game.youAreCurrent && game.phase === "playing") playBombe("mauvaismot");
    prevErr.current = code;
  }, [room.error, game.youAreCurrent, game.phase]);

  const prevExploded = useRef<string | null>(null);
  useEffect(() => {
    if (game.justExploded && game.justExploded !== prevExploded.current) { stopBombeTimers(); playBombe("explosion"); }
    prevExploded.current = game.justExploded;
  }, [game.justExploded]);

  const prevPhase = useRef(game.phase);
  useEffect(() => { if (prevPhase.current !== game.phase && game.phase === "gameover") { stopBombeTimers(); playSound("win"); } prevPhase.current = game.phase; }, [game.phase]);

  useEffect(() => {
    if (game.phase === "playing" && game.youAreCurrent && !game.justExploded && fuse.secs > 0 && fuse.secs <= 3.15 && !cdPlayed.current) {
      cdPlayed.current = true;
      stopChrono();
      playCountdown();
    }
  }, [fuse.secs, game.youAreCurrent, game.phase, game.justExploded]);

  const exploded = !!game.justExploded;
  const alive = game.ranking.filter((r) => !r.eliminated).length;

  // Barre latérale : rangées de joueurs (ordre du classement).
  function badgeFor(row: BombePublic["ranking"][number]): { text: string; color: string } | undefined {
    if (game.phase === "gameover") return undefined;
    if (exploded) {
      if (row.id === game.justExploded) return { text: "−1 vie", color: C.pink };
      if (row.id === game.currentId) return { text: "joue ensuite", color: C.gold };
      return undefined;
    }
    if (row.id === game.currentId) {
      if (row.id === you) return { text: "à toi", color: C.gold };
      return { text: "écrit", color: C.mint };
    }
    return undefined; // « dernière vie » est affiché en ligne (pas en badge)
  }

  const Sidebar = (
    <aside style={{ position: "relative", width: 296, flex: "none", display: "flex", flexDirection: "column", gap: 18, padding: "24px 20px", background: C.aside, borderRight: `1px solid ${C.line}` }} className="bmb-aside">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.faint }}>{game.phase === "gameover" ? "Classement" : "Boum Rush"}</span>
        <span style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em" }}>{game.phase === "gameover" ? "Partie terminée" : `${alive} en jeu`}</span>
        <span style={{ fontSize: 12, color: C.faint }}>{game.usedCount} mots joués{game.phase !== "gameover" && game.usedLetters.length ? "" : ""}</span>
      </div>
      <div style={{ height: 1, background: `linear-gradient(90deg,transparent,rgba(243,238,255,.14) 18%,rgba(243,238,255,.14) 82%,transparent)` }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {game.ranking.map((row, i) => (
          game.phase === "gameover" ? (
            <div key={row.id} style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: i === 0 ? "12px 14px 12px 16px" : "12px 14px", borderRadius: 14, ...(i === 0 ? { background: `${C.gold}1a`, boxShadow: `0 0 0 1px ${C.gold}8c` } : row.eliminated ? { boxShadow: `0 0 0 1px ${C.lineFaint}`, opacity: 0.5 } : { boxShadow: `0 0 0 1px ${C.line}` }) }}>
              {i === 0 && <span style={{ position: "absolute", left: 0, top: 13, bottom: 13, width: 3, borderRadius: 3, background: C.gold }} />}
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 12, color: i === 0 ? C.gold : C.faint, width: 14 }}>{i + 1}</span>
              <Plate name={row.name} color={row.color} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>{row.name}{row.id === you && <span style={{ color: C.faint, fontWeight: 400 }}> · toi</span>}</span>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: i === 0 ? C.gold : C.muted }}>{row.wordsFound}</span>
            </div>
          ) : (
            <SidebarRow key={row.id} row={row} you={you} badge={badgeFor(row)} />
          )
        ))}
      </div>
      {game.phase !== "gameover" && (
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Mots à apprendre — persistants jusqu'à la prochaine explosion. */}
          {game.exampleWords.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 13px", borderRadius: 12, background: "rgba(255,77,141,.07)", boxShadow: "inset 0 0 0 1px rgba(255,77,141,.28)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".18em", color: C.pink }}>À apprendre</span>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, color: C.faint }}>{game.exampleSyllable.toUpperCase()}</span>
              </div>
              <span style={{ fontSize: 11, color: C.faint, lineHeight: 1.35 }}>{nameOf(game.exampleVictimId)} aurait pu jouer&nbsp;:</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {game.exampleWords.map((w, i) => (
                  <span key={i} style={{ fontFamily: DISPLAY, fontSize: 13, fontWeight: 700, padding: "3px 9px", borderRadius: 8, background: "rgba(70,224,176,.10)", color: C.text, boxShadow: "inset 0 0 0 1px rgba(70,224,176,.3)" }}>
                    <Highlighted text={w} syllable={game.exampleSyllable} tint={C.mint} />
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Lettres A-V collectées. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: C.faint }}>Lettres</span>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, color: C.faint }}>{game.usedLetters.length} / {BOMBE_ALPHABET.length}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {BOMBE_ALPHABET.map((l) => {
                const on = game.usedLetters.includes(l);
                return (
                  <span key={l} style={{ display: "grid", placeItems: "center", width: 23, height: 23, borderRadius: 6, fontFamily: DISPLAY, fontSize: 11, fontWeight: 700, color: on ? C.mint : C.dim, background: on ? "rgba(70,224,176,.14)" : "transparent", boxShadow: on ? "inset 0 0 0 1px rgba(70,224,176,.5)" : "none" }}>{l}</span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </aside>
  );

  // Rangée joueur (in-game) avec vies.
  function SidebarRow({ row, you, badge }: { row: BombePublic["ranking"][number]; you: string; badge?: { text: string; color: string } }) {
    const active = !!badge;
    const tint = badge?.color ?? C.line;
    return (
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: active ? "12px 14px 12px 16px" : "12px 14px", borderRadius: 14, ...(active ? { background: `${tint}1a`, boxShadow: `0 0 0 1px ${tint}8c, 0 0 26px -12px ${tint}` } : row.eliminated ? { boxShadow: `0 0 0 1px ${C.lineFaint}`, opacity: 0.45 } : { boxShadow: `0 0 0 1px ${C.line}` }) }}>
        {active && <span style={{ position: "absolute", left: 0, top: 13, bottom: 13, width: 3, borderRadius: 3, background: tint }} />}
        <Plate name={row.name} color={row.eliminated ? C.muted : row.color} />
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, textDecoration: row.eliminated ? "line-through" : "none", textDecorationColor: C.faint }}>
            {row.name}{row.id === you && !row.eliminated && <span style={{ color: C.faint, fontWeight: 400 }}> · toi</span>}
          </span>
          {row.eliminated ? (
            <span style={{ fontSize: 11, color: C.faint }}>éliminé · {row.wordsFound} mots</span>
          ) : (
            <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
              <Hearts lives={row.lives} max={game.maxLives} />
              {/* Pas de méta en ligne quand un badge occupe déjà la droite. */}
              {!active && <span style={{ marginLeft: 6, fontFamily: MONO, fontWeight: 700, fontSize: 11, color: row.lives === 1 ? C.pink : C.faint }}>{row.lives === 1 ? "dernière vie" : `${row.wordsFound} mots`}</span>}
            </span>
          )}
        </span>
        {active && <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: tint }}>{badge!.text}</span>}
      </div>
    );
  }

  const shell: CSSProperties = { minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: BODY, display: "flex", flexDirection: "column" };
  const card: CSSProperties = { position: "relative", display: "flex", flex: 1, minHeight: 0, overflow: "hidden" };

  // ══════════════════ FIN DE PARTIE ══════════════════
  if (game.phase === "gameover") {
    const winner = game.ranking[0];
    const wLetters = game.usedLetters.length;
    return (
      <main style={shell}>
        <div className="bmb-wrap" style={{ display: "flex", ...card }}>
          <Aurora tint="rgba(255,194,75,.14)" tint2="rgba(139,125,246,.10)" />
          {Sidebar}
          <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${C.gold} 5%,${C.gold} 95%,transparent)` }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: 24 }}>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: C.faint }}>Survivant·e</span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <span style={{ boxShadow: `0 0 60px -18px ${winner?.color ?? C.violet}` }}>
                  <Plate name={winner?.name ?? "?"} color={winner?.color} size={92} />
                </span>
                <span style={{ fontFamily: DISPLAY, fontSize: 58, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1 }}>{winner?.name ?? "—"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <Stat n={winner?.wordsFound ?? 0} label="mots" />
                <div style={{ width: 1, background: `linear-gradient(180deg,transparent,rgba(243,238,255,.16),transparent)` }} />
                <Stat n={winner?.lives ?? 0} label="vies restantes" />
                <div style={{ width: 1, background: `linear-gradient(180deg,transparent,rgba(243,238,255,.16),transparent)` }} />
                <Stat n={wLetters} label="lettres" />
              </div>
            </div>
            <div style={{ padding: "0 clamp(16px,4vw,40px) 34px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "22px 26px", borderRadius: 18, background: C.ink, boxShadow: `0 0 0 1px ${C.line}, inset 0 1px 0 rgba(243,238,255,.04)` }}>
                <span style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 700 }}>Dernier mot de la partie</span>
                  <span style={{ fontSize: 13, color: C.muted }}>{game.lastWord ? <><span style={{ color: C.mint }}>{game.lastWord}</span>{game.lastWordBy ? ` — ${nameOf(game.lastWordBy)}` : ""}</> : "—"}</span>
                </span>
                {isHost && <button onClick={() => room.returnLobby()} style={btnGhost}>Salon</button>}
                {isHost && <button onClick={() => room.playAgain()} style={btnGold}>Rejouer</button>}
                {!isHost && <span style={{ fontSize: 13, color: C.faint }}>L'hôte relance la partie…</span>}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ══════════════════ DÉCOMPTE DE DÉPART ══════════════════
  if (game.phase === "countdown") {
    const left = game.deadline ? Math.max(1, Math.ceil((game.deadline - room.serverNow()) / 1000)) : 3;
    return (
      <main style={shell}>
        <div className="bmb-wrap" style={card}>
          <Aurora />
          {Sidebar}
          <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: C.faint }}>La partie démarre</span>
            <div key={left} data-bmb-anim style={{ position: "relative", width: 238, height: 238, display: "grid", placeItems: "center", animation: "bmbCountPop .5s ease-out" }}>
              <div style={{ position: "absolute", inset: 26, borderRadius: "50%", background: `radial-gradient(circle at 50% 42%, ${C.gold}33, transparent 70%)` }} />
              <span style={{ fontFamily: DISPLAY, fontSize: 120, fontWeight: 800, lineHeight: 1, color: C.gold, textShadow: `0 4px 30px ${C.gold}66` }}>{left}</span>
            </div>
            <span style={{ fontSize: 14, color: C.muted }}>Prépare-toi… 💣</span>
          </div>
        </div>
      </main>
    );
  }

  // ══════════════════ EN JEU (ton tour / tour d'un autre / explosion) ══════════════════
  const currentName = nameOf(game.currentId);
  const liveTyping = !game.youAreCurrent && room.bombeTyping && room.bombeTyping.from === game.currentId ? room.bombeTyping.text : "";
  const railColor = exploded ? C.pink : game.youAreCurrent ? C.fuse : C.mint;
  const railW = exploded ? "100%" : game.youAreCurrent ? "62%" : "26%";

  return (
    <main style={shell}>
      <div className="bmb-wrap" style={card}>
        <Aurora tint={exploded ? "rgba(255,77,141,.18)" : game.youAreCurrent ? "rgba(255,138,61,.13)" : "rgba(139,125,246,.12)"} tint2={exploded ? "rgba(255,77,141,.10)" : "rgba(255,77,141,.10)"} />
        {Sidebar}

        <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ height: 3, background: exploded ? C.pink : `linear-gradient(90deg,transparent,${railColor} 5%,${railColor} ${railW.replace("%", "")}%,${railColor}00 calc(${railW} + 1%))` }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px" }}>
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: exploded ? C.pink : C.faint }}>{exploded ? "La bombe a sauté" : "Manche en cours"}</span>
            <div style={{ display: "flex", gap: 8 }}>
              {!exploded && (
                <>
                  <SonButton />
                  {isHost && <button onClick={() => room.skipPhase()} aria-label="Passer" title="Passer le tour" style={{ display: "grid", placeItems: "center", width: 36, height: 36, border: `1px solid ${C.line}`, background: "transparent", color: C.faint, borderRadius: 10, cursor: "pointer", fontSize: 15 }}>💥</button>}
                </>
              )}
            </div>
          </div>

          {/* Bombe */}
          <div data-bmb-anim style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, animation: exploded ? "none" : "bmbTremor 1.1s ease-in-out infinite" }}>
            <Bomb syllable={game.syllable} secs={fuse.secs} frac={fuse.frac} color={railColor} exploded={exploded} />
            {!exploded && !game.youAreCurrent && (
              <span style={{ fontSize: 13, color: C.muted }}>Au tour de <span style={{ color: C.gold }}>{currentName}</span></span>
            )}
          </div>

          {/* Plaque selon l'état */}
          <div style={{ padding: "0 clamp(16px,4vw,40px) 34px", display: "flex", flexDirection: "column", gap: 12 }}>
            {exploded ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <Plate name={nameOf(game.justExploded)} color={colorOf(game.justExploded)} size={22} />
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.pink }}>{nameOf(game.justExploded)} perd une vie</span>
                  </span>
                </div>
                {/* Plaque « temps écoulé » — les mots à apprendre sont dans la barre latérale. */}
                <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "clamp(16px,3vw,24px) clamp(16px,3vw,28px)", borderRadius: 18, background: C.ink, boxShadow: `0 0 0 2px rgba(255,77,141,.6), 0 0 50px -26px rgba(255,77,141,.9)` }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: DISPLAY, fontSize: "clamp(26px,6vw,52px)", fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.2, color: C.faint }}>
                    Temps écoulé pour <span style={{ color: C.pink }}>{game.syllable.toLowerCase()}</span>
                  </span>
                  <span style={{ flex: "none", fontSize: 13, color: C.muted }}>mot incomplet</span>
                </div>
              </>
            ) : game.youAreCurrent ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <Plate name={nameOf(you)} color={colorOf(you)} size={22} />
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.gold }}>Ton mot</span>
                  </span>
                </div>
                <div onClick={() => inputRef.current?.focus()} style={{ position: "relative", display: "flex", alignItems: "center", gap: 20, padding: "clamp(16px,3vw,24px) clamp(16px,3vw,28px)", borderRadius: 18, background: C.ink, boxShadow: `0 0 0 2px ${C.gold}80, inset 0 1px 0 rgba(243,238,255,.04), 0 20px 44px -28px rgba(0,0,0,.9)`, cursor: "text" }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: DISPLAY, fontSize: "clamp(30px,6vw,52px)", fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", padding: "4px 8px 4px 0" }}>
                    {text ? <Highlighted text={text} syllable={game.syllable} tint={C.gold} /> : <span style={{ color: C.faint }}>un mot avec {game.syllable.toLowerCase()}…</span>}
                    <Caret tint={C.gold} />
                  </span>
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => onType(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                    autoFocus autoComplete="off" autoCorrect="off" spellCheck={false}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "text", border: "none", background: "transparent", color: "transparent" }}
                  />
                  <button onClick={send} style={{ flex: "none", position: "relative", zIndex: 1, border: "none", borderRadius: 14, padding: "15px clamp(18px,3vw,30px)", fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, lineHeight: 1, background: C.gold, color: C.ink, cursor: "pointer", boxShadow: `0 5px 0 ${C.goldSh}, 0 10px 18px -8px rgba(0,0,0,.6)` }}>OK</button>
                </div>
                {room.error && (
                  <span key={room.error.message} style={{ fontSize: 12, color: C.pink }}>❌ {room.error.message} <span style={{ color: C.faint }}>· le timer continue</span></span>
                )}
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <Plate name={currentName} color={colorOf(game.currentId)} size={22} />
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.mint }}>{currentName} écrit</span>
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "clamp(16px,3vw,24px) clamp(16px,3vw,28px)", borderRadius: 18, background: C.ink, boxShadow: `0 0 0 2px ${C.mint}73, inset 0 1px 0 rgba(243,238,255,.04)` }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: DISPLAY, fontSize: "clamp(28px,6vw,52px)", fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", padding: "4px 8px 4px 0", color: C.text }}>
                    {liveTyping ? <><Highlighted text={liveTyping} syllable={game.syllable} tint={C.mint} /><Caret tint={C.mint} /></> : <span style={{ color: C.faint }}>…</span>}
                  </span>
                  <span style={{ flex: "none", fontFamily: MONO, fontWeight: 700, fontSize: 12, color: C.faint }}>en direct</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 clamp(14px,3vw,26px)" }}>
      <span style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 800 }}>{n}</span>
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.faint }}>{label}</span>
    </div>
  );
}

const btnGhost: CSSProperties = { flex: "none", border: `1px solid ${C.line}`, background: "transparent", color: C.muted, fontFamily: BODY, fontSize: 14, padding: "13px 22px", borderRadius: 12, cursor: "pointer" };
const btnGold: CSSProperties = { flex: "none", border: "none", borderRadius: 14, padding: "15px 30px", fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, lineHeight: 1, background: C.gold, color: C.ink, cursor: "pointer", boxShadow: `0 5px 0 ${C.goldSh}, 0 10px 18px -8px rgba(0,0,0,.6)` };
