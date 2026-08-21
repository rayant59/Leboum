"use client";

import { useEffect, useState } from "react";
import type { RelayPublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { BoumBackdrop } from "@/components/BoumBackdrop";
import { SoundToggle } from "@/lib/sound";
import { Avatar } from "@/components/Avatar";
import { DrawCanvas, GuessBar, ChatPanel, MaskedWord, SkipButton } from "@/components/DrawGameView";

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

  return (
    <>
      <BoumBackdrop />
      <main className="relative z-[1] mx-auto max-w-5xl px-4 py-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">🔁 Relais · manche {game.round}/{game.totalRounds}</span>
        <div className="flex items-center gap-2">
          <SoundToggle />
          {secs != null && <span className={`font-mono text-sm tabular-nums ${secs <= 5 ? "text-magenta" : "text-text-muted"}`}>{secs}s</span>}
          {isHost && game.phase === "drawing" && (
            <SkipButton onSkip={room.skipPhase} />
          )}
        </div>
      </div>

      {game.phase === "drawing" && (
        <div className="animate-pop">
          <div className="mb-3 text-center">
            {game.youAreDrawer ? (
              <>
                <p className="font-display text-xl font-bold">Dessinez : <span className="text-gold">{game.word}</span></p>
                <p className={`mt-1 text-sm font-medium ${game.youAreActive ? "text-mint" : "text-text-faint"}`}>
                  {game.youAreActive ? "✏️ À toi de dessiner !" : `Au tour de ${activeName}…`}
                  {swapSecs != null && <span className="ml-2 font-mono text-xs text-text-faint">rotation dans {swapSecs}s</span>}
                </p>
              </>
            ) : (
              <>
                <MaskedWord segments={game.wordSegments} separators={game.wordSeparators} />
                <p className="mt-1 text-xs text-text-faint">Deux joueurs se relaient au dessin — c'est {activeName} qui tient le crayon.</p>
              </>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <DrawCanvas room={room} drawable={game.youAreActive} blind={false} />
              {!game.youAreDrawer && !game.youGuessed && <GuessBar room={room} />}
              {game.youGuessed && <p className="mt-3 text-center text-sm text-mint">Bien joué, tu as trouvé ! 🎉</p>}
              {game.youAreDrawer && !game.youAreActive && <p className="mt-3 text-center text-sm text-text-faint">Prépare la suite du dessin…</p>}
            </div>
            <div className="flex min-h-0 flex-col gap-4">
              <div className="rounded-xl border border-ink-border bg-ink-surface p-3">
                <p className="eyebrow mb-2 text-gold">✏️ Dessinateurs</p>
                <div className="flex gap-2">
                  {game.drawerIds.map((id) => (
                    <span key={id} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm ${id === game.activeDrawerId ? "bg-mint/15 text-mint" : "text-text-muted"}`}>
                      <span className="grid h-5 w-5 place-items-center rounded font-display text-[9px] font-bold text-ink-deep" style={{ backgroundColor: color(id) }}>{initials(name(id))}</span>
                      {name(id)}
                    </span>
                  ))}
                </div>
              </div>
              {game.foundOrder.length > 0 && (
                <div className="rounded-xl border border-ink-border bg-ink-surface p-3">
                  <p className="eyebrow mb-2 text-gold">🏆 Ont trouvé</p>
                  <ol className="space-y-1 text-sm">
                    {game.foundOrder.map((id, i) => (
                      <li key={id} className="flex items-center gap-2">
                        <span className="w-4 font-mono text-text-faint">{i + 1}.</span>
                        <span className="font-medium">{name(id)}{id === you && " (toi)"}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <ChatPanel room={room} />
            </div>
          </div>
        </div>
      )}

      {game.phase === "reveal" && (
        <div className="animate-pop text-center">
          <p className="eyebrow mb-2">Le mot était</p>
          <h2 className="mb-4 font-display text-3xl font-extrabold text-gold">{game.result?.word}</h2>
          <div className="mx-auto max-w-sm space-y-2 text-left">
            {[...game.players].sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0)).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-ink-border bg-ink-surface p-2.5">
                <Avatar name={p.name} color={color(p.id)} avatar={avatarOf(p.id)} size={32} />
                <span className="flex-1 font-semibold">{p.name}{game.result?.drawerIds.includes(p.id) && " ✏️"}</span>
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
              {[...game.players].sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0)).map((p, i) => (
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
