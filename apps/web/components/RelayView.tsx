"use client";

import type { RelayPublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { SoundToggle } from "@/lib/sound";
import { Avatar } from "@/components/Avatar";
import { DrawCanvas, GuessBar, ChatPanel, MaskedWord, SkipButton } from "@/components/DrawGameView";
import { LB, DISPLAY, MONO, hexA, Aurora, Rail, type RailRow, lbShell, lbCard, lbGoldBtn, lbGhostBtn, topBar, useCountdown, LB_SCOPED_CSS } from "@/components/leboum";

export function RelayView({ room }: { room: UseRoom }) {
  const game = room.game as RelayPublic;
  const you = room.you;
  const isHost = room.state?.hostId === you;
  const byId = new Map(game.players.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const color = (id: string) => byId.get(id)?.color ?? "#888";
  const avatarOf = (id: string) => byId.get(id)?.avatar;
  const secs = useCountdown(game.deadline, room.serverNow);
  const swapSecs = useCountdown(game.swapDeadline, room.serverNow);
  const activeName = game.activeDrawerId ? name(game.activeDrawerId) : "";
  const revealResult = game.result;

  // ── Écran final : plein écran, sans rail ──────────────────────────────────
  if (game.phase === "scoreboard") {
    const ranking = [...game.players].sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0));
    return (
      <main style={lbShell} className="lb-scope">
        <style dangerouslySetInnerHTML={{ __html: LB_SCOPED_CSS }} />
        <div style={lbCard}>
          <Aurora tint="rgba(255,194,75,.14)" tint2="rgba(139,125,246,.10)" />
          <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={topBar(LB.gold)} />
            <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 28 }}>
              <div style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: LB.faint }}>Classement final</span>
                <div style={{ fontSize: 40, margin: "8px 0 18px" }}>🏆</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
                  {ranking.map((p, i) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: i === 0 ? hexA(LB.gold, 0.1) : LB.surface, boxShadow: i === 0 ? `0 0 0 1px ${hexA(LB.gold, 0.55)}` : `0 0 0 1px ${LB.line}` }}>
                      <span style={{ width: 26, textAlign: "center", fontFamily: DISPLAY, fontSize: 20, fontWeight: 800, color: i === 0 ? LB.gold : LB.faint }}>{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                      <Avatar name={p.name} color={color(p.id)} avatar={avatarOf(p.id)} size={40} />
                      <span style={{ flex: 1, fontWeight: 600 }}>{p.name}{p.id === you && <span style={{ color: LB.faint, fontWeight: 400 }}> · toi</span>}</span>
                      <span style={{ fontFamily: DISPLAY, fontWeight: 800, color: LB.gold }}>{game.scores[p.id] ?? 0}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
                  {isHost ? (
                    <>
                      <button onClick={() => room.playAgain()} className="lb-gold" style={{ ...lbGoldBtn, width: "100%" }}>Rejouer</button>
                      <button onClick={() => room.returnLobby()} className="lb-ghost" style={{ ...lbGhostBtn, width: "100%" }}>Retour au salon</button>
                    </>
                  ) : (
                    <p style={{ fontSize: 14, color: LB.muted }}>En attente de l'hôte…</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Rail joueurs ──────────────────────────────────────────────────────────
  const foundIdx = (id: string) => game.foundOrder.indexOf(id);
  const railRows: RailRow[] = [...game.players]
    .sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0))
    .map((p) => {
      const isYou = p.id === you;
      const isDrawer = game.drawerIds.includes(p.id);
      const isActive = p.id === game.activeDrawerId;
      const found = game.phase === "reveal" ? revealResult?.guesserIds.includes(p.id) : game.guessedIds.includes(p.id);
      const fi = foundIdx(p.id);
      return {
        id: p.id, name: p.name, color: p.color, avatar: p.avatar, you: isYou,
        accent: isActive ? LB.gold : isDrawer ? LB.violet : found ? LB.mint : undefined,
        badge: isDrawer ? { text: isActive ? "✏️ stylo" : "binôme", color: isActive ? LB.gold : LB.violet } : found ? { text: fi >= 0 ? `${fi + 1}ᵉ` : "trouvé", color: LB.mint } : undefined,
        score: (game.scores[p.id] ?? 0).toLocaleString("fr-FR"),
      } as RailRow;
    });

  const railSub = game.phase === "reveal"
    ? (revealResult && revealResult.guesserIds.length > 0 ? `${revealResult.guesserIds.length} ont trouvé` : "personne n'a trouvé")
    : `${activeName} tient le crayon`;

  const rail = (
    <Rail kicker={`Relais · manche ${game.round}/${game.totalRounds}`} heading={game.phase === "reveal" ? "Fin du tour" : "En relais"} sub={railSub} rows={railRows} />
  );

  const totalMs = game.config?.drawMs ?? 0;
  const remaining = game.deadline != null ? Math.max(0, game.deadline - room.serverNow()) : 0;
  const frac = totalMs > 0 ? Math.min(1, Math.max(0, 1 - remaining / totalMs)) : 0;
  const barAccent = game.phase === "reveal" ? LB.mint : LB.gold;
  const P = game.phase === "reveal" ? 95 : Math.max(5, Math.min(95, Math.round(frac * 100)));

  return (
    <main style={lbShell} className="lb-scope">
      <style dangerouslySetInnerHTML={{ __html: LB_SCOPED_CSS }} />
      <div style={lbCard}>
        <Aurora tint={game.phase === "reveal" ? "rgba(70,224,176,.12)" : "rgba(255,194,75,.10)"} tint2="rgba(139,125,246,.12)" />
        {rail}

        <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={topBar(barAccent, P)} />
          <div className="lb-mobilehead" style={{ display: "none", alignItems: "center", gap: 10, padding: "12px 18px 0" }}>
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em", color: LB.faint }}>Relais · manche {game.round}/{game.totalRounds}</span>
          </div>

          {/* En-tête */}
          <div className="lb-pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 32px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flexWrap: "wrap" }}>
              {game.phase === "reveal" ? (
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.mint }}>Le mot était</span>
              ) : game.youAreDrawer ? (
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>Dessinez</span>
                  <span style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 800, color: LB.gold, letterSpacing: "-.01em" }}>{game.word}</span>
                </span>
              ) : (
                <MaskedWord segments={game.wordSegments} separators={game.wordSeparators} />
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {secs != null && game.phase !== "reveal" && (
                <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, letterSpacing: ".04em", color: secs <= 5 ? LB.pink : LB.gold }}>{secs}s</span>
              )}
              <SoundToggle />
              {isHost && game.phase === "drawing" && <SkipButton onSkip={room.skipPhase} />}
            </div>
          </div>

          {game.phase === "drawing" && (
            <div className="lb-pad dv-stage" style={{ padding: "6px 32px 20px" }}>
              {/* Bandeau relais : à qui le stylo */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 14 }}>
                {game.youAreDrawer ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 10, padding: "8px 14px", background: hexA(game.youAreActive ? LB.mint : LB.violet, 0.1), boxShadow: `inset 0 0 0 1px ${hexA(game.youAreActive ? LB.mint : LB.violet, 0.45)}` }}>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: game.youAreActive ? LB.mint : LB.violet }}>{game.youAreActive ? "✏️ À toi de dessiner !" : `Au tour de ${activeName}…`}</span>
                    {swapSecs != null && <span style={{ fontSize: 11, color: LB.faint }}>rotation dans {swapSecs}s</span>}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: LB.faint }}>Deux joueurs se relaient au dessin — c'est <span style={{ color: LB.text, fontWeight: 600 }}>{activeName}</span> qui tient le crayon.</span>
                )}
              </div>

              <div className="dv-grid">
                <div className="dv-canvascol" style={{ minWidth: 0 }}>
                  <div className="dv-canvasfill">
                    <DrawCanvas room={room} drawable={game.youAreActive} blind={false} fit />
                  </div>
                  {!game.youAreDrawer && !game.youGuessed && <GuessBar room={room} />}
                  {game.youGuessed && <p style={{ marginTop: 10, textAlign: "center", fontSize: 14, color: LB.mint }}>Bien joué, tu as trouvé ! 🎉</p>}
                  {game.youAreDrawer && !game.youAreActive && <p style={{ marginTop: 10, textAlign: "center", fontSize: 13, color: LB.faint }}>Prépare la suite du dessin…</p>}
                </div>
                <div className="dv-chatcol">
                  <ChatPanel room={room} />
                </div>
              </div>
            </div>
          )}

          {game.phase === "reveal" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 28, textAlign: "center" }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 52, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1, color: LB.gold, textShadow: `0 0 30px ${hexA(LB.gold, 0.4)}` }}>{revealResult?.word}</span>
              <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 8, textAlign: "left", marginTop: 6 }}>
                {[...game.players].sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0)).map((p) => {
                  const drew = revealResult?.drawerIds.includes(p.id);
                  const found = revealResult?.guesserIds.includes(p.id);
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 14, background: drew || found ? hexA(drew ? LB.violet : LB.mint, 0.08) : LB.surface, boxShadow: `0 0 0 1px ${drew ? hexA(LB.violet, 0.4) : found ? hexA(LB.mint, 0.4) : LB.line}` }}>
                      <Avatar name={p.name} color={color(p.id)} avatar={avatarOf(p.id)} size={32} />
                      <span style={{ flex: 1, fontWeight: 600 }}>{p.name}{drew && <span style={{ marginLeft: 8, fontSize: 11, color: LB.violet }}>✏️ a dessiné</span>}{found && <span style={{ marginLeft: 8, fontSize: 11, color: LB.mint }}>a trouvé</span>}</span>
                      <span style={{ fontFamily: DISPLAY, fontWeight: 700, color: LB.gold }}>{game.scores[p.id] ?? 0}</span>
                    </div>
                  );
                })}
              </div>
              <span style={{ fontSize: 13, color: LB.faint }}>Prochain tour dans un instant…</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
