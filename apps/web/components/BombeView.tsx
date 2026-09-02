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

// ── Palette « Nocturne » (design fourni) ────────────────────────────────────
const C = {
  bg: "#161826",
  surface: "#232532",
  track: "#292b31",
  line: "rgba(233,233,237,.16)",
  outline: "#3f424d",
  accent: "#9184d9",
  accentT: "#b5abfc",
  accentT2: "#d2cefd",
  accentChip: "rgba(145,132,217,.16)",
  accentRing: "rgba(145,132,217,.5)",
  avatar: "#796cbf",
  danger: "#e0685e",
  text: "#e9e9ed",
  muted: "#9397ab",
  faint: "#75798c",
  dim: "#595d6c",
};
const RING_R = 109;
const RING_C = 2 * Math.PI * RING_R; // ≈ 684.9

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

// ── Avatar carré à initiales (comme le design) ──────────────────────────────
function Plate({ name, color, size = 34, dim = false }: { name: string; color?: string; size?: number; dim?: boolean }) {
  return (
    <span
      style={{
        display: "grid", placeItems: "center", width: size, height: size, flex: "none",
        borderRadius: 8, background: dim ? C.outline : color || C.avatar,
        fontSize: size >= 30 ? 13 : 10, fontWeight: 600, color: dim ? "#b2b6ca" : "#f5f4ff",
      }}
    >
      {initials(name)}
    </span>
  );
}

function Hearts({ n, max }: { n: number; max: number }) {
  if (max > 6) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}>
        <span>❤️</span>
        <span style={{ color: n <= 1 ? C.danger : C.faint, fontSize: 12 }}>×{n}</span>
      </span>
    );
  }
  return (
    <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ fontSize: 14, lineHeight: 1, opacity: i < n ? 1 : 0.28, filter: i < n ? undefined : "grayscale(1)" }}>❤️</span>
      ))}
    </span>
  );
}

// ── Liste des joueurs (sidebar + mobile) ────────────────────────────────────
function PlayerList({ game, you }: { game: BombePublic; you: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {game.ranking.map((r) => {
        const current = r.isCurrent && !r.eliminated;
        return (
          <div
            key={r.id}
            style={{
              position: "relative", display: "flex", alignItems: "center", gap: 12,
              padding: current ? "12px 14px 12px 16px" : "12px 14px",
              borderRadius: 8, background: current ? C.surface : "transparent",
              boxShadow: current
                ? `0 0 0 1px ${C.accent}, 0 0 26px -12px rgba(145,132,217,.9)`
                : r.eliminated ? `0 0 0 1px ${C.surface}` : `0 0 0 1px ${C.track}`,
              opacity: r.eliminated ? 0.45 : 1,
            }}
          >
            {current && <span style={{ position: "absolute", left: 0, top: 13, bottom: 13, width: 2, borderRadius: 2, background: C.accent }} />}
            <Plate name={r.name} color={r.color} dim={r.eliminated} />
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 500, textDecoration: r.eliminated ? "line-through" : undefined, textDecorationColor: C.faint }}>
                {r.name}{r.id === you && <span style={{ color: C.faint, fontWeight: 400 }}> · toi</span>}
              </span>
              {r.eliminated ? (
                <span style={{ fontSize: 11, color: C.faint }}>éliminé · {r.wordsFound} mot{r.wordsFound > 1 ? "s" : ""}</span>
              ) : (
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Hearts n={r.lives} max={game.maxLives} />
                  <span style={{ marginLeft: 2, fontSize: 11, color: r.lives === 1 ? C.danger : C.faint }}>
                    {r.lives === 1 ? "dernière vie" : `${r.wordsFound} mot${r.wordsFound > 1 ? "s" : ""}`}
                  </span>
                </span>
              )}
            </span>
            {current && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: C.accentT }}>à toi</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Grille des lettres A-V ───────────────────────────────────────────────────
function Letters({ used }: { used: string[] }) {
  const set = new Set(used);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".18em", color: C.faint }}>Lettres</span>
        <span style={{ fontSize: 10, color: C.faint }}>{set.size} / {BOMBE_ALPHABET.length}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {BOMBE_ALPHABET.map((l) => {
          const on = set.has(l);
          return (
            <span
              key={l}
              style={{
                display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: 4,
                fontSize: 11, fontWeight: 500,
                color: on ? C.accentT2 : C.dim,
                background: on ? C.accentChip : "transparent",
                boxShadow: on ? `inset 0 0 0 1px ${C.accentRing}` : undefined,
              }}
            >
              {l}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── La bombe (anneau + syllabe + secondes) ──────────────────────────────────
function Bomb({ syllable, secs, frac, color, exploded, tremor }: { syllable: string; secs: number; frac: number; color: string; exploded: boolean; tremor: boolean }) {
  return (
    <div style={{ position: "relative", width: 230, maxWidth: "72vw", aspectRatio: "1 / 1", display: "grid", placeItems: "center" }}>
      <svg viewBox="0 0 230 230" width="100%" height="100%" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx="115" cy="115" r={RING_R} fill="none" stroke={C.track} strokeWidth="3" />
        {exploded ? (
          <circle cx="115" cy="115" r={RING_R} fill="none" stroke="rgba(224,104,94,.35)" strokeWidth="3" strokeDasharray="14 22" />
        ) : (
          <circle
            cx="115" cy="115" r={RING_R} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={RING_C} strokeDashoffset={RING_C * frac}
            style={{ transition: "stroke-dashoffset 0.12s linear, stroke 0.3s" }}
          />
        )}
      </svg>
      {!exploded && (
        <div style={{ position: "absolute", inset: 24, borderRadius: "50%", background: `radial-gradient(circle at 50% 45%, ${color}2e, transparent 70%)`, animation: tremor ? "pulseGlow 1s ease-in-out infinite" : undefined }} />
      )}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative" }}>
        {exploded ? (
          <>
            <span style={{ fontSize: "clamp(20px,6vw,28px)", textTransform: "uppercase", letterSpacing: ".2em", color: C.danger }}>0 s</span>
            <span style={{ fontSize: "clamp(34px,10vw,64px)", fontWeight: 500, letterSpacing: ".06em", lineHeight: 1, color: C.dim }}>{(syllable || "").toUpperCase()}</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: "clamp(18px,5vw,26px)", lineHeight: 1 }}>💣</span>
            <span style={{ fontSize: "clamp(34px,10vw,64px)", fontWeight: 500, letterSpacing: ".06em", lineHeight: 1, color: C.text }}>{(syllable || "").toUpperCase()}</span>
            <span style={{ fontSize: "clamp(10px,2.4vw,12px)", textTransform: "uppercase", letterSpacing: ".2em", color }}>{Math.ceil(secs)} s</span>
          </>
        )}
      </div>
    </div>
  );
}

/** Découpe le texte pour surligner la 1re occurrence de la syllabe. */
function Highlighted({ text, syllable }: { text: string; syllable: string }) {
  const low = text.toLowerCase();
  const s = (syllable || "").toLowerCase();
  const i = s ? low.indexOf(s) : -1;
  if (i < 0) return <span style={{ color: C.text }}>{text}</span>;
  return (
    <>
      <span style={{ color: C.text }}>{text.slice(0, i)}</span>
      <span style={{ color: C.accentT }}>{text.slice(i, i + s.length)}</span>
      <span style={{ color: C.text }}>{text.slice(i + s.length)}</span>
    </>
  );
}

function SonButton() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(isSoundOn()), []);
  return (
    <button
      onClick={() => { const n = !on; setSoundOn(n); setOn(n); if (n) playSound("click"); }}
      style={{ border: `1px solid ${C.outline}`, background: "transparent", color: C.muted, fontFamily: "inherit", fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}
    >
      {on ? "🔔 Son" : "🔕 Son"}
    </button>
  );
}

export function BombeView({ room }: { room: UseRoom }) {
  const game = room.game as BombePublic;
  const you = room.you;
  const isHost = room.state?.hostId === you;
  const fuse = useFuse(game, room.serverNow);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastTypedRef = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<BombePublic["letterEvent"]>(null);

  const byId = new Map(game.players.map((p) => [p.id, p]));
  const nameOf = (id: string | null) => (id ? byId.get(id)?.name ?? "?" : "?");

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
    // Sons de frappe : clic clavier quand on ajoute, « effacer » quand on vide.
    if (game.youAreCurrent && game.phase === "playing") {
      if (v.length > prev.length) playTouche();
      else if (v.length < prev.length && v.trim().length === 0 && prev.trim().length > 0) playBombe("effacer", 0.8);
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

  // ── Sons (vrais fichiers audio pour la Bombe) ─────────────────────────────
  // Préchargement + coupe tout au démontage.
  useEffect(() => { preloadBombeSounds(); return () => stopBombeTimers(); }, []);

  // « À toi de jouer » + démarre/coupe le chronomètre stressant selon le tour.
  const prevCurrent = useRef<string | null>(null);
  const cdPlayed = useRef(false);
  useEffect(() => {
    const yourTurn = game.phase === "playing" && game.youAreCurrent && !game.justExploded;
    if (yourTurn && prevCurrent.current !== game.currentId) playSound("yourTurn");
    prevCurrent.current = game.currentId;
    // nouveau tour → on réarme le décompte des 3 s
    cdPlayed.current = false;
    if (yourTurn) startChrono();
    else stopBombeTimers();
  }, [game.currentId, game.youAreCurrent, game.phase, game.justExploded]);

  // Bon mot ! (un mot vient d'être validé par quelqu'un)
  const prevUsed = useRef(game.usedCount);
  useEffect(() => {
    if (game.usedCount > prevUsed.current) { playBombe("bonmot"); if (game.youAreCurrent) stopChrono(); }
    prevUsed.current = game.usedCount;
  }, [game.usedCount, game.youAreCurrent]);

  // Mauvais mot (le joueur courant a une erreur de saisie).
  const prevErr = useRef<string | null>(null);
  useEffect(() => {
    const code = room.error?.code ?? null;
    if (code && code !== prevErr.current && game.youAreCurrent && game.phase === "playing") playBombe("mauvaismot");
    prevErr.current = code;
  }, [room.error, game.youAreCurrent, game.phase]);

  // La bombe explose.
  const prevExploded = useRef<string | null>(null);
  useEffect(() => {
    if (game.justExploded && game.justExploded !== prevExploded.current) { stopBombeTimers(); playBombe("explosion"); }
    prevExploded.current = game.justExploded;
  }, [game.justExploded]);

  const prevPhase = useRef(game.phase);
  useEffect(() => { if (prevPhase.current !== game.phase && game.phase === "gameover") { stopBombeTimers(); playSound("win"); } prevPhase.current = game.phase; }, [game.phase]);

  // Décompte des 3 dernières secondes (une fois par tour, pour le joueur courant).
  useEffect(() => {
    if (game.phase === "playing" && game.youAreCurrent && !game.justExploded && fuse.secs > 0 && fuse.secs <= 3.15 && !cdPlayed.current) {
      cdPlayed.current = true;
      stopChrono();          // on laisse la place au décompte
      playCountdown();
    }
  }, [fuse.secs, game.youAreCurrent, game.phase, game.justExploded]);
  // Toast nouvelle lettre.
  const lastLetterAt = useRef(0);
  useEffect(() => {
    const ev = game.letterEvent;
    if (ev && ev.at !== lastLetterAt.current) {
      lastLetterAt.current = ev.at;
      setToast(ev);
      playSound(ev.gainedLife ? "youFound" : "chime");
      const t = setTimeout(() => setToast(null), 2600);
      return () => clearTimeout(t);
    }
  }, [game.letterEvent]);

  const exploded = !!game.justExploded;
  const danger = fuse.frac;
  const ringColor = exploded ? "rgba(224,104,94,.5)" : game.youAreCurrent ? C.danger : C.accent;
  const tremor = game.phase === "playing" && !exploded;
  const tremorAnim = tremor ? `tremor ${Math.max(0.32, 1.1 - danger * 0.7)}s ease-in-out infinite` : undefined;
  const currentName = nameOf(game.currentId);
  const liveTyping = !game.youAreCurrent && room.bombeTyping && room.bombeTyping.from === game.currentId ? room.bombeTyping.text : "";

  // ══════════════════ FIN DE PARTIE ══════════════════
  if (game.phase === "gameover") {
    const winner = game.ranking[0];
    return (
      <main style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:flex-row lg:gap-0 lg:p-6">
          {/* Classement */}
          <aside className="order-2 w-full lg:order-1 lg:w-72 lg:flex-none" style={{ display: "flex", flexDirection: "column", gap: 18, padding: 20, borderRadius: 14, background: C.bg, boxShadow: `0 0 0 1px ${C.track}` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: C.faint }}>Classement</span>
              <span style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-.015em" }}>Partie terminée</span>
              <span style={{ fontSize: 12, color: C.faint }}>{game.usedCount} mots joués</span>
            </div>
            <div style={{ height: 1, background: C.line }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {game.ranking.map((r, i) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, boxShadow: i === 0 ? `0 0 0 1px ${C.accent}` : `0 0 0 1px ${C.track}`, opacity: r.eliminated && i > 0 ? 0.6 : 1 }}>
                  <span style={{ width: 16, textAlign: "center", fontSize: 13, fontWeight: 600, color: i === 0 ? C.accentT : C.faint }}>{i + 1}</span>
                  <Plate name={r.name} color={r.color} size={28} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500 }}>{r.name}{r.id === you && <span style={{ color: C.faint, fontWeight: 400 }}> · toi</span>}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: i === 0 ? C.text : C.muted }}>{r.wordsFound}</span>
                </div>
              ))}
            </div>
          </aside>
          {/* Résultat */}
          <div className="order-1 flex-1 lg:order-2" style={{ display: "flex", flexDirection: "column", background: `radial-gradient(120% 85% at 50% 6%, rgba(145,132,217,.10), transparent 60%)`, borderRadius: 14 }}>
            <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${C.accent} 5%,${C.accent} 62%,rgba(145,132,217,0) 63%)` }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "40px 24px" }}>
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".2em", color: C.faint }}>{game.stats?.survivor ? "Dernier survivant" : "Fin de partie"}</span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <Plate name={winner?.name ?? ""} color={winner?.color} size={64} />
                <span style={{ fontSize: 34, fontWeight: 500, letterSpacing: "-.015em" }}>🏆 {winner?.name}{winner?.id === you ? " (toi)" : ""}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", justifyContent: "center" }}>
                <Stat n={winner?.wordsFound ?? 0} label="mots trouvés" />
                <span style={{ width: 1, height: 34, background: C.line }} />
                <Stat n={winner?.lives ?? 0} label="vies restantes" />
                <span style={{ width: 1, height: 34, background: C.line }} />
                <Stat n={game.usedLetters.length} label="lettres découvertes" />
              </div>
            </div>
            {isHost && (
              <div style={{ padding: "0 28px 30px", display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => room.returnLobby()} style={btnGhost}>Retour au salon</button>
                <button onClick={() => room.playAgain()} style={btnAccent}>Rejouer</button>
              </div>
            )}
          </div>
        </div>
        {toast && <LetterToast ev={toast} nameOf={nameOf} />}
      </main>
    );
  }

  // ══════════════════ EN JEU ══════════════════
  const sidebar = (
    <aside className="order-2 w-full lg:order-1 lg:w-72 lg:flex-none" style={{ display: "flex", flexDirection: "column", gap: 18, padding: 20, borderRadius: 14, background: C.bg, boxShadow: `0 0 0 1px ${C.track}` }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: C.faint }}>Bombe</span>
        <span style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-.015em" }}>{game.aliveCount} en jeu</span>
        <span style={{ fontSize: 12, color: C.faint }}>{game.usedCount} mots joués</span>
      </div>
      <div style={{ height: 1, background: C.line }} />
      <PlayerList game={game} you={you} />
      <div style={{ marginTop: "auto" }}><Letters used={game.usedLetters} /></div>
    </aside>
  );

  return (
    <main style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:flex-row lg:gap-0 lg:p-6">
        {sidebar}
        {/* Zone principale */}
        <div className="order-1 flex-1 lg:order-2" style={{ display: "flex", flexDirection: "column", background: exploded || game.youAreCurrent ? `radial-gradient(120% 85% at 50% 6%, rgba(224,104,94,.10), transparent 60%)` : `radial-gradient(120% 85% at 50% 6%, rgba(145,132,217,.08), transparent 60%)`, borderRadius: 14, minHeight: "70vh" }}>
          <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${ringColor} 5%,${ringColor} 62%,rgba(0,0,0,0) 63%)` }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: C.faint }}>{exploded ? "La bombe a sauté" : "Manche en cours"}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <SonButton />
              {isHost && <button onClick={() => room.skipPhase()} style={{ border: `1px solid ${C.outline}`, background: "transparent", color: C.muted, fontFamily: "inherit", fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>💥 Skip</button>}
            </div>
          </div>

          {/* Bombe */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, animation: tremorAnim }}>
            <Bomb syllable={game.syllable} secs={fuse.secs} frac={danger} color={ringColor} exploded={exploded} tremor={tremor} />
            {!exploded && !game.youAreCurrent && (
              <span style={{ fontSize: 13, color: C.muted }}>Au tour de <span style={{ color: C.accentT }}>{currentName}</span></span>
            )}
            {exploded && (
              <span style={{ fontSize: 13, color: C.faint }}>Nouvelle syllabe dans un instant…</span>
            )}
          </div>

          {/* Plaque selon l'état */}
          <div style={{ padding: "0 clamp(16px,4vw,40px) 30px", display: "flex", flexDirection: "column", gap: 12 }}>
            {exploded ? (
              <ExplosionPlate game={game} nameOf={nameOf} />
            ) : game.youAreCurrent ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <Plate name={nameOf(you)} color={byId.get(you)?.color} size={22} />
                    <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: C.accentT }}>Ton mot</span>
                  </span>
                  <span style={{ fontSize: 11, color: C.faint }}>Entrée pour valider</span>
                </div>
                <div
                  onClick={() => inputRef.current?.focus()}
                  style={{ position: "relative", display: "flex", alignItems: "center", gap: 16, padding: "clamp(14px,3vw,24px) clamp(16px,3vw,26px)", borderRadius: 14, background: C.surface, boxShadow: `0 0 0 1px ${C.accent}, inset 0 1px 0 rgba(233,233,237,.05), 0 20px 44px -28px rgba(0,0,0,.9)`, cursor: "text" }}
                >
                  <span style={{ flex: 1, minWidth: 0, fontSize: "clamp(28px,7vw,48px)", fontWeight: 500, letterSpacing: "-.02em", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden" }}>
                    {text ? <Highlighted text={text} syllable={game.syllable} /> : <span style={{ color: C.faint }}>un mot avec {game.syllable.toUpperCase()}…</span>}
                    <span style={{ display: "inline-block", width: 3, height: "0.7em", marginLeft: 6, verticalAlign: "-0.08em", background: C.accent, animation: "caretBlink 1.05s step-end infinite" }} />
                  </span>
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => onType(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                    autoFocus autoComplete="off" autoCorrect="off" spellCheck={false}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "text", border: "none", background: "transparent", color: "transparent" }}
                  />
                  <button onClick={send} style={{ flex: "none", position: "relative", zIndex: 1, border: `1px solid ${C.accent}`, background: C.accentChip, color: C.accentT2, fontFamily: "inherit", fontSize: 14, fontWeight: 500, padding: "12px clamp(16px,3vw,26px)", borderRadius: 8, cursor: "pointer" }}>Valider</button>
                </div>
                {room.error ? (
                  <span key={room.error.message} style={{ fontSize: 12, color: C.danger, animation: "shake 0.32s" }}>❌ {room.error.message} <span style={{ color: C.faint }}>· le timer continue</span></span>
                ) : (
                  <span style={{ fontSize: 12, color: C.faint }}>Doit contenir <span style={{ color: C.accentT2 }}>{game.syllable.toLowerCase()}</span> · jamais joué</span>
                )}
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <Plate name={currentName} color={byId.get(game.currentId ?? "")?.color} size={22} />
                    <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: C.accentT }}>{currentName} écrit</span>
                  </span>
                  <span style={{ fontSize: 11, color: C.faint }}>Tu regardes</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "clamp(14px,3vw,24px) clamp(16px,3vw,26px)", borderRadius: 14, background: C.surface, boxShadow: `0 0 0 1px ${C.track}` }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: "clamp(24px,6vw,44px)", fontWeight: 500, letterSpacing: "-.02em", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden" }}>
                    {liveTyping ? (
                      <>
                        <Highlighted text={liveTyping} syllable={game.syllable} />
                        <span style={{ display: "inline-block", width: 3, height: "0.7em", marginLeft: 6, verticalAlign: "-0.08em", background: C.accent, animation: "caretBlink 1.05s step-end infinite" }} />
                      </>
                    ) : (
                      <span style={{ color: C.faint }}>{currentName} réfléchit…</span>
                    )}
                  </span>
                  <span style={{ fontSize: 11, color: C.faint, flex: "none" }}>en direct</span>
                </div>
                <span style={{ fontSize: 12, color: C.faint }}>Prépare le tien : un mot avec <span style={{ color: C.accentT2 }}>{game.syllable.toLowerCase()}</span></span>
              </>
            )}
          </div>
        </div>
      </div>
      {toast && <LetterToast ev={toast} nameOf={nameOf} />}
    </main>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{ fontSize: 30, fontWeight: 500, color: C.text }}>{n}</span>
      <span style={{ fontSize: 11, color: C.faint }}>{label}</span>
    </div>
  );
}

function ExplosionPlate({ game, nameOf }: { game: BombePublic; nameOf: (id: string | null) => string }) {
  const victim = game.justExploded;
  const victimLives = victim ? game.lives[victim] ?? 0 : 0;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: C.danger }}>{nameOf(victim)} perd une vie</span>
        <span style={{ fontSize: 11, color: C.faint }}>{victimLives <= 0 ? "éliminé 💀" : `Il reste ${victimLives} vie${victimLives > 1 ? "s" : ""}`}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", borderRadius: 14, background: C.surface, boxShadow: `0 0 0 1px rgba(224,104,94,.4)` }}>
        <span style={{ flex: 1, fontSize: "clamp(22px,5vw,40px)", fontWeight: 500, color: C.dim }}>💥</span>
        <span style={{ fontSize: 12, color: C.faint }}>temps écoulé</span>
      </div>
      <span style={{ fontSize: 12, color: C.faint }}>La main passe à <span style={{ color: C.accentT2 }}>{nameOf(game.currentId)}</span></span>
    </>
  );
}

function LetterToast({ ev, nameOf }: { ev: NonNullable<BombePublic["letterEvent"]>; nameOf: (id: string | null) => string }) {
  return (
    <div style={{ position: "fixed", inset: "24px 0 auto 0", zIndex: 50, display: "flex", justifyContent: "center", pointerEvents: "none", padding: "0 16px", animation: "revealPop 0.35s ease-out" }}>
      <div style={{ borderRadius: 14, border: `1px solid ${C.accentRing}`, background: "rgba(22,24,38,0.96)", padding: "12px 20px", textAlign: "center", boxShadow: "0 12px 40px -12px rgba(145,132,217,.7)" }}>
        {ev.gainedLife ? (
          <>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.accentT }}>🔤 Nouvelle lettre ! <span style={{ color: C.danger }}>+1 ❤️</span></p>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{nameOf(ev.playerId)} découvre : <b style={{ color: C.accentT2 }}>{ev.newLetters.join(" · ")}</b></p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.accentT }}>🔤 Lettre découverte</p>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>❤️ Vie maximale · <b style={{ color: C.accentT2 }}>{ev.newLetters.join(" · ")}</b></p>
          </>
        )}
      </div>
    </div>
  );
}

const btnGhost: CSSProperties = { border: `1px solid ${C.outline}`, background: "transparent", color: C.muted, fontFamily: "inherit", fontSize: 13, padding: "10px 18px", borderRadius: 8, cursor: "pointer" };
const btnAccent: CSSProperties = { border: `1px solid ${C.accent}`, background: C.accentChip, color: C.accentT2, fontFamily: "inherit", fontSize: 13, fontWeight: 500, padding: "10px 22px", borderRadius: 8, cursor: "pointer" };
