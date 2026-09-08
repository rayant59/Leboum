"use client";

// ── Kit d'identité « LeBoum » ───────────────────────────────────────────────
// Primitives partagées par les vues de jeu (Bombe/Quiz/Reco déjà refaits) :
// palette, polices, aurores de fond, rail joueurs, chrono. Câblage neutre —
// aucun état de jeu ici, seulement de la présentation.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";

export const LB = {
  bg: "#14102A",
  aside: "rgba(28,22,54,.72)",
  ink: "#0E0B1A",
  surface: "#1C1636",
  raised: "#251C45",
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

export const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
export const MONO = "'Bricolage Grotesque', system-ui, sans-serif";
export const BODY = "'Inter', system-ui, sans-serif";

export function hexA(hex: string, a: number) {
  const h = String(hex || "#FFC24B").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Chrono partagé — renvoie les secondes restantes (arrondi sup.) ou null.
export function useCountdown(deadline: number | null, now: () => number, ms = false) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);
  if (deadline == null) return null;
  const rem = Math.max(0, (deadline - now()) / 1000);
  return ms ? rem : Math.ceil(rem);
}

// Aurores animées de fond (keyframes globales bmbAuroraA/B).
export function Aurora({ tint = "rgba(255,194,75,.10)", tint2 = "rgba(139,125,246,.12)" }: { tint?: string; tint2?: string }) {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div data-bmb-anim style={{ position: "absolute", top: "-18%", left: "36%", width: 520, height: 520, borderRadius: "50%", filter: "blur(84px)", background: `radial-gradient(circle, ${tint}, transparent 62%)`, animation: "bmbAuroraA 19s ease-in-out infinite" }} />
      <div data-bmb-anim style={{ position: "absolute", bottom: "-16%", right: "2%", width: 440, height: 440, borderRadius: "50%", filter: "blur(84px)", background: `radial-gradient(circle, ${tint2}, transparent 62%)`, animation: "bmbAuroraB 24s ease-in-out infinite" }} />
    </div>
  );
}

// ── Rail joueurs ────────────────────────────────────────────────────────────
export type RailRow = {
  id: string; name: string; color: string; avatar?: string | null;
  you?: boolean; accent?: string; badge?: { text: string; color: string };
  meta?: { text: string; color: string }; score?: string; rank?: number;
};

export function Rail({ kicker, heading, sub, rows, foot }: { kicker: string; heading: string; sub: string; rows: RailRow[]; foot?: ReactNode }) {
  return (
    <aside className="lb-rail" style={{ position: "relative", width: 296, flex: "none", zIndex: 1, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 18, padding: "24px 20px", background: LB.aside, borderRight: `1px solid ${LB.line}`, overflowY: "auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>{kicker}</span>
        <span style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.1 }}>{heading}</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: LB.faint }}>{sub}</span>
      </div>
      <div style={{ height: 1, flex: "none", background: "linear-gradient(90deg,transparent,rgba(243,238,255,.14) 18%,rgba(243,238,255,.14) 82%,transparent)" }} />
      <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => {
          const ac = r.accent;
          return (
            <div key={r.id} style={{
              position: "relative", display: "flex", alignItems: "center", gap: 12,
              padding: ac ? "12px 14px 12px 16px" : "12px 14px", borderRadius: 14,
              background: ac ? hexA(ac, 0.1) : "transparent",
              boxShadow: ac ? `0 0 0 1px ${hexA(ac, 0.55)}, 0 0 26px -12px ${hexA(ac, 0.9)}` : `0 0 0 1px ${LB.line}`,
            }}>
              {ac && <span style={{ position: "absolute", left: 0, top: 13, bottom: 13, width: 3, borderRadius: 3, background: ac }} />}
              {r.rank != null && <span style={{ flex: "none", width: 14, fontFamily: DISPLAY, fontWeight: 700, fontSize: 12, color: r.rank === 1 ? LB.gold : LB.faint }}>{r.rank}</span>}
              <Avatar name={r.name} color={r.color} avatar={r.avatar} size={34} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.name}{r.you && <span style={{ color: LB.faint, fontWeight: 400 }}> · toi</span>}
                </span>
                {r.meta && <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, color: r.meta.color }}>{r.meta.text}</span>}
              </span>
              {r.badge && (
                <span style={{ flex: "none", marginLeft: 6, whiteSpace: "nowrap", fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: r.badge.color }}>{r.badge.text}</span>
              )}
              {r.score && (
                <span style={{ flex: "none", fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: r.rank === 1 ? LB.gold : LB.muted }}>{r.score}</span>
              )}
            </div>
          );
        })}
      </div>
      {foot && <div style={{ marginTop: "auto", paddingTop: 6 }}>{foot}</div>}
    </aside>
  );
}

// Cadre général : shell plein écran + carte flex avec aurores.
export const lbShell: CSSProperties = { minHeight: "100dvh", background: LB.bg, color: LB.text, fontFamily: BODY, display: "flex", flexDirection: "column" };
export const lbCard: CSSProperties = { position: "relative", display: "flex", flex: 1, minHeight: 0, overflow: "hidden" };

export const lbGoldBtn: CSSProperties = { flex: "none", border: "none", borderRadius: 14, padding: "16px 30px", fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, lineHeight: 1, background: LB.gold, color: LB.ink, cursor: "pointer", boxShadow: `0 5px 0 ${LB.goldSh}, 0 10px 18px -8px rgba(0,0,0,.6)` };
export const lbGhostBtn: CSSProperties = { flex: "none", border: `1px solid ${LB.line}`, background: "transparent", color: LB.muted, fontFamily: BODY, fontSize: 14, padding: "13px 22px", borderRadius: 12, cursor: "pointer" };

// Barre d'accent 3px en haut de la zone centrale.
export function topBar(color: string, pct = 95): CSSProperties {
  return { height: 3, flex: "none", background: `linear-gradient(90deg,transparent,${color} 5%,${color} ${pct}%,${hexA(color, 0)} ${Math.min(96, pct + 1)}%)` };
}

export const LB_SCOPED_CSS = `
.lb-scope button.lb-gold{transition:transform .06s ease,box-shadow .12s ease,filter .12s ease}
.lb-scope button.lb-gold:hover{filter:brightness(1.04)}
.lb-scope button.lb-gold:active{transform:translateY(4px);box-shadow:0 1px 0 ${LB.goldSh} !important}
.lb-scope button.lb-ghost{transition:border-color .12s ease,color .12s ease}
.lb-scope button.lb-ghost:hover{border-color:${LB.gold};color:${LB.gold}}
.lb-scope .lb-tile{transition:box-shadow .12s ease,transform .06s ease}
.lb-scope .lb-tile:hover{box-shadow:0 0 0 1px ${hexA(LB.gold, 0.6)}, 0 4px 0 ${LB.lineFaint}}
.lb-scope .lb-tile:active{transform:translateY(3px)}
.lb-scope input.lb-input::placeholder{color:${LB.dim};opacity:1}
@media (max-width:899px){
  .lb-scope .lb-rail{display:none}
  .lb-scope .lb-mobilehead{display:flex}
  .lb-scope .lb-pad{padding-left:18px !important;padding-right:18px !important}
}
@media (min-width:900px){ .lb-scope .lb-mobilehead{display:none} }
`;
