"use client";

// Soirée LeBoum — composants d'interface : préparation du programme (lobby),
// suivi pendant les jeux, et grand classement de fin de soirée.

import { useEffect, useState } from "react";
import { SOIREE_FORMATS, SURPRISE_MAX, SURPRISE_MIN, estimateMinutes, gameInfo, playerSummary, soireeHighlights, soireeRecap, soireeStandings, type SoireePlayerSummary, type SoireeState } from "@subtitles-party/shared";
import { playSound } from "@/lib/sound";
import { Avatar } from "@/components/Avatar";
import { NeonIcon, type NeonIconName } from "@/components/NeonIcon";
import { SupportButton } from "@/components/SupportButton";
import { ResultsScreen, type RankRow } from "@/components/ResultsScreen";

const DISPLAY = "var(--font-display), system-ui, sans-serif";
const MONO = "var(--font-mono), monospace";
const C = { line: "rgb(var(--c-ink-border))", muted: "rgb(var(--c-text-muted))", faint: "rgb(var(--c-text-faint))", text: "rgb(var(--c-text))", gold: "rgb(var(--c-gold))", mint: "rgb(var(--c-mint))", deep: "rgb(var(--c-ink-deep))" };

export interface BuilderItem {
  gameId: string;
  settings: unknown;
  /** Libellé du mode / réglage (« Vitesse · 10 questions »). */
  detail: string;
  /** Jeu surprise : tiré au sort au lancement. */
  surprise?: boolean;
}

function Thumb({ gameId, size = 40 }: { gameId: string; size?: number }) {
  const g = gameInfo(gameId);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={g.img} alt="" width={size} height={size} draggable={false} style={{ width: size, height: size, borderRadius: size * 0.28, objectFit: "cover", flex: "none", border: `1px solid color-mix(in srgb, ${g.accent} 33.3%, transparent)` }} />
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
  onGenerate,
  onSurprise,
  launchDisabled,
  launchHint,
  playerCount,
  onPrune,
}: {
  items: BuilderItem[];
  selectedName: string;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onMoveUp: (i: number) => void;
  onClear: () => void;
  /** Générateur (phase 14) : remplace le programme par une proposition. */
  onGenerate?: (formatId: string) => void;
  /** Soirée surprise : `count` jeux tirés au sort au fur et à mesure. */
  onSurprise?: (count: number) => void;
  launchDisabled: boolean;
  launchHint: string | null;
  /** Joueurs connectés : un jeu hors de ses bornes sera sauté au lancement. */
  playerCount: number;
  /** Retire du programme les jeux injouables au nombre actuel de joueurs. */
  onPrune: () => void;
}) {
  const minutes = estimateMinutes(items);
  const fits = (gameId: string) => { const g = gameInfo(gameId); return playerCount >= g.minPlayers && playerCount <= g.maxPlayers; };
  const unfit = items.filter((it) => !fits(it.gameId)).length;
  const [lastFormat, setLastFormat] = useState<string | null>(null);
  const [surpriseCount, setSurpriseCount] = useState(5);
  return (
    <section className="mb-8 rounded-2xl border p-5" style={{ borderColor: "rgb(var(--c-gold) / .35)", background: "linear-gradient(165deg, rgb(var(--c-gold) / .09), rgb(var(--c-ink-surface) / .65) 55%)" }}>
      <div className="mb-4 flex items-start gap-3">
        <NeonIcon name="trophy" size={44} style={{ marginTop: -4, filter: "drop-shadow(0 4px 12px rgb(var(--c-gold) / .35))" }} />
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
                  className="rounded-full border px-3 py-1.5 transition-colors"
                  style={{ borderColor: on ? C.gold : C.line, background: on ? "rgb(var(--c-gold) / .12)" : "rgb(var(--c-ink-deep) / .45)", cursor: "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: on ? C.gold : C.text }}
                  title={f.blurb}
                >
                  {f.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {onSurprise && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3" style={{ borderColor: "rgb(var(--c-violet) / .45)", background: "rgb(var(--c-violet) / .08)" }}>
          <Thumb gameId="surprise" size={40} />
          <div className="min-w-0 flex-1" style={{ minWidth: 150 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: C.text }}>Soirée surprise</div>
            <div style={{ fontSize: 12, color: C.muted }}>Chaque jeu est tiré au sort au moment de le lancer.</div>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Nombre de jeux">
            <button onClick={() => setSurpriseCount((n) => Math.max(SURPRISE_MIN, n - 1))} disabled={surpriseCount <= SURPRISE_MIN} aria-label="Un jeu de moins" className="rounded-lg disabled:opacity-30" style={{ width: 30, height: 30, border: `1px solid ${C.line}`, background: "rgb(var(--c-ink-deep) / .5)", color: C.text, cursor: "pointer", fontWeight: 800 }}>−</button>
            <span style={{ minWidth: 58, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, color: C.text }}>{surpriseCount} jeux</span>
            <button onClick={() => setSurpriseCount((n) => Math.min(SURPRISE_MAX, n + 1))} disabled={surpriseCount >= SURPRISE_MAX} aria-label="Un jeu de plus" className="rounded-lg disabled:opacity-30" style={{ width: 30, height: 30, border: `1px solid ${C.line}`, background: "rgb(var(--c-ink-deep) / .5)", color: C.text, cursor: "pointer", fontWeight: 800 }}>+</button>
          </div>
          <button onClick={() => { setLastFormat(null); onSurprise(surpriseCount); }} className="rounded-full border px-3 py-1.5" style={{ borderColor: "rgb(var(--c-violet) / .7)", background: "rgb(var(--c-violet) / .18)", cursor: "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: C.text }}>
            🎲 Préparer
          </button>
        </div>
      )}

      {items.length > 0 ? (
        <ol className="mb-4 flex flex-col gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((it, i) => {
            const g = gameInfo(it.gameId);
            const ok = fits(it.gameId);
            return (
              <li key={`${it.gameId}-${i}`} className="flex items-center gap-3 rounded-xl border px-3 py-2" style={{ borderColor: ok ? C.line : "rgba(255,140,90,.45)", background: ok ? "rgb(var(--c-ink-deep) / .55)" : "rgb(var(--c-orange) / .07)" }}>
                <span style={{ width: 18, fontFamily: MONO, fontWeight: 700, fontSize: 12, color: C.faint }}>{i + 1}</span>
                <Thumb gameId={it.gameId} size={36} />
                <div className="min-w-0 flex-1">
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: C.text }}>{g.name}</div>
                  {ok ? (
                    <div className="truncate" style={{ fontSize: 12, color: C.muted }}>{it.detail}</div>
                  ) : (
                    <div className="truncate" style={{ fontSize: 12, color: "#FFB27A" }}>
                      {playerCount < g.minPlayers ? `${g.minPlayers} joueurs minimum` : `${g.maxPlayers} joueurs maximum`} · ne sera pas joué
                    </div>
                  )}
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
      ) : null}

      {/* Le lancement se fait depuis le bouton principal en bas du salon
          (un seul gros bouton : « Lancer la soirée » dès qu'un programme existe). */}
      <button onClick={onAdd} disabled={items.length >= 12} className="arc arc-sec arc-block" style={{ fontSize: 14, translate: "0 14px" }}>
        + Ajouter « {selectedName} »
      </button>
      {items.length > 0 && launchDisabled && launchHint && <p className="mt-2 text-xs" style={{ color: C.faint }}>{launchHint}</p>}
      {unfit > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs" style={{ color: "#FFB27A" }}>
          {unfit === items.length
            ? `Aucun de ces jeux ne se joue à ${playerCount}.`
            : `${unfit} jeu${unfit > 1 ? "x" : ""} sur ${items.length} ${unfit > 1 ? "ne seront pas joués" : "ne sera pas joué"} à ${playerCount} joueur${playerCount > 1 ? "s" : ""}.`}
          <button onClick={onPrune} className="font-semibold underline" style={{ color: C.gold, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Les retirer
          </button>
        </p>
      )}
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
          <li key={r.id} className="flex items-center gap-3 rounded-xl px-3 py-1.5" style={{ background: r.id === you ? "rgb(var(--c-gold) / .08)" : "rgb(var(--c-ink-deep) / .45)", border: `1px solid ${r.id === you ? "rgb(var(--c-gold) / .35)" : C.line}` }}>
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
        const skipped = (soiree.skipped ?? []).includes(i);
        const now = i === soiree.current && !soiree.finished;
        const g = gameInfo(it.gameId);
        return (
          <span key={i} title={skipped ? "Passé : pas le bon nombre de joueurs" : undefined} className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: now ? g.accent : C.line, background: now ? `color-mix(in srgb, ${g.accent} 10.2%, transparent)` : "transparent", color: done || skipped ? C.faint : C.text, textDecoration: done || skipped ? "line-through" : "none", opacity: skipped ? 0.7 : 1 }}>
            <b style={{ fontFamily: MONO, color: now ? g.accent : C.faint }}>{i + 1}</b>
            {it.surprise && it.gameId !== "surprise" ? `🎲 ${g.name}` : g.name}
            {skipped && <span style={{ color: "#FFB27A", textDecoration: "none" }}>passé</span>}
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
    <section className="mb-8 rounded-2xl border p-5" style={{ borderColor: "rgb(var(--c-gold) / .4)", background: "linear-gradient(165deg, rgb(var(--c-gold) / .1), rgb(var(--c-ink-surface) / .7) 60%)" }}>
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
      <div aria-label="Soirée LeBoum" className="hidden sm:inline-flex" style={{ position: "fixed", left: 12, bottom: "max(12px, env(safe-area-inset-bottom))", zIndex: 40, alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, border: "1px solid rgb(var(--c-gold) / .4)", background: "rgb(var(--c-ink) / .9)", backdropFilter: "blur(6px)", fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.gold, pointerEvents: "none" }}>
        Soirée · jeu {idx + 1}/{total}
      </div>
    );
  }
  return (
    <>
      <div role="region" aria-label="Classement de la soirée" style={{ position: "fixed", right: 10, top: "max(10px, env(safe-area-inset-top))", zIndex: 45, width: "min(380px, calc(100vw - 20px))", borderRadius: 20, border: "1px solid rgb(var(--c-gold) / .45)", background: "rgb(var(--c-ink) / .96)", backdropFilter: "blur(10px)", boxShadow: "0 24px 60px -20px rgba(0,0,0,.9)", padding: 14, animation: "pop-in .25s ease-out both" }}>
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

/** Grand final : classement, bilan perso, distinctions, film de la soirée, revanche. */
export function SoireeFinal({ soiree, you, isHost, onRematch, onEnd, onVote }: { soiree: SoireeState; you: string; isHost: boolean; onRematch: () => void; onEnd: () => void; onVote: (want: boolean) => void }) {
  const standings = soireeStandings(soiree);
  const ranking: RankRow[] = standings
    .map((r) => ({ ...soiree.players[r.id], score: r.total }))
    .filter((r): r is RankRow => !!r && typeof r.name === "string");
  const highlights = soireeHighlights(soiree);
  const recap = soireeRecap(soiree);
  const mine = playerSummary(soiree, you);
  const votes = (soiree.rematchVotes ?? []).filter((id) => soiree.players[id]);
  const iVoted = votes.includes(you);
  const n = soiree.records.length;

  useEffect(() => {
    playSound("champion");
  }, []);

  const actions = (
    <section aria-label="On remet ça ?" style={{ position: "relative", maxWidth: 560, margin: "28px auto 0", padding: "18px 18px 16px", borderRadius: 22, border: "1px solid rgb(var(--c-gold) / .45)", background: "linear-gradient(160deg, rgb(var(--c-gold) / .14), rgb(var(--c-ink-surface) / .75) 65%)", textAlign: "center", animation: "pop-in .35s ease-out 1s both" }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, color: C.text, lineHeight: 1.1 }}>On remet ça ?</div>
      <p style={{ margin: "6px 0 12px", color: C.muted, fontSize: 14 }}>Revanche : même programme, scores remis à zéro.</p>
      {votes.length > 0 && (
        <div className="mb-3 flex items-center justify-center gap-2" aria-live="polite">
          <span className="flex">
            {votes.slice(0, 6).map((id, i) => (
              <span key={id} style={{ marginLeft: i ? -8 : 0, borderRadius: 999, boxShadow: `0 0 0 2px ${C.deep}` }}>
                <Avatar name={soiree.players[id].name} color={soiree.players[id].color} avatar={soiree.players[id].avatar} size={26} />
              </span>
            ))}
          </span>
          <span style={{ fontSize: 14, color: C.gold, fontWeight: 700 }}>{votes.length === 1 ? `${soiree.players[votes[0]].name} veut sa revanche !` : `${votes.length} joueurs veulent la revanche !`}</span>
        </div>
      )}
      {isHost ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={onEnd} className="arc arc-sec">Nouvelle soirée</button>
          <button onClick={onRematch} className="arc arc-p" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 1 2.6 6.3" /><path d="M3 20v-5h5" /></svg>
            Revanche !
          </button>
        </div>
      ) : (
        <>
          <button onClick={() => { onVote(!iVoted); playSound(iVoted ? "click" : "vote"); }} className={`arc ${iVoted ? "arc-sec" : "arc-p"}`} aria-pressed={iVoted}>
            {iVoted ? "Revanche demandée ✓" : "Je veux la revanche !"}
          </button>
          <p className="mt-2 text-xs" style={{ color: C.faint }}>{iVoted ? "Touche encore pour annuler. " : ""}L'hôte lance la revanche ou une nouvelle soirée.</p>
        </>
      )}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12.5, color: C.muted }}>Bonne soirée ? LeBoum vit grâce à vous.</span>
        <SupportButton />
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <ResultsScreen
        ranking={ranking}
        you={you}
        stats={null}
        isHost={isHost}
        onReturn={onEnd}
        onReplay={onRematch}
        eyebrow={`Fin de soirée · ${n} jeu${n > 1 ? "x" : ""}`}
        winnerText="remporte la soirée"
        endTitle={"Fin de soirée\u202f!"}
        actions={actions}
      >
        {mine && <MySoiree s={mine} total={standings.length} shared={standings.filter((r) => r.place === mine.place).length > 1} />}
        {highlights.length > 0 && (
          <>
            <SectionTitle>Les distinctions</SectionTitle>
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, maxWidth: 560, marginInline: "auto" }}>
              {highlights.map((a, i) => {
                const p = soiree.players[a.playerId];
                if (!p) return null;
                const isYou = a.playerId === you;
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-2xl border px-3 py-2.5" style={{ borderColor: isYou ? "rgb(var(--c-gold) / .5)" : C.line, background: isYou ? "rgb(var(--c-gold) / .08)" : "rgb(var(--c-ink-surface) / .6)", animation: `pop-in .3s ease-out ${(0.5 + i * 0.1).toFixed(2)}s both` }}>
                    <span style={{ position: "relative", flex: "none" }}>
                      <Avatar name={p.name} color={p.color} avatar={p.avatar} size={38} />
                      <span style={{ position: "absolute", right: -9, bottom: -9, display: "grid", placeItems: "center" }}>
                        <HighlightIcon id={a.id} />
                      </span>
                    </span>
                    <div className="min-w-0" style={{ textAlign: "left" }}>
                      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.gold }}>{a.label}</div>
                      <div className="truncate" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: C.text }}>{p.name}{isYou ? " (toi)" : ""}</div>
                      {a.detail && <div className="truncate" style={{ fontSize: 12, color: C.muted }} title={a.detail}>{a.detail}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {recap.length > 0 && (
          <>
            <SectionTitle>Le film de la soirée</SectionTitle>
            <ol style={{ listStyle: "none", margin: "0 auto", padding: 0, maxWidth: 560, display: "flex", flexDirection: "column", gap: 6 }}>
              {recap.map((r, i) => {
                const g = gameInfo(r.gameId);
                const names = r.winners.map((id) => soiree.players[id]?.name).filter(Boolean) as string[];
                const first = r.winners.length === 1 ? soiree.players[r.winners[0]] : null;
                return (
                  <li key={r.index} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "rgb(var(--c-ink-deep) / .45)", border: `1px solid ${C.line}`, animation: `pop-in .3s ease-out ${(0.7 + i * 0.08).toFixed(2)}s both` }}>
                    <span style={{ width: 18, fontFamily: MONO, fontWeight: 700, fontSize: 12, color: C.faint }}>{r.index + 1}</span>
                    <Thumb gameId={r.gameId} size={30} />
                    <span className="flex-1 truncate" style={{ minWidth: 72, fontFamily: DISPLAY, fontWeight: 700, fontSize: 14, color: C.text, textAlign: "left" }}>{g.name}</span>
                    {r.coop ? (
                      <span style={{ fontSize: 13, color: C.mint }}>Victoire d'équipe</span>
                    ) : first ? (
                      <span className="inline-flex min-w-0 items-center gap-2" style={{ fontSize: 13, color: C.muted }}>
                        <Avatar name={first.name} color={first.color} avatar={first.avatar} size={22} />
                        <span className="truncate" style={{ color: r.winners[0] === you ? C.gold : C.text, fontWeight: 700 }}>{first.name}</span>
                      </span>
                    ) : names.length > 1 ? (
                      <span className="inline-flex items-center gap-2" style={{ fontSize: 13, color: C.muted }} title={`Ex æquo : ${names.join(", ")}`}>
                        <span className="flex">
                          {r.winners.slice(0, 4).map((id, k) => {
                            const w = soiree.players[id];
                            return w ? (
                              <span key={id} style={{ marginLeft: k ? -7 : 0, borderRadius: 999, boxShadow: `0 0 0 2px ${C.deep}` }}>
                                <Avatar name={w.name} color={w.color} avatar={w.avatar} size={22} />
                              </span>
                            ) : null;
                          })}
                        </span>
                        Ex æquo
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, color: C.faint }}>—</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </ResultsScreen>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ position: "relative", margin: "26px 0 10px", textAlign: "center", fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: C.muted }}>{children}</h3>;
}

const ordinal = (n: number) => (n === 1 ? "1re" : `${n}e`);

/** « Ta soirée » : le bilan du joueur qui regarde. */
function MySoiree({ s, total, shared }: { s: SoireePlayerSummary; total: number; shared: boolean }) {
  const line = s.place === 1 ? (shared ? "Co-champion·ne de la soirée !" : "Champion·ne de la soirée !") : s.place <= 3 ? "Sur le podium, bien joué !" : s.place === total && total > 2 ? "La lanterne rouge… la revanche t'attend." : "Belle soirée, la prochaine est pour toi.";
  const cells: { v: string; l: string }[] = [
    { v: ordinal(s.place), l: shared ? "ex æquo" : `sur ${total}` },
    { v: String(s.total), l: "pts de soirée" },
    { v: String(s.wins), l: s.wins > 1 ? "jeux gagnés" : "jeu gagné" },
    { v: String(s.podiums), l: s.podiums > 1 ? "podiums" : "podium" },
  ];
  return (
    <section aria-label="Ta soirée" style={{ position: "relative", maxWidth: 560, margin: "24px auto 0", padding: 14, borderRadius: 20, border: `1px solid ${C.line}`, background: "rgb(var(--c-ink-surface) / .6)", animation: "pop-in .3s ease-out .35s both" }}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: C.gold }}>Ta soirée</span>
        <span className="truncate" style={{ fontSize: 13, color: C.muted }}>{line}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {cells.map((c) => (
          <div key={c.l} style={{ textAlign: "center", padding: "8px 4px", borderRadius: 14, background: "rgb(var(--c-ink-deep) / .5)" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, color: C.text, lineHeight: 1 }}>{c.v}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: C.faint }}>{c.l}</div>
          </div>
        ))}
      </div>
      {s.best && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: C.muted, textAlign: "center" }}>
          Ton meilleur jeu : <b style={{ color: C.text }}>{gameInfo(s.best.gameId).name}</b> ({ordinal(s.best.place)} place)
        </p>
      )}
    </section>
  );
}

/** Icône illustrée de chaque distinction (planche néon LeBoum). */
const HIGHLIGHT_ICONS: Record<string, NeonIconName> = {
  most_wins: "trophy",
  big_win: "bolt",
  quiz_head: "bulb",
  brain: "bulb",
  streak: "fire",
  best_drawer: "palette",
  best_liar: "ghost",
  detective: "magnifier",
  funny_best: "laughing",
  funny_pen: "love-letter",
  funny_champ: "crown",
  comeback: "rocket",
  always_podium: "medal",
  most_words: "diamond",
  best_mimic: "mic",
  best_orator: "megaphone",
  best_finder: "target",
  whois_star: "star",
  whois_mind: "thinking",
  yesno_wall: "cool",
  yesno_trap: "skull",
  guesswho_sherlock: "magnifier",
  guesswho_oracle: "magic-wand",
  best_writer: "chat",
  fastest: "stopwatch",
  ranking_perfect: "laurel",
};
function HighlightIcon({ id }: { id: string }) {
  return <NeonIcon name={HIGHLIGHT_ICONS[id] ?? "star"} size={26} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.6))" }} />;
}
