"use client";

import { type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";

export interface RankRow {
  id: string;
  name: string;
  color: string;
  avatar?: string | null;
  score: number;
}

const GOLD = "#FFC24B", SILVER = "#C7CEDD", BRONZE = "#CD7F32";
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";

const CONFETTI: { x: number; w: number; h: number; r: number; color: string; d: number; delay: number }[] = [
  { x: 8,  w: 7, h: 11, r: 2, color: "#FFC24B", d: 5.2, delay: -0.4 },
  { x: 18, w: 7, h: 7,  r: 9, color: "#46E0B0", d: 6.4, delay: -2.1 },
  { x: 29, w: 6, h: 10, r: 2, color: "#FF4D8D", d: 5.8, delay: -3.3 },
  { x: 39, w: 8, h: 8,  r: 2, color: "#8B7DF6", d: 7.0, delay: -1.2 },
  { x: 48, w: 6, h: 6,  r: 9, color: "#4FC3F7", d: 6.0, delay: -4.5 },
  { x: 57, w: 7, h: 11, r: 2, color: "#FFC24B", d: 5.5, delay: -2.8 },
  { x: 67, w: 7, h: 7,  r: 9, color: "#FF4D8D", d: 6.8, delay: -0.9 },
  { x: 76, w: 6, h: 9,  r: 2, color: "#46E0B0", d: 6.2, delay: -3.9 },
  { x: 85, w: 8, h: 8,  r: 2, color: "#8B7DF6", d: 5.6, delay: -1.7 },
  { x: 92, w: 6, h: 10, r: 2, color: "#FFC24B", d: 7.2, delay: -5.1 },
];

export function ResultsScreen({
  ranking,
  you,
  stats,
  isHost,
  onReturn,
  onReplay,
  eyebrow = "Classement final",
  winnerText = "remporte la partie",
  returnLabel = "Retour au salon",
  replayLabel = "Rejouer",
  children,
  actions,
  endTitle = "Fin de partie\u202f!",
}: {
  ranking: RankRow[];
  you: string | null;
  stats: { fastest: string | null; brain: string | null; streak: string | null } | null;
  isHost: boolean;
  onReturn: () => void;
  onReplay: () => void;
  eyebrow?: string;
  winnerText?: string;
  returnLabel?: string;
  replayLabel?: string;
  /** Contenu additionnel sous le podium (stats de soirée…). */
  children?: ReactNode;
  /** Remplace les boutons d'hôte par défaut (ex. fin de soirée). */
  actions?: ReactNode;
  /** Titre affiché à ceux qui n'ont pas gagné. */
  endTitle?: string;
}) {
  const winner = ranking[0];
  const second = ranking[1];
  const third = ranking[2];
  const rest = ranking.slice(3);
  // Égalité en tête : on le dit plutôt que de désigner un vainqueur au hasard.
  const coLeaders = winner ? ranking.filter((r) => r.score === winner.score) : [];
  // Classement « sportif » : à égalité de points, même place (1, 1, 3).
  const places: number[] = [];
  ranking.forEach((r, i) => places.push(i > 0 && r.score === ranking[i - 1].score ? places[i - 1] : i + 1));
  const medal = (place: number) => (place === 1 ? GOLD : place === 2 ? SILVER : BRONZE);

  return (
    <div className="animate-pop" style={{ position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes rs-glow { 0%,100% { text-shadow: 0 0 22px rgba(255,194,75,.4) } 50% { text-shadow: 0 0 48px rgba(255,194,75,.85) } }
        @keyframes rs-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        @keyframes rs-crown { 0%,100% { transform: translateY(0) rotate(-3deg) } 50% { transform: translateY(-5px) rotate(3deg) } }
        @keyframes rs-pulse { 0%,100% { transform: scale(1); opacity:.9 } 50% { transform: scale(1.1); opacity:1 } }
        @keyframes rs-rays { to { transform: rotate(360deg) } }
        @keyframes rs-fall { 0% { transform: translateY(-40px) rotate(0); opacity:0 } 8% { opacity:1 } 92% { opacity:1 } 100% { transform: translateY(820px) rotate(540deg); opacity:0 } }
        @keyframes rs-rise { 0% { transform: translateY(48px); opacity:0 } 100% { transform: translateY(0); opacity:1 } }
        @keyframes rs-pop { 0% { transform: scale(.6); opacity:0 } 62% { transform: scale(1.1); opacity:1 } 100% { transform: scale(1) } }
        @keyframes rs-wave { 0% { transform: translate(-50%,-50%) scale(.2); opacity:.9 } 100% { transform: translate(-50%,-50%) scale(3.2); opacity:0 } }
        @keyframes rs-burst { 0% { transform: translate(-50%,-50%) scale(.2) rotate(-20deg); opacity:0 } 35% { opacity:1 } 100% { transform: translate(-50%,-50%) scale(1.25) rotate(8deg); opacity:0 } }
        @keyframes rs-stamp { 0% { transform: rotate(-14deg) scale(2.4); opacity:0 } 55% { transform: rotate(-9deg) scale(.92); opacity:1 } 75% { transform: rotate(-11deg) scale(1.04) } 100% { transform: rotate(-10deg) scale(1); opacity:1 } }
        @media (prefers-reduced-motion: reduce) { .rs-boom * { animation: none !important; opacity: 0 !important } }
      `}</style>

      {/* effet de victoire LeBoum : onde de choc + « BOUM ! » tamponné, pour le(s) vainqueur(s) */}
      {winner && coLeaders.some((r) => r.id === you) && (
        <div aria-hidden className="rs-boom" style={{ position: "absolute", left: "50%", top: 92, width: 0, height: 0, pointerEvents: "none" }}>
          <span style={{ position: "absolute", left: 0, top: 0, width: 120, height: 120, borderRadius: "50%", border: `3px solid ${GOLD}`, animation: "rs-wave 1.1s cubic-bezier(.1,.7,.3,1) .15s both" }} />
          <span style={{ position: "absolute", left: 0, top: 0, width: 120, height: 120, borderRadius: "50%", border: "2px solid #FF4D8D", animation: "rs-wave 1.3s cubic-bezier(.1,.7,.3,1) .35s both" }} />
          <svg width="260" height="260" viewBox="0 0 24 24" style={{ position: "absolute", left: 0, top: 0, animation: "rs-burst .9s ease-out .1s both" }}>
            <path d="m12 2 1.9 5.2L19 4.6l-2.1 5L22 12l-5.1 1.9 2.1 5.5-5.2-2.6L12 22l-1.8-5.2L5 19.4l2.1-5.5L2 12l5.1-2.4L5 4.6l5.1 2.6L12 2Z" fill="rgba(255,194,75,.22)" stroke="rgba(255,194,75,.6)" strokeWidth=".4" />
          </svg>
          <span style={{ position: "absolute", left: 58, top: -64, padding: "2px 10px", border: "3px solid #FF4D8D", borderRadius: 8, fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, letterSpacing: ".04em", color: "#FF4D8D", background: "rgba(20,16,42,.7)", whiteSpace: "nowrap", animation: "rs-stamp .5s cubic-bezier(.2,.9,.3,1.3) .55s both" }}>BOUM&nbsp;!</span>
        </div>
      )}

      {/* confettis */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {CONFETTI.map((c, i) => (
          <span key={i} style={{ position: "absolute", top: 0, left: `${c.x}%`, width: c.w, height: c.h, borderRadius: c.r, background: c.color, animation: `rs-fall ${c.d}s linear ${c.delay}s infinite` }} />
        ))}
      </div>

      {/* héros */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 14, textAlign: "center" }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 11, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "#6E6796" }}>{eyebrow}</span>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 6px 20px rgba(255,194,75,.55))", animation: "rs-float 4s ease-in-out infinite" }}>
          <path d="M6 4h12v5a6 6 0 0 1-12 0V4Z" fill="rgba(255,194,75,.16)" />
          <path d="M6 6H3.5v1.5a3 3 0 0 0 3 3" />
          <path d="M18 6h2.5v1.5a3 3 0 0 1-3 3" />
          <path d="M9.5 15.2 9 19h6l-.5-3.8" />
          <path d="M7.5 21h9" />
        </svg>
        <h1 className="font-display" style={{ margin: 0, fontSize: 44, fontWeight: 800, letterSpacing: "-.02em", color: GOLD, animation: "rs-pop .7s cubic-bezier(.2,.9,.3,1.3) both, rs-glow 3s ease-in-out .7s infinite" }}>{winner && coLeaders.some((r) => r.id === you) ? (coLeaders.length > 1 ? "Ex æquo\u202f!" : "Victoire\u202f!") : endTitle}</h1>
        {winner && (
          <p style={{ margin: 0, fontSize: 15, color: "#A79FC7" }}>
            {coLeaders.length > 1 ? (
              <><b style={{ color: "#F3EEFF" }}>{coLeaders.map((r) => r.name + (r.id === you ? " (toi)" : "")).join(" & ")}</b> à égalité en tête !</>
            ) : (
              <><b style={{ color: "#F3EEFF" }}>{winner.name}{winner.id === you ? " (toi)" : ""}</b> {winnerText}</>
            )}
          </p>
        )}
        <span style={{ marginTop: 2, borderRadius: 999, border: "1px solid #332A5A", background: "rgba(28,22,54,.5)", padding: "5px 13px", fontFamily: DISPLAY, fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#6E6796" }}>{ranking.length} joueur{ranking.length > 1 ? "s" : ""}</span>
      </div>

      {/* podium */}
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 16, marginTop: 20, maxWidth: 520, marginInline: "auto" }}>
        {second && <PodiumCol row={second} you={you} place={places[1]} color={medal(places[1])} h={96} font={30} avatar={56} rise=".2s" />}
        {winner && <PodiumCol row={winner} you={you} place={places[0]} color={medal(places[0])} h={134} font={40} avatar={74} rise=".05s" winner />}
        {third && <PodiumCol row={third} you={you} place={places[2]} color={medal(places[2])} h={76} font={28} avatar={56} rise=".32s" />}
      </div>

      {/* rangs 4+ */}
      {rest.length > 0 && (
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, marginTop: 20, maxWidth: 460, marginInline: "auto" }}>
          {rest.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 14, border: "1px solid #332A5A", background: "linear-gradient(180deg, rgba(37,28,69,.6), rgba(28,22,54,.6))" }}>
              <span style={{ width: 16, fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: "#6E6796" }}>{places[i + 3]}</span>
              <Avatar name={r.name} color={r.color} avatar={r.avatar} size={34} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: DISPLAY, fontWeight: 700, fontSize: 15 }}>{r.name}{r.id === you ? " (toi)" : ""}</span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: "#A79FC7" }}>{r.score.toLocaleString("fr-FR")}</span>
            </div>
          ))}
        </div>
      )}

      {/* super-stats */}
      {stats && (stats.fastest || stats.brain || stats.streak) && (
        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 20 }}>
          {stats.fastest && (
            <Chip value={stats.fastest} label="Plus rapide" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill={GOLD}><path d="M13 2 4 14h6l-1 8 10-13h-6l1-7z" /></svg>} />
          )}
          {stats.brain && (
            <Chip value={stats.brain} label="Le cerveau" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF4D8D" strokeWidth="1.7" strokeLinejoin="round"><path d="M9.5 4a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.5A3 3 0 0 0 7 18a2.5 2.5 0 0 0 5 .2V4.5A2 2 0 0 0 9.5 4Z" fill="rgba(255,77,141,.16)" /><path d="M14.5 4a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.5A3 3 0 0 1 17 18a2.5 2.5 0 0 1-5 .2" fill="rgba(255,77,141,.16)" /></svg>} />
          )}
          {stats.streak && (
            <Chip value={stats.streak} label="Meilleure série" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8B7DF6" strokeWidth="1.7" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" fill="rgba(139,125,246,.16)" /><circle cx="9" cy="9" r="1.4" fill="#8B7DF6" stroke="none" /><circle cx="15" cy="15" r="1.4" fill="#8B7DF6" stroke="none" /><circle cx="15" cy="9" r="1.4" fill="#8B7DF6" stroke="none" /><circle cx="9" cy="15" r="1.4" fill="#8B7DF6" stroke="none" /></svg>} />
          )}
        </div>
      )}

      {children}

      {/* actions */}
      {actions ?? (isHost && (
        <div style={{ position: "relative", display: "flex", justifyContent: "center", gap: 14, marginTop: 24 }}>
          <button onClick={onReturn} className="arc arc-sec">{returnLabel}</button>
          <button onClick={onReplay} className="arc arc-p" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 1 2.6 6.3" /><path d="M3 20v-5h5" /></svg>
            {replayLabel}
          </button>
        </div>
      ))}
    </div>
  );
}

function PodiumCol({
  row,
  you,
  place,
  color,
  h,
  font,
  avatar,
  rise,
  winner = false,
}: {
  row: RankRow;
  you: string | null;
  place: number;
  color: string;
  h: number;
  font: number;
  avatar: number;
  rise: string;
  winner?: boolean;
}) {
  return (
    <div style={{ flex: winner ? 1.14 : 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, animation: `rs-rise .6s cubic-bezier(.2,.9,.3,1.15) ${rise} both` }}>
      {winner && (
        <svg width="34" height="34" viewBox="0 0 24 24" fill={GOLD} style={{ filter: "drop-shadow(0 4px 12px rgba(255,194,75,.7))", animation: "rs-crown 3.2s ease-in-out infinite" }}>
          <path d="M3 7l4.5 3L12 4l4.5 6L21 7l-1.6 11H4.6L3 7z" />
          <circle cx="3" cy="7" r="1.4" /><circle cx="12" cy="4" r="1.5" /><circle cx="21" cy="7" r="1.4" />
        </svg>
      )}
      <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
        {winner && (
          <div aria-hidden style={{ position: "absolute", width: 196, height: 196, borderRadius: "50%", background: "repeating-conic-gradient(from 0deg, rgba(255,194,75,.22) 0deg 7deg, transparent 7deg 20deg)", WebkitMaskImage: "radial-gradient(circle, transparent 24%, #000 33%, transparent 68%)", maskImage: "radial-gradient(circle, transparent 24%, #000 33%, transparent 68%)", animation: "rs-rays 16s linear infinite", opacity: 0.75 }} />
        )}
        {winner && (
          <div aria-hidden style={{ position: "absolute", width: 118, height: 118, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,194,75,.6), rgba(255,194,75,.14) 45%, transparent 70%)", animation: "rs-pulse 1.8s ease-in-out infinite" }} />
        )}
        <span style={{ position: "relative", borderRadius: 14, boxShadow: `0 0 0 2px ${color}, 0 0 30px -8px ${color}` }}>
          <Avatar name={row.name} color={row.color} avatar={row.avatar} size={avatar} />
        </span>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: winner ? 16 : 14, color: winner ? GOLD : "#F3EEFF" }}>{row.name}{row.id === you ? " (toi)" : ""}</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: winner ? 15 : 13, color }}>{row.score.toLocaleString("fr-FR")}</div>
      </div>
      <div style={{ position: "relative", width: "100%", height: h, borderRadius: "14px 14px 0 0", background: `linear-gradient(180deg, ${color}3d, ${color}0d)`, border: `1px solid ${color}8c`, borderBottom: "none", display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: font, color, overflow: "hidden" }}>
        <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}cc, transparent)` }} />
        {place}
      </div>
    </div>
  );
}

function Chip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, border: "1px solid #332A5A", background: "rgba(28,22,54,.5)", padding: "9px 15px", fontSize: 13, color: "#A79FC7" }}>
      {icon} {label}&nbsp;: <b style={{ color: "#F3EEFF" }}>{value}</b>
    </span>
  );
}
