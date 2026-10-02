"use client";

// Kit commun des jeux « social » (Qui de nous ?, La Plus Drôle, Imposteur…) :
// palette, chrono, en-tête, grille de joueurs, écran final. Un seul endroit à
// faire évoluer pour garder une identité cohérente entre tous les modes.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { GamePlayer } from "@subtitles-party/shared";
import { gameInfo } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { ResultsScreen, type RankRow } from "@/components/ResultsScreen";
import { SoundToggle } from "@/lib/sound";

export const K = {
  bg: "#14102A",
  ink: "#0E0B1A",
  surface: "#1C1636",
  raised: "#251C45",
  line: "#332A5A",
  text: "#F3EEFF",
  muted: "#A79FC7",
  faint: "#6E6796",
  gold: "#FFC24B",
  mint: "#46E0B0",
  pink: "#FF4D8D",
  violet: "#8B7DF6",
  cyan: "#4FC3F7",
  danger: "#FF5C5C",
};
export const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
export const MONO = "'Space Mono', monospace";
export const BODY = "'Inter', system-ui, sans-serif";

export function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Secondes restantes avant `deadline` (horloge serveur), rafraîchi 5×/s. */
export function useCountdown(deadline: number | null, now: () => number): number | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (deadline == null) return;
    const id = window.setInterval(() => force((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, [deadline]);
  if (deadline == null) return null;
  return Math.max(0, Math.ceil((deadline - now()) / 1000));
}

/** Jauge de temps : se vide de gauche à droite, rougit sur la fin. */
export function TimerBar({ left, total, accent }: { left: number | null; total: number; accent: string }) {
  if (left == null) return null;
  const pct = Math.max(0, Math.min(100, (left / Math.max(1, total)) * 100));
  const hot = left <= 5;
  return (
    <div aria-label={`${left} secondes`} style={{ position: "relative", height: 8, borderRadius: 999, background: K.raised, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, width: `${pct}%`, borderRadius: 999, background: hot ? K.danger : accent, boxShadow: `0 0 14px ${hot ? K.danger : accent}`, transition: "width .25s linear, background .3s" }} />
    </div>
  );
}

/** Cadre plein écran d'un jeu social, avec aurore aux couleurs du jeu. */
export function SocialStage({ gameId, children }: { gameId: string; children: ReactNode }) {
  const accent = gameInfo(gameId).accent;
  return (
    <main style={{ position: "relative", minHeight: "100dvh", overflow: "hidden", background: `radial-gradient(120% 80% at 50% -10%, ${hexA(accent, 0.16)} 0%, ${K.bg} 46%, #0B0918 100%)`, color: K.text, fontFamily: BODY }}>
      <style>{SOCIAL_CSS}</style>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto", padding: "18px 16px 40px" }}>{children}</div>
    </main>
  );
}

const SOCIAL_CSS = `
.sk-card{transition:transform .1s cubic-bezier(.3,1.3,.5,1),box-shadow .15s ease,border-color .15s ease}
.sk-card:not(:disabled):hover{transform:translateY(-2px)}
.sk-card:not(:disabled):active{transform:translateY(2px)}
@keyframes sk-pop{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}
@keyframes sk-rise{0%{transform:translateY(14px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes sk-glow{0%,100%{box-shadow:0 0 0 2px var(--a),0 0 26px -6px var(--a)}50%{box-shadow:0 0 0 2px var(--a),0 0 44px -2px var(--a)}}
@keyframes sk-wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-2deg)}75%{transform:rotate(2deg)}}
`;

/** En-tête : nom du jeu, manche, étiquette (catégorie…), son, chrono. */
export function SocialHeader({
  gameId,
  round,
  total,
  label,
  left,
  seconds,
}: {
  gameId: string;
  round: number;
  total: number;
  label?: string;
  left: number | null;
  seconds: number;
}) {
  const g = gameInfo(gameId);
  return (
    <header style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={g.img} alt="" width={40} height={40} style={{ width: 40, height: 40, borderRadius: 12, objectFit: "cover", border: `1px solid ${hexA(g.accent, 0.45)}` }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18, lineHeight: 1.1 }}>{g.name}</div>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: K.faint }}>
            Manche {round}/{total}{label ? ` · ${label}` : ""}
          </div>
        </div>
        {left != null && (
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, minWidth: 44, textAlign: "right", color: left <= 5 ? K.danger : g.accent }}>{left}</span>
        )}
        <SoundToggle />
      </div>
      <TimerBar left={left} total={seconds} accent={g.accent} />
    </header>
  );
}

/** Typographie française : espace insécable avant ? ! : ; (pas de « ? » orphelin). */
export function nbsp(text: string): string {
  return text.replace(/ ([?!:;»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");
}

/** Grande carte de question / consigne. */
export function PromptCard({ eyebrow, children, accent }: { eyebrow?: string; children: ReactNode; accent: string }) {
  return (
    <section style={{ position: "relative", margin: "6px 0 22px", padding: "26px 22px", borderRadius: 24, border: `1px solid ${hexA(accent, 0.4)}`, background: `linear-gradient(160deg, ${hexA(accent, 0.13)}, rgba(28,22,54,.75) 60%)`, boxShadow: `0 24px 48px -30px ${hexA(accent, 0.8)}`, textAlign: "center", animation: "sk-rise .35s ease-out both" }}>
      {eyebrow && <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: accent, marginBottom: 10 }}>{eyebrow}</div>}
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "clamp(22px, 4.6vw, 34px)", lineHeight: 1.2, letterSpacing: "-.01em" }}>{children}</div>
    </section>
  );
}

/** Grille de joueurs cliquables (vote). */
export function PlayerGrid({
  players,
  you,
  accent,
  selected,
  disabledIds = [],
  onPick,
  badge,
  footer,
}: {
  players: GamePlayer[];
  you: string;
  accent: string;
  selected?: string | null;
  disabledIds?: string[];
  onPick?: (id: string) => void;
  badge?: (p: GamePlayer) => ReactNode;
  footer?: (p: GamePlayer) => ReactNode;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
      {players.map((p, i) => {
        const isSel = selected === p.id;
        const disabled = !onPick || disabledIds.includes(p.id);
        const style: CSSProperties = {
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          padding: "18px 12px 14px",
          borderRadius: 20,
          border: `1px solid ${isSel ? accent : K.line}`,
          background: isSel ? `linear-gradient(170deg, ${hexA(accent, 0.22)}, rgba(28,22,54,.8))` : "rgba(28,22,54,.7)",
          color: K.text,
          cursor: disabled ? "default" : "pointer",
          opacity: disabledIds.includes(p.id) ? 0.45 : 1,
          boxShadow: isSel ? `0 0 0 1px ${accent}, 0 18px 30px -18px ${accent}` : "0 5px 0 -1px rgba(0,0,0,.35)",
          animation: `sk-rise .3s ease-out ${(i * 0.04).toFixed(2)}s both`,
          fontFamily: BODY,
        };
        return (
          <button key={p.id} className="sk-card" style={style} disabled={disabled} onClick={() => onPick?.(p.id)} aria-pressed={isSel}>
            {badge && <span style={{ position: "absolute", top: 8, right: 8 }}>{badge(p)}</span>}
            <Avatar name={p.name} color={p.color} avatar={p.avatar} size={58} />
            <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: DISPLAY, fontWeight: 700, fontSize: 15 }}>
              {p.name}
              {p.id === you ? <span style={{ color: K.faint, fontWeight: 500 }}> (toi)</span> : null}
            </span>
            {footer?.(p)}
          </button>
        );
      })}
    </div>
  );
}

/** Pastille « +100 ». */
export function Gain({ value }: { value: number }) {
  if (!value) return null;
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: hexA(K.mint, 0.16), border: `1px solid ${hexA(K.mint, 0.5)}`, color: K.mint, fontFamily: MONO, fontWeight: 700, fontSize: 12, animation: "sk-pop .4s ease-out both" }}>+{value}</span>;
}

/** Bande d'état en bas : « 3/5 ont voté », boutons de l'hôte. */
export function StatusBar({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12, padding: "12px 16px", borderRadius: 16, border: `1px solid ${K.line}`, background: "rgba(20,16,42,.8)", color: K.muted, fontSize: 14, textAlign: "center" }}>
      {children}
    </div>
  );
}

/** Bouton « Passer » réservé à l'hôte (fait avancer la phase). */
export function HostSkip({ room, label = "Passer" }: { room: UseRoom; label?: string }) {
  const me = room.state && room.you ? room.state.players[room.you] : undefined;
  if (!me?.isHost) return null;
  return (
    <button onClick={() => room.skipPhase()} style={{ border: `1px solid ${K.line}`, background: "transparent", color: K.muted, borderRadius: 10, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
      {label} →
    </button>
  );
}

/** Écran final standard d'un jeu social : podium + distinctions. */
export function SocialFinal({
  room,
  players,
  scores,
  awards,
}: {
  room: UseRoom;
  players: GamePlayer[];
  scores: Record<string, number>;
  awards: { label: string; playerId: string; detail?: string }[];
}) {
  const ranking: RankRow[] = players
    .map((p) => ({ id: p.id, name: p.name, color: p.color, avatar: p.avatar ?? null, score: scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const me = room.state && room.you ? room.state.players[room.you] : undefined;
  return (
    <ResultsScreen ranking={ranking} you={room.you} stats={null} isHost={!!me?.isHost} onReturn={() => room.returnLobby()} onReplay={() => room.playAgain()}>
      {awards.length > 0 && (
        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 22 }}>
          {awards.map((a, i) => {
            const p = players.find((x) => x.id === a.playerId);
            if (!p) return null;
            return (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 14px 8px 8px", borderRadius: 999, border: `1px solid ${K.line}`, background: "rgba(28,22,54,.6)", animation: `sk-rise .3s ease-out ${(0.5 + i * 0.1).toFixed(2)}s both` }}>
                <Avatar name={p.name} color={p.color} avatar={p.avatar} size={28} />
                <span style={{ fontSize: 13, color: K.muted }}>
                  <b style={{ color: K.gold, fontFamily: DISPLAY }}>{a.label}</b> · {p.name}
                  {a.detail ? <span style={{ color: K.faint }}> ({a.detail})</span> : null}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </ResultsScreen>
  );
}

/** Le joueur au plus haut total d'une stat (null si tout le monde est à 0
 *  ou en cas d'égalité en tête — même règle que `bestBy` côté serveur). */
export { bestBy as topOf, plural } from "@subtitles-party/shared";
