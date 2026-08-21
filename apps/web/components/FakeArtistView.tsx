"use client";

import { useEffect, useState } from "react";
import type { FakeArtistPublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { BoumBackdrop } from "@/components/BoumBackdrop";
import { SoundToggle } from "@/lib/sound";
import { Avatar } from "@/components/Avatar";
import { DrawCanvas, SkipButton } from "@/components/DrawGameView";

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

export function FakeArtistView({ room }: { room: UseRoom }) {
  const game = room.game as FakeArtistPublic;
  const you = room.you;
  const isHost = room.state?.hostId === you;
  const byId = new Map(game.players.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const color = (id: string) => byId.get(id)?.color ?? "#888";
  const avatarOf = (id: string) => byId.get(id)?.avatar;
  const secs = useCountdown(game.deadline, room.serverNow);

  // Which player's canvas I'm looking at (mine by default). Reset to mine each round.
  const [selected, setSelected] = useState<string>(you ?? "");
  useEffect(() => {
    if (game.phase === "drawing" && you) setSelected(you);
  }, [game.round, game.phase, you]);
  const order = [you ?? "", ...game.players.map((p) => p.id).filter((id) => id !== you)];
  const step = (dir: 1 | -1) => {
    const i = Math.max(0, order.indexOf(selected));
    setSelected(order[(i + dir + order.length) % order.length]);
  };
  const isMine = selected === you;
  const observing = game.phase === "drawing" || game.phase === "voting";

  return (
    <>
      <BoumBackdrop />
      <main className="relative z-[1] mx-auto max-w-5xl px-4 py-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">🕵️ Faux-artiste · manche {game.round}/{game.totalRounds}</span>
        <div className="flex items-center gap-2">
          <SoundToggle />
          {secs != null && (
            <span className={`font-mono text-sm tabular-nums ${secs <= 5 ? "text-magenta" : "text-text-muted"}`}>{secs}s</span>
          )}
          {isHost && game.phase !== "scoreboard" && game.phase !== "reveal" && <SkipButton onSkip={room.skipPhase} />}
        </div>
      </div>

      {observing && (
        <div className="animate-pop">
          <div className="mb-3 text-center">
            {game.phase === "drawing" ? (
              game.youAreImpostor ? (
                <p className="font-display text-xl font-bold text-magenta">Tu es le FAUX-ARTISTE 🤫 — bluffe, tu ne connais pas le mot !</p>
              ) : (
                <p className="font-display text-xl font-bold">Dessine : <span className="text-gold">{game.word}</span></p>
              )
            ) : (
              <p className="font-display text-xl font-bold">Observez les toiles, puis votez</p>
            )}
            <p className="mt-1 text-xs text-text-faint">Chacun a sa propre toile. Clique sur un joueur pour regarder son dessin évoluer en direct.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
            {/* player rail */}
            <div className="space-y-1.5">
              <p className="eyebrow px-1">Toiles</p>
              <button
                onClick={() => you && setSelected(you)}
                className={`flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition-colors ${isMine ? "border-gold bg-gold/[0.08]" : "border-ink-border bg-ink-surface hover:border-gold/40"}`}
              >
                <span className="text-lg">🖌️</span>
                <span className="flex-1 font-semibold">Mon tableau</span>
                {isMine && <span className="text-xs text-gold">✎</span>}
              </button>
              {game.players
                .filter((p) => p.id !== you)
                .map((p) => {
                  const on = room.state?.players[p.id]?.isConnected ?? true;
                  const sel = selected === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition-colors ${sel ? "border-gold bg-gold/[0.08]" : "border-ink-border bg-ink-surface hover:border-gold/40"}`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${on ? "bg-mint" : "bg-text-faint"}`} />
                      <Avatar name={p.name} color={p.color} avatar={p.avatar} size={26} />
                      <span className="flex-1 truncate font-medium">{p.name}</span>
                      {sel && <span className="text-xs">👁️</span>}
                    </button>
                  );
                })}
            </div>

            {/* selected canvas */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <button onClick={() => step(-1)} className="rounded-lg border border-ink-border px-2.5 py-1 text-sm text-text-muted hover:border-gold hover:text-text">←</button>
                <span className="flex items-center gap-2 font-display font-bold">
                  {isMine ? "Mon tableau" : `Tableau de ${name(selected)}`}
                  {!isMine && <span className="rounded-full border border-ink-border px-2 py-0.5 text-[11px] font-normal text-text-faint">lecture seule</span>}
                </span>
                <button onClick={() => step(1)} className="rounded-lg border border-ink-border px-2.5 py-1 text-sm text-text-muted hover:border-gold hover:text-text">→</button>
              </div>
              <DrawCanvas
                room={room}
                drawable={isMine && game.phase === "drawing"}
                blind={false}
                authorFilter={selected}
                turnKey={`fa-${game.round}`}
              />
              {!isMine && <p className="mt-2 text-center text-xs text-text-faint">👁️ Tu observes {name(selected)} en direct — tu ne peux pas modifier sa toile.</p>}
            </div>
          </div>

          {game.phase === "voting" && (
            <div className="mx-auto mt-6 max-w-lg text-center">
              <p className="eyebrow mb-1">Qui est le faux-artiste ?</p>
              <p className="mb-3 text-sm text-text-muted">{game.voteCount}/{game.players.length} ont voté</p>
              <div className="flex flex-wrap justify-center gap-2">
                {game.players
                  .filter((p) => p.id !== you)
                  .map((p) => {
                    const picked = game.yourVote === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => room.castVote(p.id)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${picked ? "border-gold bg-gold/[0.10] text-gold" : "border-ink-border bg-ink-surface hover:border-gold/50"}`}
                      >
                        <Avatar name={p.name} color={p.color} avatar={p.avatar} size={24} />
                        <span className="font-semibold">{p.name}</span>
                        {picked && <span>✓</span>}
                      </button>
                    );
                  })}
              </div>
              {game.yourVote && <p className="mt-3 text-sm text-text-faint">Vote enregistré — en attente des autres…</p>}
            </div>
          )}
        </div>
      )}

      {game.phase === "reveal" && game.result && (
        <div className="animate-pop mx-auto max-w-md text-center">
          <p className="eyebrow mb-2">{game.result.caught ? "Démasqué ! 🎯" : "Il vous a bernés… 😈"}</p>
          <h2 className="mb-1 font-display text-2xl font-extrabold">
            Le faux-artiste était <span className="text-magenta">{name(game.result.impostorId)}</span>
          </h2>
          <p className="mb-4 text-sm text-text-muted">
            Le mot était <span className="font-semibold text-gold">{game.result.word}</span>
          </p>
          <div className="space-y-2 text-left">
            {[...game.players]
              .sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0))
              .map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-ink-border bg-ink-surface p-2.5">
                  <Avatar name={p.name} color={color(p.id)} avatar={avatarOf(p.id)} size={32} />
                  <span className="flex-1 font-semibold">
                    {p.name}
                    {p.id === game.result!.impostorId && " 🕵️"}
                  </span>
                  <span className="font-display font-bold tabular-nums text-gold">{game.scores[p.id] ?? 0}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {game.phase === "scoreboard" && (
        <div className="animate-pop grid min-h-[60vh] place-items-center text-center">
          <div className="w-full max-w-sm">
            <div className="mb-4 text-4xl">🏆</div>
            <h1 className="mb-5 font-display text-3xl font-extrabold">Classement final</h1>
            <div className="space-y-2.5 text-left">
              {[...game.players]
                .sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0))
                .map((p, i) => (
                  <div key={p.id} className={`flex items-center gap-3 rounded-xl border p-3 ${i === 0 ? "border-gold bg-gold/[0.10]" : "border-ink-border bg-ink-surface"}`}>
                    <span className={`w-7 text-center font-display text-xl font-extrabold ${i === 0 ? "text-gold" : "text-text-faint"}`}>{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                    <Avatar name={p.name} color={color(p.id)} avatar={avatarOf(p.id)} size={40} />
                    <span className="flex-1 font-semibold">{p.name}{p.id === you && " (toi)"}</span>
                    <span className="font-display font-extrabold tabular-nums text-gold">{game.scores[p.id] ?? 0}</span>
                  </div>
                ))}
            </div>
            <div className="mt-6 space-y-2.5">
              {isHost ? (
                <>
                  <button onClick={() => room.playAgain()} className="w-full rounded-xl bg-gold px-4 py-3.5 font-display font-bold text-ink-deep transition-transform hover:-translate-y-0.5">Rejouer</button>
                  <button onClick={() => room.returnLobby()} className="w-full rounded-xl border border-ink-border px-4 py-3 text-sm font-medium text-text-muted hover:border-gold hover:text-text">Retour au salon</button>
                </>
              ) : (
                <p className="text-sm text-text-muted">En attente de l'hôte…</p>
              )}
            </div>
          </div>
        </div>
      )}
      </main>
    </>
  );
}
