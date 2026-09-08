"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { FakeArtistPublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { SoundToggle } from "@/lib/sound";
import { Avatar } from "@/components/Avatar";
import { DrawCanvas, SkipButton } from "@/components/DrawGameView";

// ── Palette « LeBoum » (identité or / menthe / rose) ────────────────────────
const C = {
  bg: "#14102A",
  aside: "rgba(28,22,54,.72)",
  surface: "#1C1636",
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
  pinkSh: "#A32458",
  violet: "#8B7DF6",
};
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const MONO = "'Bricolage Grotesque', system-ui, sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}
function useCountdown(deadline: number | null, serverNow: () => number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (deadline == null) return;
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline == null) return null;
  return Math.max(0, Math.ceil((deadline - serverNow()) / 1000));
}

// Aurores animées en fond.
function Aurora({ tint = "rgba(139,125,246,.12)", tint2 = "rgba(255,77,141,.09)" }: { tint?: string; tint2?: string }) {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div data-fa-anim style={{ position: "absolute", top: "-16%", left: "36%", width: 520, height: 520, borderRadius: "50%", filter: "blur(84px)", background: `radial-gradient(circle, ${tint}, transparent 62%)`, animation: "faAuroraA 20s ease-in-out infinite" }} />
      <div data-fa-anim style={{ position: "absolute", bottom: "-16%", right: "4%", width: 460, height: 460, borderRadius: "50%", filter: "blur(84px)", background: `radial-gradient(circle, ${tint2}, transparent 62%)`, animation: "faAuroraB 24s ease-in-out infinite" }} />
    </div>
  );
}

// Feuille de style embarquée (keyframes + responsive + reduced-motion).
function FaStyle() {
  return (
    <style>{`
      @keyframes faAuroraA{0%{transform:translate(-3%,-2%) scale(1)}50%{transform:translate(5%,4%) scale(1.14)}100%{transform:translate(-3%,-2%) scale(1)}}
      @keyframes faAuroraB{0%{transform:translate(2%,3%) scale(1.05)}50%{transform:translate(-4%,-3%) scale(1)}100%{transform:translate(2%,3%) scale(1.05)}}
      @keyframes faPulse{0%,100%{opacity:.55}50%{opacity:1}}
      .fa-mobile-only{display:none}
      .fa-draw{display:flex;gap:16px;flex:1;min-height:0}
      .fa-others{width:196px;flex:none;display:flex;flex-direction:column;gap:8px;min-height:0}
      .fa-others-list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding-right:2px}
      .fa-vote-grid{flex:1;min-height:0;display:flex;align-items:stretch;gap:22px}
      .fa-vote-canvases{flex:1;min-width:0;display:grid;grid-template-columns:1fr 1fr;gap:10px;align-content:start}
      .fa-vote-buttons{width:300px;flex:none;display:flex;flex-direction:column;gap:12px}
      @media (max-width: 900px){
        .fa-aside{display:none !important}
        .fa-mobile-only{display:block}
        .fa-draw{flex-direction:column}
        .fa-others{width:100%;flex:none}
        .fa-others-list{flex-direction:row;overflow-x:auto;overflow-y:hidden}
        .fa-others-list > *{width:150px;flex:none}
        .fa-vote-grid{flex-direction:column}
        .fa-vote-buttons{width:100%}
      }
      @media (prefers-reduced-motion: reduce){[data-fa-anim]{animation-duration:.001ms !important;animation-iteration-count:1 !important}}
    `}</style>
  );
}

const btnGold: CSSProperties = { flex: "none", border: "none", borderRadius: 14, padding: "15px 30px", fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, lineHeight: 1, background: C.gold, color: C.ink, cursor: "pointer", boxShadow: `0 5px 0 ${C.goldSh}, 0 10px 18px -8px rgba(0,0,0,.6)` };
const btnGhost: CSSProperties = { flex: "none", border: `1px solid ${C.line}`, background: "transparent", color: C.muted, fontFamily: BODY, fontSize: 14, padding: "13px 22px", borderRadius: 12, cursor: "pointer" };
const kicker: CSSProperties = { fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.faint };

export function FakeArtistView({ room }: { room: UseRoom }) {
  const game = room.game as FakeArtistPublic;
  const you = room.you;
  const isHost = room.state?.hostId === you;
  const byId = new Map(game.players.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const color = (id: string) => byId.get(id)?.color ?? C.violet;
  const avatarOf = (id: string) => byId.get(id)?.avatar;
  const secs = useCountdown(game.deadline, room.serverNow);

  // Which player's canvas I'm looking at (mine by default). Reset to mine each round.
  const [selected, setSelected] = useState<string>(you ?? "");
  useEffect(() => {
    if (game.phase === "drawing" && you) setSelected(you);
  }, [game.round, game.phase, you]);
  const isMine = selected === you;

  // Le mot affiché : l'imposteur voit son leurre, les autres le vrai mot — même
  // présentation pour tous (règle 9a : aucune indication d'identité).
  const shownWord = game.youAreImpostor ? game.decoyHint : game.word;

  // Barre d'avancement du tour (info, pas artefact).
  const phaseMs = game.phase === "drawing" ? game.config.drawMs : game.phase === "voting" ? game.config.voteMs : 0;
  const frac = secs != null && phaseMs > 0 ? Math.max(0, Math.min(1, 1 - (secs * 1000) / phaseMs)) : game.phase === "drawing" || game.phase === "voting" ? 0 : 1;
  const barColor = game.phase === "voting" ? C.pink : game.phase === "reveal" ? C.pink : C.gold;
  const barFull = game.phase === "reveal" || game.phase === "scoreboard";
  const barP = Math.round(frac * 100);
  const progressBar = (
    <div style={{ height: 3, flex: "none", background: barFull ? `linear-gradient(90deg,transparent,${barColor} 5%,${barColor} 95%,transparent)` : `linear-gradient(90deg,transparent,${barColor} 5%,${barColor} ${barP}%,${barColor}00 ${Math.min(100, barP + 1)}%)` }} />
  );

  const ranking = [...game.players].sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0));

  // ── Rail joueurs (desktop) ─────────────────────────────────────────────────
  const railHeader =
    game.phase === "voting"
      ? { k: "Faux-artiste", h: "Qui a triché ?", s: `${game.voteCount} / ${game.players.length} ont voté` }
      : game.phase === "reveal"
        ? { k: "Faux-artiste", h: "Manche terminée", s: "Résultats de la manche" }
        : game.phase === "scoreboard"
          ? { k: "Classement", h: "Partie terminée", s: `${game.totalRounds} manches` }
          : { k: "Faux-artiste", h: `Manche ${game.round} / ${game.totalRounds}`, s: "Tout le monde dessine" };
  const railRows = game.phase === "reveal" || game.phase === "scoreboard" ? ranking : game.players;

  const Sidebar = (
    <aside className="fa-aside" style={{ position: "relative", zIndex: 1, width: 296, flex: "none", display: "flex", flexDirection: "column", gap: 18, padding: "24px 20px", background: C.aside, borderRight: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={kicker}>{railHeader.k}</span>
        <span style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.1 }}>{railHeader.h}</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: C.faint }}>{railHeader.s}</span>
      </div>
      <div style={{ height: 1, flex: "none", background: `linear-gradient(90deg,transparent,rgba(243,238,255,.14) 18%,rgba(243,238,255,.14) 82%,transparent)` }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {railRows.map((p, i) => {
          const winner = game.phase === "scoreboard" && i === 0;
          const isImpostor = game.phase === "reveal" && game.impostorId === p.id;
          const accent = winner ? C.gold : isImpostor ? C.pink : null;
          const isYou = p.id === you;
          const showRank = game.phase === "scoreboard";
          return (
            <div key={p.id} style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: accent ? "12px 14px 12px 16px" : "12px 14px", borderRadius: 14, ...(accent ? { background: `${accent}1a`, boxShadow: `0 0 0 1px ${accent}8c, 0 0 26px -12px ${accent}` } : { boxShadow: `0 0 0 1px ${C.line}` }) }}>
              {accent && <span style={{ position: "absolute", left: 0, top: 13, bottom: 13, width: 3, borderRadius: 3, background: accent }} />}
              {showRank && <span style={{ flex: "none", width: 14, fontFamily: MONO, fontWeight: 700, fontSize: 12, color: winner ? C.gold : C.faint }}>{i + 1}</span>}
              <Avatar name={p.name} color={p.color} avatar={p.avatar} size={34} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name}
                {isYou && <span style={{ color: C.faint, fontWeight: 400 }}> · toi</span>}
              </span>
              {isImpostor && <span style={{ flex: "none", marginLeft: 6, whiteSpace: "nowrap", fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: C.pink }}>imposteur</span>}
              <span style={{ flex: "none", fontFamily: MONO, fontWeight: 700, fontSize: 13, color: winner ? C.gold : C.muted }}>{game.scores[p.id] ?? 0}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );

  const shell: CSSProperties = { minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: BODY, display: "flex", flexDirection: "column" };
  const cardWrap: CSSProperties = { position: "relative", display: "flex", flex: 1, minHeight: 0, overflow: "hidden" };

  // ── En-tête d'écran (son / chrono / passer) ─────────────────────────────────
  const headerTools = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <SoundToggle />
      {secs != null && game.phase !== "reveal" && game.phase !== "scoreboard" && (
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15, letterSpacing: ".04em", color: secs <= 5 ? C.pink : game.phase === "voting" ? C.pink : C.gold }}>{secs}s</span>
      )}
      {isHost && game.phase !== "scoreboard" && game.phase !== "reveal" && <SkipButton onSkip={room.skipPhase} />}
    </div>
  );

  return (
    <main style={shell}>
      <FaStyle />
      <div style={cardWrap}>
        <Aurora
          tint={game.phase === "voting" || game.phase === "reveal" ? "rgba(255,77,141,.15)" : "rgba(139,125,246,.13)"}
          tint2="rgba(255,77,141,.09)"
        />
        {Sidebar}

        {/* ════════ DESSIN (chacun sa toile) ════════ */}
        {game.phase === "drawing" && (
          <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {progressBar}
            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 24px 12px" }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ ...kicker, color: C.gold }}>ton mot</span>
                <span style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1 }}>{shownWord ?? "—"}</span>
              </span>
              <div style={{ marginLeft: "auto" }}>{headerTools}</div>
            </div>

            <div className="fa-draw" style={{ padding: "0 24px 20px" }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {!isMine && (
                  <button onClick={() => you && setSelected(you)} style={{ alignSelf: "flex-start", ...btnGhost, padding: "8px 14px", fontSize: 13 }}>
                    ← Revenir à ma toile
                  </button>
                )}
                <DrawCanvas
                  room={room}
                  drawable={isMine && game.phase === "drawing"}
                  blind={false}
                  authorFilter={selected}
                  turnKey={`fa-${game.round}`}
                />
                {!isMine && (
                  <span style={{ fontSize: 12, color: C.faint }}>👁️ Tu observes {name(selected)} en direct — lecture seule.</span>
                )}
              </div>

              {/* Bande des autres toiles */}
              <div className="fa-others">
                <span style={{ ...kicker, fontSize: 10, flex: "none" }}>Les autres toiles</span>
                <div className="fa-others-list">
                  {game.players
                    .filter((p) => p.id !== you)
                    .map((p) => {
                      const on = room.state?.players[p.id]?.isConnected ?? true;
                      const sel = selected === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSelected(p.id)}
                          style={{ display: "flex", flexDirection: "column", gap: 6, padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", flex: "none" }}
                          title={`Voir la toile de ${p.name}`}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ height: 7, width: 7, flex: "none", borderRadius: "50%", background: on ? C.mint : C.faint }} />
                            <Avatar name={p.name} color={p.color} avatar={p.avatar} size={20} />
                            <span style={{ fontFamily: DISPLAY, fontSize: 12, fontWeight: 700, color: sel ? C.gold : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                          </span>
                          <span style={{ borderRadius: 12, overflow: "hidden", boxShadow: sel ? `0 0 0 2px ${C.gold}` : `0 0 0 1px ${C.line}` }}>
                            <DrawCanvas room={room} drawable={false} blind={false} authorFilter={p.id} turnKey={`fa-thumb-${p.id}-${game.round}`} />
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════ VOTE ════════ */}
        {game.phase === "voting" && (
          <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {progressBar}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 34px 8px" }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em" }}>Qui est le faux-artiste ?</span>
              {headerTools}
            </div>

            <div className="fa-vote-grid" style={{ padding: "8px 34px" }}>
              <div className="fa-vote-canvases">
                {game.players.map((p) => (
                  <div key={p.id} style={{ position: "relative", borderRadius: 14, overflow: "hidden", boxShadow: `0 0 0 1px ${C.line}` }}>
                    <DrawCanvas room={room} drawable={false} blind={false} authorFilter={p.id} turnKey={`fa-vote-${p.id}-${game.round}`} />
                    <span style={{ position: "absolute", top: 8, left: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 9, background: "rgba(14,11,26,.92)" }}>
                      <Avatar name={p.name} color={p.color} avatar={p.avatar} size={18} />
                      <span style={{ fontFamily: DISPLAY, fontSize: 11, fontWeight: 700 }}>{p.name}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="fa-vote-buttons">
                {game.players
                  .filter((p) => p.id !== you)
                  .map((p) => {
                    const picked = game.yourVote === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => room.castVote(p.id)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", border: "none", borderRadius: 16, background: picked ? "rgba(255,77,141,.12)" : C.surface, color: C.text, fontFamily: BODY, textAlign: "left", cursor: "pointer", boxShadow: picked ? `0 0 0 2px ${C.pink}b3, 0 4px 0 ${C.lineFaint}` : `0 0 0 1px ${C.line}, 0 4px 0 ${C.lineFaint}` }}
                      >
                        <Avatar name={p.name} color={p.color} avatar={p.avatar} size={34} />
                        <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{p.name}</span>
                        {picked ? (
                          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: C.pink }}>ton vote</span>
                        ) : (
                          <span style={{ width: 18, height: 18, borderRadius: 6, background: p.color }} />
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "14px 34px 22px" }}>
              <span style={kicker}>Ont voté</span>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: C.muted }}>{game.voteCount} / {game.players.length}</span>
              {game.yourVote && <span style={{ marginLeft: "auto", fontSize: 13, color: C.faint }}>Vote enregistré — en attente des autres…</span>}
            </div>
          </div>
        )}

        {/* ════════ DÉMASQUÉ (reveal) ════════ */}
        {game.phase === "reveal" && game.result && (
          <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {progressBar}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px" }}>
              <span style={{ ...kicker, color: C.pink, display: "inline-flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>💀</span>
                Le faux-artiste était
              </span>
              <SoundToggle />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "0 24px" }}>
              <span style={{ display: "grid", placeItems: "center", width: 96, height: 96, borderRadius: 24, background: color(game.result.impostorId), fontFamily: DISPLAY, fontSize: 34, fontWeight: 800, color: C.ink, boxShadow: `0 0 64px -18px ${C.pink}` }}>
                {initials(name(game.result.impostorId))}
              </span>
              <span style={{ fontFamily: DISPLAY, fontSize: "clamp(38px,7vw,58px)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1, textAlign: "center" }}>{name(game.result.impostorId)}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "12px 20px", borderRadius: 14, boxShadow: `0 0 0 1px ${C.line}` }}>
                <span style={kicker}>le mot</span>
                <span style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 800, color: C.mint }}>{game.result.word}</span>
              </span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: game.result.caught ? C.mint : C.pink }}>
                {game.result.caught ? "Démasqué ! 🎯" : "Il vous a bernés… 😈"}
              </span>
            </div>
            <div style={{ padding: "0 40px 34px", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              {isHost ? (
                <button onClick={() => room.skipPhase()} style={btnGold}>Manche suivante</button>
              ) : (
                <span style={{ fontSize: 13, color: C.faint }}>La manche suivante arrive…</span>
              )}
            </div>
          </div>
        )}

        {/* ════════ CLASSEMENT ════════ */}
        {game.phase === "scoreboard" && (
          <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {progressBar}
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 24px 0" }}>
              <SoundToggle />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "0 24px" }}>
              <span style={{ ...kicker, letterSpacing: ".18em", display: "inline-flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>🔍</span>
                Meilleur enquêteur
              </span>
              {ranking[0] && (
                <>
                  <span style={{ display: "grid", placeItems: "center", width: 92, height: 92, borderRadius: 22, background: color(ranking[0].id), fontFamily: DISPLAY, fontSize: 32, fontWeight: 800, color: C.ink, boxShadow: `0 0 60px -18px ${color(ranking[0].id)}` }}>
                    {initials(ranking[0].name)}
                  </span>
                  <span style={{ fontFamily: DISPLAY, fontSize: "clamp(38px,7vw,56px)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1, textAlign: "center" }}>{ranking[0].name}</span>
                  <span style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 800, color: C.gold }}>{game.scores[ranking[0].id] ?? 0} points</span>
                </>
              )}

              {/* Classement complet — visible sur mobile (le rail est masqué). */}
              <div className="fa-mobile-only" style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                {ranking.map((p, i) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 14, ...(i === 0 ? { background: `${C.gold}1a`, boxShadow: `0 0 0 1px ${C.gold}8c` } : { boxShadow: `0 0 0 1px ${C.line}` }) }}>
                    <span style={{ width: 16, fontFamily: MONO, fontWeight: 700, fontSize: 12, color: i === 0 ? C.gold : C.faint }}>{i + 1}</span>
                    <Avatar name={p.name} color={p.color} avatar={p.avatar} size={30} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{p.id === you && <span style={{ color: C.faint, fontWeight: 400 }}> · toi</span>}</span>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: i === 0 ? C.gold : C.muted }}>{game.scores[p.id] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: "0 40px 34px", display: "flex", gap: 12, justifyContent: "flex-end" }}>
              {isHost ? (
                <>
                  <button onClick={() => room.returnLobby()} style={btnGhost}>Salon</button>
                  <button onClick={() => room.playAgain()} style={btnGold}>Rejouer</button>
                </>
              ) : (
                <span style={{ alignSelf: "center", fontSize: 13, color: C.faint }}>En attente de l'hôte…</span>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
