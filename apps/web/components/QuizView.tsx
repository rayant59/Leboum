"use client";

import { useEffect, useRef, useState } from "react";
import type { QuizPublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { BoumBackdrop } from "@/components/BoumBackdrop";
import { ResultsScreen } from "@/components/ResultsScreen";
import { SoundToggle, useGameSounds, playSound } from "@/lib/sound";

const MCQ_COLORS = [
  { tint: "#FFC24B", bg: "rgba(255,194,75,0.12)", border: "rgba(255,194,75,0.4)" },
  { tint: "#FF4D8D", bg: "rgba(255,77,141,0.12)", border: "rgba(255,77,141,0.4)" },
  { tint: "#46E0B0", bg: "rgba(70,224,176,0.12)", border: "rgba(70,224,176,0.4)" },
  { tint: "#8B7DF6", bg: "rgba(139,125,246,0.14)", border: "rgba(139,125,246,0.45)" },
];

function useCountdown(deadline: number | null, now: () => number) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);
  if (deadline == null) return null;
  return Math.max(0, Math.ceil((deadline - now()) / 1000));
}

export function QuizView({ room }: { room: UseRoom }) {
  useGameSounds(room);
  const game = room.game as QuizPublic;
  const you = room.you;
  const secs = useCountdown(game.phase === "reveal" ? null : game.deadline, room.serverNow);
  const [freeText, setFreeText] = useState("");
  const answered = you ? game.answeredIds.includes(you) : false;
  const q = game.question;

  // reset the free-text box on each new question
  const idxRef = useRef(game.index);
  useEffect(() => {
    if (idxRef.current !== game.index) { idxRef.current = game.index; setFreeText(""); }
  }, [game.index]);

  // Sound feedback
  const prevPhase = useRef(game.phase);
  useEffect(() => {
    if (prevPhase.current !== game.phase) {
      if (game.phase === "reveal") playSound(game.yourCorrect ? "correct" : "wrong");
      else if (game.phase === "final") playSound("win");
      prevPhase.current = game.phase;
    }
  }, [game.phase, game.yourCorrect]);
  const prevSec = useRef<number | null>(null);
  useEffect(() => {
    if (secs != null && secs !== prevSec.current && game.phase === "question" && secs <= 3 && secs > 0) playSound("tick");
    prevSec.current = secs;
  }, [secs, game.phase]);

  return (
    <>
      <BoumBackdrop />
      <main className="relative z-[1] mx-auto max-w-2xl px-5 py-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-widest text-text-faint">
            {game.phase === "final" ? "Résultats" : `Question ${game.index + 1} / ${game.total}`}
          </span>
          <div className="flex items-center gap-2">
            {game.phase !== "final" && secs != null && (
              <span
                className="grid h-9 min-w-9 place-items-center rounded-full px-2 font-display text-lg font-extrabold tabular-nums"
                style={{
                  color: secs <= 5 ? "#FF4D8D" : "#FFC24B",
                  border: `2px solid ${secs <= 5 ? "rgba(255,77,141,0.5)" : "rgba(255,194,75,0.4)"}`,
                  animation: secs <= 5 ? "wiggle 0.6s ease-in-out infinite" : undefined,
                }}
              >
                {secs}
              </span>
            )}
            <SoundToggle />
          </div>
        </div>

        {(game.phase === "question" || game.phase === "reveal") && q && (
          <div className="animate-pop">
            <p className="mb-1 text-center font-mono text-[11px] uppercase tracking-widest text-magenta">{q.cat}</p>
            <h2 className="mx-auto mb-5 max-w-xl text-center font-display text-2xl font-extrabold leading-tight sm:text-3xl">{q.prompt}</h2>

            {/* MCQ */}
            {q.type === "mcq" && q.choices && (
              <div className="grid gap-3 sm:grid-cols-2">
                {q.choices.map((choice, i) => {
                  const c = MCQ_COLORS[i % 4];
                  const picked = game.yourAnswer === i;
                  const isCorrect = game.phase === "reveal" && game.correctChoice === i;
                  const isWrongPick = game.phase === "reveal" && picked && !isCorrect;
                  return (
                    <button
                      key={i}
                      disabled={answered || game.phase === "reveal"}
                      onClick={() => room.quizAnswer(i)}
                      className="flex items-center gap-3 rounded-2xl border-2 p-4 text-left font-display text-lg font-bold transition-all disabled:cursor-default hover:enabled:-translate-y-0.5"
                      style={{
                        borderColor: isCorrect ? "#46E0B0" : isWrongPick ? "#FF4D8D" : picked ? c.tint : "#332A5A",
                        background: isCorrect ? "rgba(70,224,176,0.14)" : isWrongPick ? "rgba(255,77,141,0.12)" : picked ? c.bg : "rgba(28,22,54,0.6)",
                        opacity: game.phase === "reveal" && !isCorrect && !isWrongPick ? 0.5 : 1,
                      }}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-sm" style={{ color: c.tint, background: c.bg, border: `1px solid ${c.border}` }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1">{choice}</span>
                      {isCorrect && <span className="text-mint">✓</span>}
                      {isWrongPick && <span className="text-magenta">✗</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* True / False */}
            {q.type === "truefalse" && (
              <div className="grid grid-cols-2 gap-3">
                {[{ v: true, label: "Vrai" }, { v: false, label: "Faux" }].map(({ v, label }) => {
                  const picked = game.yourAnswer === v;
                  const isCorrect = game.phase === "reveal" && game.correctBool === v;
                  const isWrongPick = game.phase === "reveal" && picked && !isCorrect;
                  return (
                    <button
                      key={label}
                      disabled={answered || game.phase === "reveal"}
                      onClick={() => room.quizAnswer(v)}
                      className="rounded-2xl border-2 p-6 font-display text-xl font-extrabold transition-all disabled:cursor-default hover:enabled:-translate-y-0.5"
                      style={{
                        borderColor: isCorrect ? "#46E0B0" : isWrongPick ? "#FF4D8D" : picked ? "#FFC24B" : "#332A5A",
                        background: isCorrect ? "rgba(70,224,176,0.14)" : isWrongPick ? "rgba(255,77,141,0.12)" : picked ? "rgba(255,194,75,0.1)" : "rgba(28,22,54,0.6)",
                        opacity: game.phase === "reveal" && !isCorrect && !isWrongPick ? 0.5 : 1,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Free text */}
            {q.type === "free" && (
              <div className="mx-auto max-w-md">
                {game.phase === "question" ? (
                  answered ? (
                    <p className="rounded-2xl border-2 border-mint/40 bg-mint/[0.06] p-4 text-center font-display text-lg font-bold text-mint">Réponse envoyée ✓</p>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={freeText}
                        onChange={(e) => setFreeText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && freeText.trim() && room.quizAnswer(freeText.trim())}
                        autoFocus
                        placeholder="Ta réponse…"
                        className="flex-1 rounded-2xl border-2 border-gold/40 bg-ink-deep px-4 py-3.5 text-lg outline-none focus:border-gold"
                      />
                      <button onClick={() => freeText.trim() && room.quizAnswer(freeText.trim())} className="arc arc-p" style={{ padding: "0 20px" }}>OK</button>
                    </div>
                  )
                ) : (
                  <div className="text-center">
                    <p className="mb-1 text-sm text-text-muted">Bonne réponse :</p>
                    <p className="font-display text-2xl font-extrabold text-mint">{game.correctText}</p>
                  </div>
                )}
              </div>
            )}

            {/* reveal: your result + points */}
            {game.phase === "reveal" && (
              <div className="mt-5 text-center">
                {game.yourCorrect ? (
                  <p className="animate-pop font-display text-xl font-extrabold text-mint">
                    Bravo ! <span className="text-gold">+{game.yourGained}</span> {(game.yourGained ?? 0) >= 900 ? "⚡" : ""}
                  </p>
                ) : (
                  <p className="animate-pop font-display text-lg font-bold text-text-muted">{answered ? "Raté cette fois…" : "Pas de réponse"} · +0</p>
                )}
              </div>
            )}

            {/* who answered / mini ranking */}
            <div className="mt-6">
              {game.phase === "question" ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {game.players.map((p) => {
                    const done = game.answeredIds.includes(p.id);
                    return (
                      <span key={p.id} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${done ? "border-mint/40 bg-mint/[0.06] text-mint" : "border-ink-border text-text-faint"}`}>
                        {done ? "✓" : "○"} {p.name}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <Ranking game={game} you={you} compact />
              )}
            </div>

            {game.phase === "reveal" && (() => {
              const fastest = [...game.ranking].filter((r) => r.gained > 0).sort((a, b) => b.gained - a.gained)[0];
              return fastest ? (
                <p className="mt-3 text-center text-sm text-text-muted">⚡ Le plus rapide : <b className="text-gold">{fastest.name}</b> <span className="text-mint">+{fastest.gained}</span></p>
              ) : null;
            })()}
          </div>
        )}

        {game.phase === "final" && <FinalScreen game={game} you={you} room={room} />}
      </main>
    </>
  );
}

function Ranking({ game, you, compact }: { game: QuizPublic; you: string | null; compact?: boolean }) {
  return (
    <div className="mx-auto max-w-md space-y-1.5">
      {!compact && <p className="eyebrow mb-1 text-center">🏆 Classement</p>}
      {game.ranking.map((r, i) => (
        <div
          key={r.id}
          className="flex items-center gap-3 rounded-xl border p-2.5"
          style={{ borderColor: i === 0 ? "rgba(255,194,75,0.5)" : "#332A5A", background: i === 0 ? "rgba(255,194,75,0.06)" : "rgba(28,22,54,0.5)" }}
        >
          <span className="w-5 text-center font-display font-bold" style={{ color: i === 0 ? "#FFC24B" : "#6E6796" }}>{i + 1}</span>
          <Avatar name={r.name} color={r.color} avatar={r.avatar} size={26} />
          <span className="flex-1 truncate font-medium">{r.name}{r.id === you && " (toi)"}</span>
          {game.phase === "reveal" && r.gained > 0 && <span className="font-mono text-xs text-mint">+{r.gained}</span>}
          <span className="font-display font-bold tabular-nums text-gold">{r.score.toLocaleString("fr-FR")}</span>
        </div>
      ))}
    </div>
  );
}

function FinalScreen({ game, you, room }: { game: QuizPublic; you: string | null; room: UseRoom }) {
  return (
    <ResultsScreen
      ranking={game.ranking.map((r) => ({ id: r.id, name: r.name, color: r.color, avatar: r.avatar, score: r.score }))}
      you={you}
      stats={game.stats}
      isHost={room.state?.hostId === you}
      onReturn={() => room.returnLobby()}
      onReplay={() => room.playAgain()}
    />
  );
}
