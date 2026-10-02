"use client";

// Soirée LeBoum — composants d'interface : préparation du programme (lobby),
// suivi pendant les jeux, et grand classement de fin de soirée.

import { useState } from "react";
import { SOIREE_FORMATS, estimateMinutes, gameInfo, soireeStandings, type SoireeState } from "@subtitles-party/shared";
import { Avatar } from "@/components/Avatar";
import { ResultsScreen, type RankRow } from "@/components/ResultsScreen";

const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const MONO = "'Space Mono', monospace";
const C = { line: "#332A5A", muted: "#A79FC7", faint: "#6E6796", text: "#F3EEFF", gold: "#FFC24B", mint: "#46E0B0", deep: "#0E0B1A" };

export interface BuilderItem {
  gameId: string;
  settings: unknown;
  /** Libellé du mode / réglage (« Vitesse · 10 questions »). */
  detail: string;
}

function Thumb({ gameId, size = 40 }: { gameId: string; size?: number }) {
  const g = gameInfo(gameId);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={g.img} alt="" width={size} height={size} draggable={false} style={{ width: size, height: size, borderRadius: size * 0.28, objectFit: "cover", flex: "none", border: `1px solid ${g.accent}55` }} />
  );
}

/** Préparation du programme de soirée (hôte, dans le salon). */
export function SoireeBuilder({
  items,
  selectedName,
  onAdd,
  onRemove,
  onMoveUp,
  onClear,
  onLaunch,
  onGenerate,
  launchDisabled,
  launchHint,
}: {
  items: BuilderItem[];
  selectedName: string;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onMoveUp: (i: number) => void;
  onClear: () => void;
  onLaunch: () => void;
  /** Générateur (phase 14) : remplace le programme par une proposition. */
  onGenerate?: (formatId: string) => void;
  launchDisabled: boolean;
  launchHint: string | null;
}) {
  const minutes = estimateMinutes(items);
  const [lastFormat, setLastFormat] = useState<string | null>(null);
  return (
    <section className="mb-8 rounded-2xl border p-5" style={{ borderColor: "rgba(255,194,75,.35)", background: "linear-gradient(165deg, rgba(255,194,75,.09), rgba(28,22,54,.65) 55%)" }}>
      <div className="mb-4 flex items-start gap-3">
        <span aria-hidden style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 12, background: "rgba(255,194,75,.14)", border: "1px solid rgba(255,194,75,.4)", flex: "none" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 6h3v1.5a3 3 0 0 1-3 3M7 6H4v1.5a3 3 0 0 0 3 3" /></svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="cfg-tt">Soirée LeBoum</h2>
          <span className="cfg-sub">{items.length ? `${items.length} jeu${items.length > 1 ? "x" : ""} · ~${minutes} min · un seul classement` : "Enchaîne plusieurs jeux, un seul classement"}</span>
        </div>
        {items.length > 0 && (
          <button onClick={onClear} className="text-xs" style={{ color: C.faint, background: "none", border: "none", cursor: "pointer" }}>Vider</button>
        )}
      </div>

      {onGenerate && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: C.gold }}>Générer une soirée</span>
            {lastFormat && (
              <button onClick={() => onGenerate(lastFormat)} className="text-xs font-semibold" style={{ color: C.gold, background: "none", border: "none", cursor: "pointer" }} title="Nouveau tirage, même format">
                ↻ Autre tirage
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {SOIREE_FORMATS.map((f) => {
              const on = lastFormat === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => { setLastFormat(f.id); onGenerate(f.id); }}
                  className="rounded-xl border px-3 py-2 text-left transition-colors"
                  style={{ borderColor: on ? C.gold : C.line, background: on ? "rgba(255,194,75,.12)" : "rgba(14,11,26,.45)", cursor: "pointer" }}
                  title={f.blurb}
                >
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: on ? C.gold : C.text }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{f.blurb}</div>
                </button>
              );
            })}
          </div>
          {items.length > 0 && lastFormat && <p className="mt-2 text-xs" style={{ color: C.faint }}>Proposition modifiable : retire, réordonne ou ajoute des jeux ci-dessous.</p>}
        </div>
      )}

      {items.length > 0 ? (
        <ol className="mb-4 flex flex-col gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((it, i) => {
            const g = gameInfo(it.gameId);
            return (
              <li key={`${it.gameId}-${i}`} className="flex items-center gap-3 rounded-xl border px-3 py-2" style={{ borderColor: C.line, background: "rgba(14,11,26,.55)" }}>
                <span style={{ width: 18, fontFamily: MONO, fontWeight: 700, fontSize: 12, color: C.faint }}>{i + 1}</span>
                <Thumb gameId={it.gameId} size={36} />
                <div className="min-w-0 flex-1">
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: C.text }}>{g.name}</div>
                  <div className="truncate" style={{ fontSize: 12, color: C.muted }}>{it.detail}</div>
                </div>
                <button onClick={() => onMoveUp(i)} disabled={i === 0} aria-label="Monter" title="Monter" className="rounded-lg p-1.5 disabled:opacity-25" style={{ color: C.muted, background: "none", border: "none", cursor: "pointer" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg>
                </button>
                <button onClick={() => onRemove(i)} aria-label="Retirer" title="Retirer" className="rounded-lg p-1.5" style={{ color: C.muted, background: "none", border: "none", cursor: "pointer" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mb-4 text-sm" style={{ color: C.muted }}>
          Choisis un jeu et ses réglages plus bas, puis ajoute-le ici. Répète pour composer ta soirée : les points s'additionnent d'un jeu à l'autre.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button onClick={onAdd} className="arc arc-sec arc-block" style={{ fontSize: 14 }}>
          + Ajouter « {selectedName} »
        </button>
        {items.length > 0 && (
          <button onClick={onLaunch} disabled={launchDisabled} className={`arc arc-block ${launchDisabled ? "arc-dis" : "arc-p"}`} style={{ fontSize: 14 }}>
            Lancer la soirée · {items.length} jeu{items.length > 1 ? "x" : ""}
          </button>
        )}
      </div>
      {items.length > 0 && launchDisabled && launchHint && <p className="mt-2 text-xs" style={{ color: C.faint }}>{launchHint}</p>}
    </section>
  );
}

/** Mini-classement de la soirée (lobby & pendant les jeux). */
function Standings({ soiree, you, lastIndex, limit = 8 }: { soiree: SoireeState; you: string; lastIndex: number | null; limit?: number }) {
  const rows = soireeStandings(soiree).slice(0, limit);
  const last = lastIndex != null ? soiree.records.find((r) => r.index === lastIndex) : undefined;
  return (
    <ol className="flex flex-col gap-1.5" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {rows.map((r) => {
        const p = soiree.players[r.id];
        if (!p) return null;
        const gained = last?.points[r.id];
        return (
          <li key={r.id} className="flex items-center gap-3 rounded-xl px-3 py-1.5" style={{ background: r.id === you ? "rgba(255,194,75,.08)" : "rgba(14,11,26,.45)", border: `1px solid ${r.id === you ? "rgba(255,194,75,.35)" : C.line}` }}>
            <span style={{ width: 18, fontFamily: MONO, fontWeight: 700, fontSize: 12, color: r.place === 1 ? C.gold : C.faint }}>{r.place}</span>
            <Avatar name={p.name} color={p.color} avatar={p.avatar} size={26} />
            <span className="min-w-0 flex-1 truncate" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 14, color: C.text }}>{p.name}{r.id === you ? " (toi)" : ""}</span>
            {gained != null && <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.mint }}>+{gained}</span>}
            <span style={{ minWidth: 34, textAlign: "right", fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, color: r.place === 1 ? C.gold : C.text }}>{r.total}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Programme : jeux passés / en cours / à venir. */
function Programme({ soiree }: { soiree: SoireeState }) {
  return (
    <div className="flex flex-wrap gap-2">
      {soiree.items.map((it, i) => {
        const done = soiree.records.some((r) => r.index === i);
        const now = i === soiree.current && !soiree.finished;
        const g = gameInfo(it.gameId);
        return (
          <span key={i} className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: now ? g.accent : C.line, background: now ? `${g.accent}1a` : "transparent", color: done ? C.faint : C.text, textDecoration: done ? "line-through" : "none" }}>
            <b style={{ fontFamily: MONO, color: now ? g.accent : C.faint }}>{i + 1}</b>
            {g.name}
          </span>
        );
      })}
    </div>
  );
}

/** Dans le salon, soirée commencée mais pas finie (retour au salon en cours de route). */
export function SoireeLobbyCard({ soiree, you, isHost, onNext, onEnd }: { soiree: SoireeState; you: string; isHost: boolean; onNext: () => void; onEnd: () => void }) {
  const recorded = soiree.records.some((r) => r.index === soiree.current);
  const nextIndex = recorded ? soiree.current + 1 : soiree.current;
  const next = soiree.items[nextIndex];
  return (
    <section className="mb-8 rounded-2xl border p-5" style={{ borderColor: "rgba(255,194,75,.4)", background: "linear-gradient(165deg, rgba(255,194,75,.1), rgba(28,22,54,.7) 60%)" }}>
      <p className="eyebrow mb-1">Soirée en cours</p>
      <h2 className="cfg-tt mb-3">Jeu {Math.min(nextIndex + 1, soiree.items.length)} sur {soiree.items.length}</h2>
      <div className="mb-4"><Programme soiree={soiree} /></div>
      {soiree.records.length > 0 && <div className="mb-4"><Standings soiree={soiree} you={you} lastIndex={null} /></div>}
      {isHost ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button onClick={onEnd} className="arc arc-sec arc-block" style={{ fontSize: 14 }}>Terminer la soirée</button>
          <button onClick={onNext} className="arc arc-p arc-block" style={{ fontSize: 14 }}>{next ? `Continuer : ${gameInfo(next.gameId).name}` : "Voir le classement final"}</button>
        </div>
      ) : (
        <p className="text-sm" style={{ color: C.muted }}>L'hôte relance la suite de la soirée dans un instant.</p>
      )}
    </section>
  );
}

/** Pendant un jeu de la soirée : repère discret, puis panneau « jeu suivant » à la fin du jeu. */
export function SoireeHud({ soiree, you, isHost, gameOver, onNext }: { soiree: SoireeState; you: string; isHost: boolean; gameOver: boolean; onNext: () => void }) {
  const [open, setOpen] = useState(true);
  const idx = soiree.current;
  const total = soiree.items.length;
  const next = soiree.items[idx + 1];
  const recorded = soiree.records.some((r) => r.index === idx);
  if (!gameOver) {
    return (
      <div aria-label="Soirée LeBoum" className="hidden sm:inline-flex" style={{ position: "fixed", left: 12, bottom: "max(12px, env(safe-area-inset-bottom))", zIndex: 40, alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,194,75,.4)", background: "rgba(20,16,42,.9)", backdropFilter: "blur(6px)", fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.gold, pointerEvents: "none" }}>
        Soirée · jeu {idx + 1}/{total}
      </div>
    );
  }
  return (
    <>
      <div role="region" aria-label="Classement de la soirée" style={{ position: "fixed", right: 10, top: "max(10px, env(safe-area-inset-top))", zIndex: 45, width: "min(380px, calc(100vw - 20px))", borderRadius: 20, border: "1px solid rgba(255,194,75,.45)", background: "rgba(20,16,42,.96)", backdropFilter: "blur(10px)", boxShadow: "0 24px 60px -20px rgba(0,0,0,.9)", padding: 14, animation: "pop-in .25s ease-out both" }}>
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3" style={{ background: "none", border: "none", cursor: "pointer", color: C.text, padding: 0 }} aria-expanded={open}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.gold }}>Soirée · jeu {idx + 1}/{total} terminé</span>
          <span className="flex-1" />
          <span style={{ fontSize: 12, color: C.muted }}>{open ? "Réduire" : "Classement"}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.6" strokeLinecap="round" style={{ transform: open ? "none" : "rotate(180deg)" }}><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {open && (
          <div className="mt-3" style={{ maxHeight: "min(240px, 40vh)", overflowY: "auto" }}>
            {recorded ? <Standings soiree={soiree} you={you} lastIndex={idx} /> : <p className="text-sm" style={{ color: C.muted }}>Ce jeu ne rapporte pas de points de soirée.</p>}
          </div>
        )}
        <div className="mt-3">
          {isHost ? (
            <button onClick={onNext} className="arc arc-p arc-block" style={{ fontSize: 15 }}>
              {next ? `Jeu suivant : ${gameInfo(next.gameId).name} →` : "Classement final de la soirée →"}
            </button>
          ) : (
            <p className="text-center text-sm" style={{ color: C.muted }}>{next ? `Prochain jeu : ${gameInfo(next.gameId).name}. L'hôte lance la suite…` : "Dernier jeu terminé ! Le classement final arrive…"}</p>
          )}
        </div>
      </div>
    </>
  );
}

/** Grand final : classement de la soirée + distinctions. */
export function SoireeFinal({ soiree, you, isHost, onRematch, onEnd }: { soiree: SoireeState; you: string; isHost: boolean; onRematch: () => void; onEnd: () => void }) {
  const standings = soireeStandings(soiree);
  const ranking: RankRow[] = standings
    .map((r) => ({ ...soiree.players[r.id], score: r.total }))
    .filter((r): r is RankRow => !!r && typeof r.name === "string");
  const awards = soireeAwards(soiree);
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <ResultsScreen
        ranking={ranking}
        you={you}
        stats={null}
        isHost={isHost}
        onReturn={onEnd}
        onReplay={onRematch}
        eyebrow={`Fin de soirée · ${soiree.records.length} jeu${soiree.records.length > 1 ? "x" : ""}`}
        winnerText="remporte la soirée"
        returnLabel="Retour au salon"
        replayLabel="Revanche !"
      >
        {awards.length > 0 && (
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginTop: 24, maxWidth: 560, marginInline: "auto" }}>
            {awards.map((a, i) => {
              const p = soiree.players[a.playerId];
              if (!p) return null;
              return (
                <div key={i} className="flex items-center gap-3 rounded-2xl border px-3 py-2.5" style={{ borderColor: C.line, background: "rgba(28,22,54,.6)", animation: `pop-in .3s ease-out ${(0.6 + i * 0.12).toFixed(2)}s both` }}>
                  <Avatar name={p.name} color={p.color} avatar={p.avatar} size={34} />
                  <div className="min-w-0">
                    <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.gold }}>{a.label}</div>
                    <div className="truncate" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 14, color: C.text }}>{p.name}{a.detail ? <span style={{ fontWeight: 500, color: C.muted }}> · {a.detail}</span> : null}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!isHost && <p className="mt-6 text-center text-sm" style={{ color: C.muted }}>L'hôte peut lancer une revanche avec le même programme.</p>}
      </ResultsScreen>
    </div>
  );
}

/** Distinctions de fin de soirée : jeux gagnés + meilleures distinctions des jeux. */
export function soireeAwards(soiree: SoireeState): { label: string; playerId: string; detail?: string }[] {
  const out: { label: string; playerId: string; detail?: string }[] = [];
  const st = soireeStandings(soiree);
  const byWins = st.slice().sort((a, b) => b.wins - a.wins);
  const topWins = byWins[0];
  if (topWins && topWins.wins >= 2 && (byWins[1]?.wins ?? 0) < topWins.wins) out.push({ label: "Plus de jeux gagnés", playerId: topWins.id, detail: `${topWins.wins} victoires` });
  const seen = new Set<string>();
  for (const r of soiree.records) {
    for (const a of r.awards) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      out.push({ label: a.label, playerId: a.playerId, detail: a.detail });
    }
  }
  return out.slice(0, 6);
}
