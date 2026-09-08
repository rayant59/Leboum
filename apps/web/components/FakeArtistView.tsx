"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FakeArtistPublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { SoundToggle } from "@/lib/sound";
import { Avatar } from "@/components/Avatar";
import { DrawCanvas, SkipButton, ChatPanel } from "@/components/DrawGameView";
import { LB, DISPLAY, MONO, hexA, Aurora, type RailRow, lbShell, lbCard, lbGoldBtn, lbGhostBtn, topBar, LB_SCOPED_CSS } from "@/components/leboum";

function initials(name: string) { return name.trim().slice(0, 2).toUpperCase() || "?"; }
function useCountdown(deadline: number | null, serverNow: () => number) {
  const [, setTick] = useState(0);
  useEffect(() => { if (deadline == null) return; const id = setInterval(() => setTick((n) => n + 1), 250); return () => clearInterval(id); }, [deadline]);
  if (deadline == null) return null;
  return Math.max(0, Math.ceil((deadline - serverNow()) / 1000));
}

// Rail joueurs + chat (aucun anneau de chrono dans ce mode).
function FaRail({ kicker, heading, sub, rows, chat }: { kicker: string; heading: string; sub: string; rows: RailRow[]; chat?: ReactNode }) {
  return (
    <aside className="lb-rail" style={{ position: "relative", width: chat ? 264 : 296, flex: "none", zIndex: 1, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16, padding: "24px 20px", background: LB.aside, borderRight: `1px solid ${LB.line}`, minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "none" }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>{kicker}</span>
        <span style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.1 }}>{heading}</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: LB.faint }}>{sub}</span>
      </div>
      <div style={{ height: 1, flex: "none", background: "linear-gradient(90deg,transparent,rgba(243,238,255,.14) 18%,rgba(243,238,255,.14) 82%,transparent)" }} />
      <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => {
          const ac = r.accent;
          return (
            <div key={r.id} style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: ac ? "12px 14px 12px 16px" : "12px 14px", borderRadius: 14, background: ac ? hexA(ac, 0.1) : "transparent", boxShadow: ac ? `0 0 0 1px ${hexA(ac, 0.55)}, 0 0 26px -12px ${hexA(ac, 0.9)}` : `0 0 0 1px ${LB.line}` }}>
              {ac && <span style={{ position: "absolute", left: 0, top: 13, bottom: 13, width: 3, borderRadius: 3, background: ac }} />}
              {r.rank != null && <span style={{ flex: "none", width: 14, fontFamily: DISPLAY, fontWeight: 700, fontSize: 12, color: r.rank === 1 ? LB.gold : LB.faint }}>{r.rank}</span>}
              <Avatar name={r.name} color={r.color} avatar={r.avatar} size={34} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}{r.you && <span style={{ color: LB.faint, fontWeight: 400 }}> · toi</span>}</span>
                {r.meta && <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, color: r.meta.color }}>{r.meta.text}</span>}
              </span>
              {r.badge && <span style={{ flex: "none", marginLeft: 6, whiteSpace: "nowrap", fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: r.badge.color }}>{r.badge.text}</span>}
              {r.score && <span style={{ flex: "none", fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: r.rank === 1 ? LB.gold : LB.muted }}>{r.score}</span>}
            </div>
          );
        })}
      </div>
      {chat && (
        <>
          <span style={{ flex: "none", fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint, marginTop: 2 }}>Discussion</span>
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>{chat}</div>
        </>
      )}
    </aside>
  );
}

const FA_CSS = `
.fa-draw{display:flex;gap:16px;flex:1;min-height:0}
.fa-others{width:186px;flex:none;display:flex;flex-direction:column;gap:8px;min-height:0}
.fa-others-list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding-right:2px}
.fa-vote-grid{flex:1;min-height:0;display:flex;align-items:stretch;gap:22px}
.fa-vote-canvases{flex:1;min-width:0;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:10px}
.fa-vote-buttons{width:300px;flex:none;display:flex;flex-direction:column;gap:12px}
@media (max-width:899px){
  .fa-draw{flex-direction:column}
  .fa-others{width:100%;flex:none}
  .fa-others-list{flex-direction:row;overflow-x:auto;overflow-y:hidden}
  .fa-others-list > *{width:120px;flex:none}
  .fa-vote-grid{flex-direction:column}
  .fa-vote-buttons{width:100%}
  .fa-word{font-size:38px !important}
}
`;

export function FakeArtistView({ room }: { room: UseRoom }) {
  const game = room.game as FakeArtistPublic;
  const you = room.you;
  const isHost = room.state?.hostId === you;
  const byId = new Map(game.players.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const color = (id: string) => byId.get(id)?.color ?? LB.violet;
  const avatarOf = (id: string) => byId.get(id)?.avatar;
  const secs = useCountdown(game.deadline, room.serverNow);
  const shownWord = game.youAreImpostor ? game.decoyHint : game.word;

  // Toile observée (la mienne par défaut, réinitialisée chaque manche).
  const [selected, setSelected] = useState<string>(you ?? "");
  useEffect(() => { if (game.phase === "drawing" && you) setSelected(you); }, [game.round, game.phase, you]);
  const isMine = selected === you;

  // BRIEF (9a) : overlay client de 4s à l'entrée de la manche (le moteur n'a pas
  // de phase brief — le mot est fourni dès "drawing"). Identique pour l'imposteur.
  const [briefRound, setBriefRound] = useState<number>(() => ((game as unknown as { __skipBrief?: boolean }).__skipBrief ? game.round : -1));
  const showBrief = game.phase === "drawing" && briefRound !== game.round;
  useEffect(() => {
    if (game.phase === "drawing" && briefRound !== game.round) {
      const t = setTimeout(() => setBriefRound(game.round), 4000);
      return () => clearTimeout(t);
    }
  }, [game.phase, game.round, briefRound]);

  const ranking = [...game.players].sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0));

  // Barre de tour.
  const phaseMs = game.phase === "drawing" ? game.config.drawMs : game.phase === "voting" ? game.config.voteMs : 0;
  const frac = secs != null && phaseMs > 0 ? Math.max(0, Math.min(1, 1 - (secs * 1000) / phaseMs)) : (game.phase === "drawing" || game.phase === "voting" ? 0 : 1);
  const isPink = game.phase === "voting" || game.phase === "reveal";
  const barColor = isPink ? LB.pink : LB.gold;
  const barP = game.phase === "reveal" || game.phase === "scoreboard" ? 95 : Math.max(5, Math.min(95, Math.round(frac * 100)));

  const headerTools = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {secs != null && game.phase === "drawing" && <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: secs <= 5 ? LB.pink : LB.gold }}>{secs}s</span>}
      <SoundToggle />
      {isHost && game.phase !== "scoreboard" && game.phase !== "reveal" && <SkipButton onSkip={room.skipPhase} />}
    </div>
  );

  // ════════ FINAL (9e) — plein écran, sans chat ════════
  if (game.phase === "scoreboard") {
    const rows: RailRow[] = ranking.map((p, i) => ({ id: p.id, name: p.name, color: p.color, avatar: p.avatar, you: p.id === you, rank: i + 1, accent: i === 0 ? LB.gold : p.id === you ? LB.violet : undefined, score: (game.scores[p.id] ?? 0).toLocaleString("fr-FR") }));
    const w = ranking[0];
    return (
      <main style={lbShell} className="lb-scope">
        <style dangerouslySetInnerHTML={{ __html: LB_SCOPED_CSS + FA_CSS }} />
        <div style={lbCard}>
          <Aurora tint="rgba(255,194,75,.14)" tint2="rgba(139,125,246,.10)" />
          <FaRail kicker="Classement" heading="Partie terminée" sub={`${game.totalRounds} manches`} rows={rows} />
          <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={topBar(LB.gold)} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: 34, textAlign: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: LB.faint }}><img src="/tools/magnifier.png" alt="" width={22} height={22} style={{ display: "block" }} />Meilleur enquêteur</span>
              {w && <>
                <span style={{ display: "grid", placeItems: "center", width: 92, height: 92, borderRadius: 22, background: color(w.id), fontFamily: DISPLAY, fontSize: 32, fontWeight: 800, color: LB.ink, boxShadow: `0 0 60px -18px ${color(w.id)}` }}>{initials(w.name)}</span>
                <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 56, letterSpacing: "-.02em", lineHeight: 1 }}>{w.name}</span>
                <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, color: LB.gold }}>{(game.scores[w.id] ?? 0).toLocaleString("fr-FR")} points</span>
              </>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "0 34px 30px" }}>
              {isHost ? (<>
                <button onClick={() => room.returnLobby()} className="lb-ghost" style={lbGhostBtn}>Salon</button>
                <button onClick={() => room.playAgain()} className="lb-gold" style={lbGoldBtn}>Rejouer</button>
              </>) : <span style={{ fontSize: 14, color: LB.muted }}>En attente de l'hôte…</span>}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ════════ UNMASK (9d) — reveal, plein écran, sans chat ════════
  if (game.phase === "reveal" && game.result) {
    const res = game.result;
    const rows: RailRow[] = ranking.map((p) => ({ id: p.id, name: p.name, color: p.color, avatar: p.avatar, you: p.id === you, accent: p.id === res.impostorId ? LB.pink : p.id === you ? LB.violet : undefined, badge: p.id === res.impostorId ? { text: "imposteur", color: LB.pink } : undefined, score: (game.scores[p.id] ?? 0).toLocaleString("fr-FR") }));
    const votesForImpostor = res.tally[res.impostorId] ?? 0;
    const myCorrect = game.yourVote === res.impostorId;
    return (
      <main style={lbShell} className="lb-scope">
        <style dangerouslySetInnerHTML={{ __html: LB_SCOPED_CSS + FA_CSS }} />
        <div style={lbCard}>
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}><div style={{ position: "absolute", top: "-10%", left: "38%", width: 560, height: 560, borderRadius: "50%", filter: "blur(90px)", background: `radial-gradient(circle, rgba(255,77,141,.16), transparent 62%)` }} /></div>
          <FaRail kicker="Faux-artiste" heading="Manche terminée" sub="points de la manche" rows={rows} />
          <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={topBar(LB.pink)} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.pink }}><img src="/tools/skull.png" alt="" width={20} height={20} style={{ display: "block" }} />Le faux-artiste était</span>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em", color: LB.faint }}>{game.round >= game.totalRounds ? "fin de partie" : "manche suivante bientôt"}</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "0 24px", textAlign: "center" }}>
              <span style={{ display: "grid", placeItems: "center", width: 96, height: 96, borderRadius: 24, background: color(res.impostorId), fontFamily: DISPLAY, fontSize: 34, fontWeight: 800, color: LB.ink, boxShadow: `0 0 64px -18px ${LB.pink}` }}>{initials(name(res.impostorId))}</span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 58, letterSpacing: "-.02em", lineHeight: 1 }}>{name(res.impostorId)}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "12px 20px", borderRadius: 14, boxShadow: `0 0 0 1px ${LB.line}` }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>le mot</span>
                <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, color: LB.mint }}>{res.word}</span>
              </span>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>{votesForImpostor} vote{votesForImpostor > 1 ? "s" : ""} sur {game.players.length}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 40px 30px", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: hexA(res.caught ? LB.mint : LB.pink, 0.1), boxShadow: `0 0 0 1px ${hexA(res.caught ? LB.mint : LB.pink, 0.5)}` }}>
                <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: res.caught ? LB.mint : LB.pink }}>{res.caught ? "Imposteur démasqué 🎯" : "Il vous a bernés 😈"}</span>
              </span>
              {game.yourVote && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, boxShadow: `0 0 0 1px ${LB.line}` }}>
                  <Avatar name={name(you)} color={color(you)} avatar={avatarOf(you)} size={24} />
                  {myCorrect
                    ? <span style={{ fontSize: 13, color: LB.mint }}>tu as bien voté</span>
                    : <span style={{ fontSize: 13, color: LB.muted }}>ton vote : <span style={{ textDecoration: "line-through", textDecorationColor: hexA(LB.pink, 0.7), color: LB.faint }}>{name(game.yourVote)}</span></span>}
                </span>
              )}
              {isHost && <button onClick={() => room.skipPhase()} className="lb-gold" style={{ ...lbGoldBtn, marginLeft: "auto" }}>Manche suivante</button>}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ════════ BRIEF (9a, overlay) / DRAWING (9b) / VOTING (9c) ════════
  const drawing = game.phase === "drawing";
  const voting = game.phase === "voting";
  const railRows: RailRow[] = game.players.map((p) => ({
    id: p.id, name: p.name, color: p.color, avatar: p.avatar, you: p.id === you,
    accent: p.id === you ? LB.violet : undefined,
    score: (game.scores[p.id] ?? 0).toLocaleString("fr-FR"),
  }));

  if (showBrief) {
    // BRIEF : rail 296 sans chat, aurore violette, carte du mot (identique imposteur).
    return (
      <main style={lbShell} className="lb-scope">
        <style dangerouslySetInnerHTML={{ __html: LB_SCOPED_CSS + FA_CSS }} />
        <div style={lbCard}>
          <Aurora tint="rgba(139,125,246,.14)" tint2="rgba(255,77,141,.06)" />
          <FaRail kicker="Faux-artiste" heading={`Manche ${game.round} / ${game.totalRounds}`} sub={`${game.players.length} joueurs · 1 mot différent`} rows={railRows} />
          <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={topBar(LB.gold, 30)} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px" }}>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>Manche {game.round}</span>
              <button onClick={() => setBriefRound(game.round)} style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.gold }}>Commencer →</button>
            </div>
            <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 28 }}>
              <div style={{ padding: "44px 72px", borderRadius: 24, background: LB.surface, textAlign: "center", boxShadow: `0 0 0 1px ${LB.line}, inset 0 1px 0 rgba(243,238,255,.05), 0 0 70px -30px ${hexA(LB.gold, 0.5)}`, maxWidth: "90%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: LB.gold }}>Ton mot</span>
                  <span className="fa-word" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 74, letterSpacing: "-.03em", lineHeight: 1 }}>{shownWord ?? "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={lbShell} className="lb-scope">
      <style dangerouslySetInnerHTML={{ __html: LB_SCOPED_CSS + FA_CSS }} />
      <div style={lbCard}>
        <Aurora tint={voting ? "rgba(255,77,141,.13)" : "rgba(139,125,246,.13)"} tint2="rgba(255,77,141,.08)" />
        <FaRail
          kicker="Faux-artiste"
          heading={voting ? "Qui a triché ?" : `Manche ${game.round} / ${game.totalRounds}`}
          sub={voting ? `${game.voteCount} sur ${game.players.length} ont voté` : "tout le monde dessine"}
          rows={railRows}
          chat={<ChatPanel room={room} />}
        />

        {/* ════════ DRAWING (9b) ════════ */}
        {drawing && (
          <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={topBar(LB.gold, barP)} />
            <div className="dv-stage" style={{ minWidth: 0, padding: "14px 20px 16px" }}>
            <div className="dv-head" style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.gold }}>ton mot</span>
                <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, letterSpacing: "-.01em", lineHeight: 1 }}>{shownWord ?? "—"}</span>
              </span>
              <div style={{ marginLeft: "auto", textAlign: "right", display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
                  {secs != null && <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, color: secs <= 5 ? LB.pink : LB.gold }}>{secs}s</span>}
                  <SoundToggle />
                  {isHost && <SkipButton onSkip={room.skipPhase} />}
                </span>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>avant le vote</span>
              </div>
            </div>

            <div className="fa-draw">
              <div className="dv-canvasfill" style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                {!isMine && <button onClick={() => you && setSelected(you)} className="lb-ghost" style={{ alignSelf: "flex-start", marginBottom: 8, border: `1px solid ${LB.line}`, background: "transparent", color: LB.muted, fontSize: 13, padding: "8px 14px", borderRadius: 12, cursor: "pointer" }}>← Revenir à ma toile</button>}
                <DrawCanvas room={room} drawable={isMine} blind={false} authorFilter={selected} turnKey={`fa-${game.round}`} fit
                  ctaSlot={isMine ? <button onClick={() => room.endDrawing()} className="lb-gold" style={{ ...lbGoldBtn, flex: "none" }}>J'ai fini</button> : undefined} />
                {!isMine && <span style={{ fontSize: 12, color: LB.faint, marginTop: 6 }}>👁️ Tu observes {name(selected)} en direct — lecture seule.</span>}
              </div>

              <div className="fa-others">
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint, flex: "none" }}>Les autres toiles</span>
                <div className="fa-others-list">
                  {game.players.filter((p) => p.id !== you).map((p) => {
                    const sel = selected === p.id;
                    return (
                      <button key={p.id} onClick={() => setSelected(p.id)} title={`Voir la toile de ${p.name}`} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", flex: "none" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <Avatar name={p.name} color={p.color} avatar={p.avatar} size={20} />
                          <span style={{ fontFamily: DISPLAY, fontSize: 12, fontWeight: 700, color: sel ? LB.gold : LB.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        </span>
                        <span style={{ borderRadius: 12, overflow: "hidden", boxShadow: sel ? `0 0 0 2px ${LB.gold}` : `0 0 0 1px ${LB.line}` }}>
                          <DrawCanvas room={room} drawable={false} blind={false} authorFilter={p.id} turnKey={`fa-thumb-${p.id}-${game.round}`} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* ════════ VOTING (9c) ════════ */}
        {voting && (
          <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={topBar(LB.pink, barP)} />
            <div className="dv-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 34px 8px", flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, letterSpacing: "-.01em" }}>Qui est le faux-artiste ?</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <span data-lb-anim style={{ width: 8, height: 8, borderRadius: "50%", background: LB.pink, animation: "lbPulseSoft 1.4s ease-in-out infinite" }} />
                {secs != null && <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: LB.pink }}>{secs}s</span>}
                {headerTools}
              </span>
            </div>

            <div className="fa-vote-grid" style={{ padding: "8px 34px" }}>
              <div className="fa-vote-canvases">
                {game.players.filter((p) => p.id !== you).map((p) => (
                  <div key={p.id} style={{ position: "relative", borderRadius: 14, overflow: "hidden", boxShadow: `0 0 0 1px ${LB.line}`, background: "#EDEAF6" }}>
                    <DrawCanvas room={room} drawable={false} blind={false} authorFilter={p.id} turnKey={`fa-vote-${p.id}-${game.round}`} />
                    <span style={{ position: "absolute", top: 8, left: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 9, background: "rgba(14,11,26,.92)" }}>
                      <Avatar name={p.name} color={p.color} avatar={p.avatar} size={18} />
                      <span style={{ fontFamily: DISPLAY, fontSize: 11, fontWeight: 700 }}>{p.name}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="fa-vote-buttons">
                {game.players.filter((p) => p.id !== you).map((p) => {
                  const picked = game.yourVote === p.id;
                  return (
                    <button key={p.id} onClick={() => room.castVote(p.id)} className="lb-tile" style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", border: "none", borderRadius: 16, background: picked ? hexA(LB.pink, 0.12) : LB.surface, color: LB.text, textAlign: "left", cursor: "pointer", boxShadow: picked ? `0 0 0 2px ${hexA(LB.pink, 0.7)}, 0 4px 0 ${LB.lineFaint}` : `0 0 0 1px ${LB.line}, 0 4px 0 ${LB.lineFaint}` }}>
                      <Avatar name={p.name} color={p.color} avatar={p.avatar} size={34} />
                      <span style={{ flex: 1, fontFamily: DISPLAY, fontWeight: 700, fontSize: 16 }}>{p.name}</span>
                      {picked
                        ? <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: LB.pink }}>ton vote</span>
                        : <span style={{ width: 18, height: 18, borderRadius: 6, background: p.color }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "14px 34px 22px" }}>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>Ont voté</span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: LB.muted }}>{game.voteCount} / {game.players.length}</span>
              {game.yourVote && <span style={{ marginLeft: "auto", fontSize: 13, color: LB.faint }}>Vote enregistré — modifiable jusqu'à la fin.</span>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
