// ---------------------------------------------------------------------------
// Quiz — pure engine. Server-authoritative: it owns the current question, the
// deadline, answer locking, scoring (exactness + speed), ranking and the flow
// question → reveal → next → final. Clients never decide timing.
// ---------------------------------------------------------------------------

import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { pickQuestions, freeAnswerMatches, type Question } from "./questions";
import type { PublicQuestion, QuizClientAction, QuizPublic, QuizRankRow, QuizSettings, QuizState } from "./types";

const REVEAL_MS = 4500; // time spent on the reveal screen
const BASE_POINTS = 500;
const SPEED_POINTS = 500; // added on top, scaled by remaining time

const ok = (state: QuizState): GameReduceResult<QuizState> => ({ state });

function rec0(players: GamePlayer[]): Record<PlayerId, number> {
  const r: Record<PlayerId, number> = {};
  for (const p of players) r[p.id] = 0;
  return r;
}

export function createQuiz(players: GamePlayer[], settings: QuizSettings, ctx: GameContext): QuizState {
  const total = clamp(settings.totalQuestions ?? 10, 3, 20);
  const secs = clamp(settings.secondsPerQuestion ?? 15, 5, 60);
  const types = settings.types && settings.types !== "all" ? [settings.types] : undefined;
  const questions = pickQuestions(total, ctx.rng, types);
  return {
    phase: "question",
    players,
    connectedIds: players.map((p) => p.id),
    config: { totalQuestions: questions.length, secondsPerQuestion: secs, types: settings.types ?? "all" },
    questions,
    index: 0,
    startedAt: ctx.now,
    deadline: ctx.now + secs * 1000,
    answers: {},
    scores: rec0(players),
    gained: rec0(players),
    correct: {},
    streak: rec0(players),
    bestStreak: rec0(players),
    fastMs: {},
    goodCount: rec0(players),
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function current(state: QuizState): Question | null {
  return state.questions[state.index] ?? null;
}

function isCorrect(q: Question, value: number | boolean | string): boolean {
  if (q.type === "mcq") return typeof value === "number" && value === q.answer;
  if (q.type === "truefalse") return typeof value === "boolean" && value === q.answer;
  return typeof value === "string" && freeAnswerMatches(value, q);
}

export function reduceQuiz(
  state: QuizState,
  action: GameAction<QuizClientAction>,
  ctx: GameContext,
): GameReduceResult<QuizState> {
  switch (action.type) {
    case "presence":
      return ok({ ...state, connectedIds: action.connectedIds });

    case "client": {
      const { playerId, msg } = action;
      if (msg.kind !== "answer") return ok(state);
      if (state.phase !== "question") return ok(state);
      if (!state.players.some((p) => p.id === playerId)) return ok(state);
      if (state.answers[playerId]) return ok(state); // already answered (locked in)
      if (state.deadline != null && ctx.now > state.deadline) return ok(state); // too late
      const answers = { ...state.answers, [playerId]: { value: msg.value, at: ctx.now } };
      let next: QuizState = { ...state, answers };
      // Early reveal once every connected player has answered.
      const connected = state.connectedIds.filter((id) => state.players.some((p) => p.id === id));
      if (connected.length > 0 && connected.every((id) => answers[id])) {
        next = reveal(next, ctx);
      }
      return ok(next);
    }

    case "advance": {
      if (state.phase === "question" && state.deadline != null && ctx.now >= state.deadline) {
        return ok(reveal(state, ctx));
      }
      if (state.phase === "reveal" && state.deadline != null && ctx.now >= state.deadline) {
        return ok(nextQuestion(state, ctx));
      }
      return ok(state);
    }
  }
}

/** Lock answers, score everyone, move to the reveal screen. */
function reveal(state: QuizState, ctx: GameContext): QuizState {
  const q = current(state);
  const gained: Record<PlayerId, number> = {};
  const correct: Record<PlayerId, boolean> = {};
  const scores = { ...state.scores };
  const streak = { ...state.streak };
  const bestStreak = { ...state.bestStreak };
  const fastMs = { ...state.fastMs };
  const goodCount = { ...state.goodCount };
  const total = state.config.secondsPerQuestion * 1000;
  for (const p of state.players) {
    const a = state.answers[p.id];
    const good = !!a && !!q && isCorrect(q, a.value);
    correct[p.id] = good;
    if (good && a) {
      const timeLeft = Math.max(0, (state.deadline ?? ctx.now) - a.at);
      const frac = total > 0 ? Math.max(0, Math.min(1, timeLeft / total)) : 0;
      const pts = Math.round(BASE_POINTS + SPEED_POINTS * frac);
      gained[p.id] = pts;
      scores[p.id] = (scores[p.id] ?? 0) + pts;
      streak[p.id] = (streak[p.id] ?? 0) + 1;
      bestStreak[p.id] = Math.max(bestStreak[p.id] ?? 0, streak[p.id]);
      goodCount[p.id] = (goodCount[p.id] ?? 0) + 1;
      const answerMs = total - timeLeft;
      fastMs[p.id] = Math.min(fastMs[p.id] ?? Infinity, answerMs);
    } else {
      gained[p.id] = 0;
      streak[p.id] = 0;
    }
  }
  return { ...state, phase: "reveal", gained, correct, scores, streak, bestStreak, fastMs, goodCount, deadline: ctx.now + REVEAL_MS };
}

function nextQuestion(state: QuizState, ctx: GameContext): QuizState {
  const nextIndex = state.index + 1;
  if (nextIndex >= state.questions.length) {
    return { ...state, phase: "final", deadline: null };
  }
  return {
    ...state,
    phase: "question",
    index: nextIndex,
    startedAt: ctx.now,
    deadline: ctx.now + state.config.secondsPerQuestion * 1000,
    answers: {},
    gained: rec0(state.players),
    correct: {},
  };
}

function publicQuestion(q: Question | null): PublicQuestion | null {
  if (!q) return null;
  return { id: q.id, type: q.type, cat: q.cat, prompt: q.prompt, choices: q.type === "mcq" ? q.choices : undefined };
}

function bestBy(state: QuizState, metric: (id: PlayerId) => number, want: "max" | "min"): string | null {
  let best: { id: PlayerId; v: number } | null = null;
  for (const p of state.players) {
    const v = metric(p.id);
    if (!isFinite(v)) continue;
    if (!best || (want === "max" ? v > best.v : v < best.v)) best = { id: p.id, v };
  }
  if (!best || best.v === 0) return null;
  return state.players.find((p) => p.id === best!.id)?.name ?? null;
}

export function projectQuiz(state: QuizState, viewerId: PlayerId): QuizPublic {
  const q = current(state);
  const revealing = state.phase === "reveal";
  const your = state.answers[viewerId];
  const ranking: QuizRankRow[] = [...state.players]
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      avatar: p.avatar,
      score: state.scores[p.id] ?? 0,
      gained: state.gained[p.id] ?? 0,
      correct: !!state.correct[p.id],
      answered: !!state.answers[p.id],
    }))
    .sort((a, b) => b.score - a.score);

  const stats =
    state.phase === "final"
      ? {
          fastest: bestBy(state, (id) => -(state.fastMs[id] ?? Infinity), "max"),
          brain: bestBy(state, (id) => state.goodCount[id] ?? 0, "max"),
          streak: bestBy(state, (id) => state.bestStreak[id] ?? 0, "max"),
        }
      : null;

  return {
    phase: state.phase,
    players: state.players,
    index: state.index,
    total: state.questions.length,
    question: state.phase === "final" ? null : publicQuestion(q),
    deadline: state.deadline,
    secondsPerQuestion: state.config.secondsPerQuestion,
    answeredIds: Object.keys(state.answers),
    yourAnswer: your ? your.value : null,
    ranking,
    correctChoice: revealing && q && q.type === "mcq" ? q.answer : null,
    correctBool: revealing && q && q.type === "truefalse" ? q.answer : null,
    correctText: revealing && q && q.type === "free" ? q.answer : null,
    yourCorrect: revealing ? !!state.correct[viewerId] : null,
    yourGained: revealing ? state.gained[viewerId] ?? 0 : null,
    stats,
  };
}
