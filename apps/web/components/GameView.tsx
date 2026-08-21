"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clipSlots, type CaptionSlot, type GamePlayer, type PublicGameState } from "@subtitles-party/shared";
import type { UseRoom, FloatingReaction } from "@/lib/useRoom";
import { SubtitleStrip } from "./SubtitleStrip";
import { VideoStage } from "./VideoStage";
import { playTick, playChime, playFanfare, SoundToggle } from "@/lib/sound";
import { BoumBackdrop } from "@/components/BoumBackdrop";

function initials(n: string) {
  const p = n.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/** Countdown to a server-set deadline, using the clock-corrected server time. */
function useCountdown(deadline: number | null, serverNow: () => number): number {
  const [, tick] = useState(0);
  useEffect(() => {
    if (deadline == null) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline == null) return 0;
  return Math.max(0, Math.ceil((deadline - serverNow()) / 1000));
}

function Timer({
  deadline,
  serverNow,
  warnAt = 5,
}: {
  deadline: number | null;
  serverNow: () => number;
  warnAt?: number;
}) {
  const s = useCountdown(deadline, serverNow);
  if (deadline == null) return null;
  return (
    <span className={`font-mono text-sm tabular-nums ${s <= warnAt ? "text-magenta" : "text-text-muted"}`}>
      {s}s
    </span>
  );
}

// --- game sound effects: shared Web Audio engine (see lib/sound.ts) ---------

function phaseTotalMs(game: PublicGameState): number | null {
  switch (game.phase) {
    case "watching":
      return game.config.watchingMs;
    case "writing":
      return game.config.writingMs;
    case "screening":
      return game.config.screeningMs;
    case "voting":
      return game.config.votingMs;
    case "results":
      return game.config.resultsMs;
    default:
      return null;
  }
}

/** Full-width progress bar for the current phase + urgency ticks. */
function ProgressBar({ game, serverNow }: { game: PublicGameState; serverNow: () => number }) {
  const total = phaseTotalMs(game);
  const [, setFrame] = useState(0);
  useEffect(() => {
    if (game.deadline == null) return;
    const id = setInterval(() => setFrame((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [game.deadline]);

  const remainingMs = game.deadline == null ? 0 : Math.max(0, game.deadline - serverNow());
  const sec = Math.ceil(remainingMs / 1000);
  const frac = total ? Math.max(0, Math.min(1, remainingMs / total)) : 0;

  const prev = useRef<number | null>(null);
  useEffect(() => {
    const soundPhase = game.phase === "writing" || game.phase === "voting";
    if (soundPhase && prev.current !== null && sec < prev.current && sec <= 3 && sec >= 1) playTick();
    prev.current = sec;
  }, [sec, game.phase]);

  if (game.deadline == null || total == null) return null;
  const urgent = sec <= 5;
  return (
    <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-ink-border/50">
      <div
        className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
          urgent ? "bg-magenta" : "bg-gold"
        }`}
        style={{ width: `${frac * 100}%` }}
      />
    </div>
  );
}

const REACTIONS: { emoji: string; img: string }[] = [
  { emoji: "😂", img: "laugh" },
  { emoji: "😮", img: "wow" },
  { emoji: "🔥", img: "fire" },
  { emoji: "❤️", img: "heart" },
  { emoji: "👏", img: "clap" },
  { emoji: "💀", img: "skull" },
];
const EMOJI_IMG: Record<string, string> = Object.fromEntries(REACTIONS.map((r) => [r.emoji, r.img]));

/** A reaction rendered as its custom image, falling back to the emoji glyph. */
function ReactionIcon({ emoji, size }: { emoji: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const img = EMOJI_IMG[emoji];
  if (img && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={`/reactions/${img}.png`}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        className="object-contain"
        draggable={false}
      />
    );
  }
  return <span style={{ fontSize: Math.round(size * 0.8), lineHeight: 1 }}>{emoji}</span>;
}

/** Falling confetti burst — emoji particles, no image assets. */
function Confetti({ count = 26 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.8 + Math.random() * 1.6,
        size: 14 + Math.random() * 16,
        emoji: ["🎉", "✨", "🎊", "⭐", "💛", "💜"][i % 6],
      })),
    [count],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: 0,
            fontSize: p.size,
            animation: `confetti-fall ${p.dur}s linear ${p.delay}s forwards`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

/** Live reactions floating up from the bottom of the screen. */
function ReactionsLayer({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto max-w-2xl">
      {reactions.map((r) => (
        <span
          key={r.id}
          className="absolute"
          style={{ left: `${r.x}%`, animation: "reaction-float 2.3s ease-out forwards" }}
        >
          <ReactionIcon emoji={r.emoji} size={54} />
        </span>
      ))}
    </div>
  );
}

function ReactionBar({ onReact }: { onReact: (e: string) => void }) {
  return (
    <div className="mt-5 flex justify-center gap-1.5">
      {REACTIONS.map(({ emoji }) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="grid h-12 w-12 place-items-center rounded-full transition-transform hover:-translate-y-0.5 active:scale-90"
          aria-label={`Réagir ${emoji}`}
        >
          <ReactionIcon emoji={emoji} size={46} />
        </button>
      ))}
    </div>
  );
}

/** Cycles playful waiting messages. */
function RotatingHint({ messages, className }: { messages: string[]; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % messages.length), 2600);
    return () => clearInterval(id);
  }, [messages.length]);
  return <span className={className}>{messages[i]}</span>;
}

/** Ease-out count-up to a target number. */
function useCountUp(target: number, ms = 1000): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function GameView({ room }: { room: UseRoom }) {
  const game = room.game as PublicGameState;
  const you = room.you;
  const isHost = room.state?.hostId === you;
  const byId = useMemo(() => new Map(game.players.map((p) => [p.id, p])), [game.players]);
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const color = (id: string) => byId.get(id)?.color ?? "#888";

  // A light chime when the round's results (and final scoreboard) land.
  const prevPhase = useRef(game.phase);
  useEffect(() => {
    if (prevPhase.current !== game.phase) {
      if (game.phase === "results") playChime();
      prevPhase.current = game.phase;
    }
  }, [game.phase]);

  return (
    <>
      <BoumBackdrop />
      <main className="relative z-[1] mx-auto max-w-2xl px-5 py-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {room.status !== "open" && (
        <div className="fixed inset-x-0 top-0 z-50 bg-magenta py-1.5 text-center text-sm font-semibold text-ink-deep shadow-lg">
          Connexion perdue — reconnexion…
        </div>
      )}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-text-faint">
          Manche {game.round}/{game.totalRounds}
        </span>
        <div className="flex items-center gap-2">
          <Timer deadline={game.deadline} serverNow={room.serverNow} />
          <SoundToggle />
          {isHost && game.phase !== "scoreboard" && (
            <button
              onClick={room.skipPhase}
              className="rounded-md border border-ink-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-gold hover:text-text"
            >
              Passer ›
            </button>
          )}
        </div>
      </div>
      <ProgressBar game={game} serverNow={room.serverNow} />

      {game.phase === "watching" && (
        <div className="animate-pop">
          {game.twist && <TwistBanner twist={game.twist} />}
          <VideoStage
            game={game}
            serverNow={room.serverNow}
            onEnded={
              isHost
                ? () => {
                    if (room.game?.phase === "watching") room.skipPhase();
                  }
                : undefined
            }
          />
          <p className="mt-5 text-center text-text-muted">
            Regarde bien la scène… prépare ta réplique.
          </p>
        </div>
      )}
      {game.phase === "screening" && (
        <div className="animate-pop">
          <div className="mb-3 flex items-center justify-center gap-2">
            <SubtitleStrip>et si c'était ça&nbsp;?</SubtitleStrip>
          </div>
          <VideoStage game={game} serverNow={room.serverNow} />
          <p className="mt-4 text-center text-sm text-text-muted">
            Réplique {game.screenIndex + 1} / {game.captions.length} — le vote arrive juste après.
          </p>
        </div>
      )}
      {game.phase === "writing" && <WritingPhase room={room} />}
      {game.phase === "voting" && <VotingPhase room={room} />}
      {game.phase === "results" && <ResultsPhase game={game} you={you} name={name} color={color} />}
      {game.phase === "scoreboard" && <Scoreboard game={game} you={you} room={room} />}

      {(game.phase === "screening" || game.phase === "voting" || game.phase === "results") && (
        <ReactionBar onReact={room.react} />
      )}
      <ReactionsLayer reactions={room.reactions} />
    </main>
    </>
  );
}

// --- phases -----------------------------------------------------------------

/** The round's optional style constraint, shown to everyone. */
function TwistBanner({ twist }: { twist: string }) {
  return (
    <div className="mx-auto mb-4 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-xl border border-magenta/40 bg-magenta/[0.08] px-4 py-2.5 text-center">
      <span className="eyebrow text-magenta">Consigne</span>
      <span className="text-sm font-medium">{twist}</span>
    </div>
  );
}

/** Row of player avatars; those who've acted are lit with a check. */
function Presence({ players, doneIds }: { players: GamePlayer[]; doneIds: string[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {players.map((p) => {
        const done = doneIds.includes(p.id);
        return (
          <span
            key={p.id}
            title={p.name}
            className={`relative grid h-8 w-8 place-items-center rounded-lg font-display text-[11px] font-bold text-ink-deep transition-opacity ${
              done ? "" : "opacity-25"
            }`}
            style={{ backgroundColor: p.color }}
          >
            {initials(p.name)}
            {done && (
              <span className="absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-mint text-[8px] font-bold text-ink-deep">
                ✓
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function WritingPhase({ room }: { room: UseRoom }) {
  const game = room.game as PublicGameState;
  const done = game.youSubmitted;
  const slots = clipSlots(game.clip);
  const dialogue = slots.length > 1;
  const [lines, setLines] = useState<string[]>(() => slots.map(() => ""));
  const submitted = game.submittedIds.length;
  const total = game.players.length;
  const allFilled = lines.length === slots.length && lines.every((l) => l.trim().length > 0);

  const setLine = (i: number, v: string) =>
    setLines((prev) => prev.map((l, j) => (j === i ? v : l)));

  return (
    <div className="animate-pop">
      <VideoStage game={game} serverNow={room.serverNow} />
      <Presence players={game.players} doneIds={game.submittedIds} />
      {game.twist && <TwistBanner twist={game.twist} />}
      <h2 className="mt-5 font-display text-xl font-bold">
        {dialogue ? "Écris le dialogue" : "À toi d'écrire le sous-titre"}
      </h2>
      <p className="mb-3 text-sm text-text-muted">
        {dialogue
          ? "Une réplique par personnage — le plus drôle possible."
          : "Le plus drôle, absurde ou inattendu possible."}
      </p>

      {done ? (
        <div className="space-y-2">
          <div className="rounded-xl border border-mint/40 bg-mint/[0.06] p-4 text-center">
            <p className="font-medium text-mint">{dialogue ? "Dialogue envoyé ✓" : "Réplique envoyée ✓"}</p>
            <p className="mt-1 text-sm text-text-muted">
              {submitted}/{total} ont écrit —{" "}
              <RotatingHint
                messages={["on attend les autres…", "les cerveaux chauffent…", "quelqu'un réfléchit (trop ?)…"]}
              />
            </p>
          </div>
          {room.state?.hostId === room.you && submitted < total && (
            <button
              onClick={() => room.debugFill()}
              className="w-full rounded-xl border border-dashed border-ink-border px-4 py-2.5 text-sm text-text-muted transition-colors hover:border-magenta hover:text-magenta"
            >
              ✍️ Écrire pour tout le monde (test)
            </button>
          )}
        </div>
      ) : (
        <>
          {dialogue ? (
            <div className="space-y-3">
              {slots.map((slot, i) => (
                <div key={slot.id}>
                  <label className="mb-1 block text-xs font-medium text-text-muted">
                    {slot.speaker ? `Réplique ${i + 1} · ${slot.speaker}` : `Réplique ${i + 1}`}
                  </label>
                  <input
                    autoFocus={i === 0}
                    value={lines[i] ?? ""}
                    onChange={(e) => setLine(i, e.target.value)}
                    maxLength={140}
                    placeholder="…"
                    className="w-full rounded-xl border border-ink-border bg-ink-deep px-3.5 py-2.5 text-base focus:border-gold"
                  />
                </div>
              ))}
            </div>
          ) : (
            <>
              <textarea
                autoFocus
                value={lines[0] ?? ""}
                onChange={(e) => setLine(0, e.target.value)}
                maxLength={140}
                placeholder="Tape ta réplique…"
                className="min-h-[84px] w-full resize-none rounded-xl border border-ink-border bg-ink-deep px-3.5 py-3 text-base leading-snug focus:border-gold"
              />
              <div className="mb-1 mt-1.5 text-right text-xs text-text-faint">{(lines[0] ?? "").length}/140</div>
            </>
          )}
          <button
            onClick={() => room.submitLines(lines.map((l) => l.trim()))}
            disabled={!allFilled}
            className="mt-3 w-full rounded-xl bg-gold px-4 py-3.5 font-display font-bold text-ink-deep transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-40"
          >
            {dialogue ? "Valider mon dialogue" : "Valider ma réplique"}
          </button>
          {room.state?.hostId === room.you && (
            <button
              onClick={() => room.debugFill()}
              className="mt-2 w-full rounded-xl border border-dashed border-ink-border px-4 py-2.5 text-sm text-text-muted transition-colors hover:border-magenta hover:text-magenta"
            >
              ✍️ Écrire pour tout le monde (test)
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Renders a submission's line(s), with speaker labels for dialogue scenes. */
function Lines({ lines, slots }: { lines: string[]; slots: CaptionSlot[] }) {
  if (lines.length <= 1) return <span>{lines[0] ?? ""}</span>;
  return (
    <span className="block space-y-1">
      {lines.map((line, i) => (
        <span key={i} className="block">
          {slots[i]?.speaker && (
            <span className="mr-1 font-semibold text-gold">{slots[i]!.speaker} :</span>
          )}
          {line}
        </span>
      ))}
    </span>
  );
}

function VotingPhase({ room }: { room: UseRoom }) {
  const game = room.game as PublicGameState;
  const captions = game.captions;
  const slots = clipSlots(game.clip);
  const myVote = game.yourVote;
  const voted = typeof myVote === "string";

  return (
    <div className="animate-pop">
      <h2 className="font-display text-xl font-bold">Vote pour ta préférée</h2>
      <p className="mb-4 text-sm text-text-muted">Impossible de voter pour la tienne.</p>

      <div className="space-y-2.5">
        {captions.map(({ token, lines }) => {
          const mine = token === game.yourToken;
          const chosen = myVote === token;
          return (
            <button
              key={token}
              onClick={() => !mine && !voted && room.vote(token)}
              disabled={mine || voted}
              className={`relative w-full rounded-xl border p-3.5 pr-20 text-left text-base transition-all ${
                chosen
                  ? "border-mint bg-mint/[0.08]"
                  : "border-ink-border bg-ink-surface enabled:hover:-translate-y-px enabled:hover:border-gold"
              } ${mine ? "border-dashed opacity-70" : ""}`}
            >
              <Lines lines={lines} slots={slots} />
              {mine && (
                <span className="absolute right-3 top-2 font-mono text-[11px] text-text-faint">
                  la tienne
                </span>
              )}
              {chosen && (
                <span className="absolute right-3 top-2 font-mono text-[11px] text-mint">
                  ✓ ton vote
                </span>
              )}
            </button>
          );
        })}
      </div>

      {voted && (
        <p className="mt-4 text-center text-sm text-text-muted">
          <RotatingHint
            messages={["on attend les autres votes…", "ça se joue serré…", "le jury délibère…"]}
          />
        </p>
      )}
    </div>
  );
}

function ResultsPhase({
  game,
  you,
  name,
  color,
}: {
  game: PublicGameState;
  you: string;
  name: (id: string) => string;
  color: (id: string) => string;
}) {
  const results = game.roundResults ?? [];
  const slots = clipSlots(game.clip);
  // Reveal from fewest votes to most, so the winner lands last (the payoff).
  const ordered = useMemo(() => [...results].reverse(), [results]);
  const total = ordered.length;
  const [revealed, setRevealed] = useState(0);
  const firedFanfare = useRef(false);

  useEffect(() => {
    setRevealed(0);
    firedFanfare.current = false;
    if (total === 0) return;
    const windowMs = Math.min(4500, Math.max(1600, game.config.resultsMs * 0.7));
    const step = Math.max(320, windowMs / total);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setRevealed(n);
      if (n >= total) clearInterval(id);
    }, step);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, game.round]);

  useEffect(() => {
    if (!firedFanfare.current && total > 0 && revealed >= total) {
      firedFanfare.current = true;
      if ((ordered[total - 1]?.points ?? 0) > 0) playFanfare();
    }
  }, [revealed, total, ordered]);

  const done = revealed >= total;
  const shown = ordered.slice(0, revealed);
  const winnerRevealed = done && (ordered[total - 1]?.points ?? 0) > 0;

  return (
    <div>
      {winnerRevealed && <Confetti count={18} />}
      <h2 className="font-display text-xl font-bold">Résultats de la manche</h2>
      <p className="mb-4 text-sm text-text-muted">
        {done ? "Qui a fait mouche ?" : "Roulement de tambour…"}
      </p>
      <div className="space-y-2.5">
        {shown.map((r, idx) => {
          const isWinner = done && idx === total - 1 && r.points > 0;
          return (
            <div
              key={r.authorId}
              className={`animate-pop rounded-xl border p-3.5 ${
                isWinner ? "border-gold bg-gold/[0.12]" : "border-ink-border bg-ink-surface"
              }`}
              style={isWinner ? { animation: "revealPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both, winnerGlow 2.4s ease-in-out 0.5s infinite" } : undefined}
            >
              {isWinner && (
                <div className="mb-1.5 animate-pop text-center font-display text-sm font-extrabold text-gold">
                  🎉 Manche remportée !
                </div>
              )}
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className="grid h-6 w-6 place-items-center rounded-md font-display text-[11px] font-bold text-ink-deep"
                  style={{ backgroundColor: color(r.authorId) }}
                >
                  {initials(name(r.authorId))}
                </span>
                <span className="font-semibold">
                  {name(r.authorId)}
                  {r.authorId === you && " (toi)"}
                </span>
                <span className="ml-auto font-display font-bold tabular-nums text-gold">+{r.points}</span>
              </div>
              <div className="text-base">
                <Lines lines={r.lines} slots={slots} />
              </div>
              <div className="mt-2 text-[13px] text-text-muted">
                {r.voterIds.length ? `★ ${r.voterIds.map(name).join(", ")}` : "aucun vote"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreRow({
  player,
  rank,
  you,
  score,
}: {
  player: GamePlayer;
  rank: number;
  you: string;
  score: number;
}) {
  const shown = useCountUp(score, 1100);
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div
      className={`animate-pop flex items-center gap-3 rounded-xl border p-3 ${
        rank === 0 ? "border-gold bg-gold/[0.10]" : "border-ink-border bg-ink-surface"
      }`}
      style={{ animationDelay: `${rank * 90}ms` }}
    >
      <span
        className={`w-7 text-center font-display text-xl font-extrabold ${
          rank === 0 ? "text-gold" : "text-text-faint"
        }`}
      >
        {medals[rank] ?? rank + 1}
      </span>
      <span
        className="grid h-10 w-10 place-items-center rounded-lg font-display font-bold text-ink-deep"
        style={{ backgroundColor: player.color }}
      >
        {initials(player.name)}
      </span>
      <span className="flex-1 font-semibold">
        {player.name}
        {player.id === you && " (toi)"}
      </span>
      <span className="font-display font-extrabold tabular-nums text-gold">{shown}</span>
    </div>
  );
}

function Scoreboard({
  game,
  you,
  room,
}: {
  game: PublicGameState;
  you: string;
  room: UseRoom;
}) {
  const rows = [...game.players].sort(
    (a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0),
  );
  const isHost = room.state?.hostId === you;
  const champion = rows[0];
  const hasWinner = champion && (game.scores[champion.id] ?? 0) > 0;

  useEffect(() => {
    if (hasWinner) playFanfare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      {hasWinner && <Confetti />}
      <div className="w-full animate-pop">
        <div className="mb-3 flex justify-center">
          <SubtitleStrip>et le meilleur scénariste est…</SubtitleStrip>
        </div>
        <h1 className="mb-4 font-display text-3xl font-extrabold">Classement final</h1>
        {hasWinner && (
          <div className="mb-5 animate-pop">
            <div className="text-4xl">🏆</div>
            <div className="font-display text-lg font-extrabold text-gold">
              {champion.name}
              {champion.id === you && " (toi)"} !
            </div>
          </div>
        )}
        <div className="space-y-2.5 text-left">
          {rows.map((p, i) => (
            <ScoreRow key={p.id} player={p} rank={i} you={you} score={game.scores[p.id] ?? 0} />
          ))}
        </div>

        <div className="mt-6 space-y-2.5">
          {isHost ? (
            <>
              <button
                onClick={() => room.playAgain()}
                className="w-full rounded-xl bg-gold px-4 py-3.5 font-display font-bold text-ink-deep transition-transform hover:-translate-y-0.5"
              >
                Rejouer une partie
              </button>
              <button
                onClick={() => room.returnLobby()}
                className="w-full rounded-xl border border-ink-border px-4 py-3 text-sm font-medium text-text-muted transition-colors hover:border-gold hover:text-text"
              >
                Retour au salon
              </button>
            </>
          ) : (
            <p className="text-sm text-text-muted">En attente de l'hôte…</p>
          )}
        </div>
      </div>
    </div>
  );
}
