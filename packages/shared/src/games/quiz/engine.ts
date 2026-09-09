// ---------------------------------------------------------------------------
// Quiz — pure engine. Server-authoritative: it owns the current question, the
// deadline, answer locking, scoring (exactness + speed), ranking and the flow
// question → reveal → next → final. Clients never decide timing.
// ---------------------------------------------------------------------------

import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { pickQuestions, freeAnswerMatches, type Question } from "./questions";
import type { PublicQuestion, QuizClientAction, QuizMode, QuizPublic, QuizRankRow, QuizSettings, QuizState } from "./types";

const REVEAL_MS = 4500; // time spent on the reveal screen
const BASE_POINTS = 500;
const SPEED_POINTS = 500; // added on top, scaled by remaining time
const SURVIVAL_LIVES = 3;

const ok = (state: QuizState): GameReduceResult<QuizState> => ({ state });

function rec0(players: GamePlayer[]): Record<PlayerId, number> {
  const r: Record<PlayerId, number> = {};
  for (const p of players) r[p.id] = 0;
  return r;
}

/** Valide le mode et le rétrograde si le salon ne remplit pas ses conditions
 *  (Équipes exige 4 joueurs). Tout mode inconnu retombe sur « classique ». */
export function resolveQuizMode(mode: string | undefined, playerCount: number): QuizMode {
  const m = mode as QuizMode;
  if (m === "teams") return playerCount >= 4 ? "teams" : "classic";
  if (m === "speed" || m === "survival") return m;
  return "classic";
}

/** Répartition en 2 équipes équilibrées (alternance après mélange). */
function assignTeams(players: GamePlayer[], rng: () => number): Record<PlayerId, number> {
  const order = [...players].sort(() => rng() - 0.5);
  const teamOf: Record<PlayerId, number> = {};
  order.forEach((p, i) => (teamOf[p.id] = i % 2));
  return teamOf;
}

export function createQuiz(players: GamePlayer[], settings: QuizSettings, ctx: GameContext): QuizState {
  const total = clamp(settings.totalQuestions ?? 10, 3, 20);
  const secs = clamp(settings.secondsPerQuestion ?? 15, 5, 60);
  const types = settings.types && settings.types !== "all" ? [settings.types] : undefined;
  const questions = pickQuestions(total, ctx.rng, types);
  const mode = resolveQuizMode(settings.mode, players.length);
  const lives: Record<PlayerId, number> = {};
  if (mode === "survival") for (const p of players) lives[p.id] = SURVIVAL_LIVES;
  const teamOf = mode === "teams" ? assignTeams(players, ctx.rng) : {};
  return {
    phase: "question",
    players,
    connectedIds: players.map((p) => p.id),
    config: { totalQuestions: questions.length, secondsPerQuestion: secs, types: settings.types ?? "all", mode },
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
    lives,
    teamOf,
  };
}

/** Survie : un joueur est éliminé quand ses vies tombent à 0. */
function isEliminated(state: QuizState, id: PlayerId): boolean {
  return state.config.mode === "survival" && (state.lives[id] ?? SURVIVAL_LIVES) <= 0;
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
      if (isEliminated(state, playerId)) return ok(state); // survie : spectateur
      // Teams : la première réponse d'une équipe la verrouille pour la question.
      if (state.config.mode === "teams") {
        const myTeam = state.teamOf[playerId];
        const teamLocked = Object.keys(state.answers).some((id) => state.teamOf[id] === myTeam);
        if (teamLocked) return ok(state);
      }
      const answers = { ...state.answers, [playerId]: { value: msg.value, at: ctx.now } };
      let next: QuizState = { ...state, answers };
      // Révélation anticipée quand tous les participants « actifs » ont répondu.
      // Survie : on ignore les éliminés. Teams : une réponse par équipe suffit.
      const connected = state.connectedIds.filter((id) => state.players.some((p) => p.id === id) && !isEliminated(state, id));
      const allAnswered =
        state.config.mode === "teams"
          ? [0, 1].every((t) => {
              const members = connected.filter((id) => state.teamOf[id] === t);
              return members.length === 0 || members.some((id) => answers[id]);
            })
          : connected.length > 0 && connected.every((id) => answers[id]);
      if (allAnswered && connected.length > 0) {
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
  const mode = state.config.mode;
  const gained: Record<PlayerId, number> = {};
  const correct: Record<PlayerId, boolean> = {};
  const scores = { ...state.scores };
  const streak = { ...state.streak };
  const bestStreak = { ...state.bestStreak };
  const fastMs = { ...state.fastMs };
  const goodCount = { ...state.goodCount };
  const lives = { ...state.lives };
  const total = state.config.secondsPerQuestion * 1000;

  // Teams : chaque équipe a une réponse unique (celle de son 1er répondant).
  // On calcule sa justesse une fois, puis on l'attribue à tous ses membres.
  const teamCorrect: Record<number, boolean> = {};
  if (mode === "teams" && q) {
    for (const t of [0, 1]) {
      const answerer = state.players.find((p) => state.teamOf[p.id] === t && state.answers[p.id]);
      const a = answerer ? state.answers[answerer.id] : undefined;
      teamCorrect[t] = !!a && isCorrect(q, a.value);
    }
  }

  for (const p of state.players) {
    const a = state.answers[p.id];
    if (mode === "survival" && isEliminated(state, p.id)) {
      // Spectateur : ni point ni pénalité, statu quo.
      gained[p.id] = 0;
      correct[p.id] = false;
      continue;
    }
    const good = mode === "teams" ? !!teamCorrect[state.teamOf[p.id]] : !!a && !!q && isCorrect(q, a.value);
    correct[p.id] = good;

    if (mode === "speed") {
      if (good && a) {
        const timeLeft = Math.max(0, (state.deadline ?? ctx.now) - a.at);
        const frac = total > 0 ? Math.max(0, Math.min(1, timeLeft / total)) : 0;
        const pts = Math.max(1, Math.ceil(3 * frac));
        gained[p.id] = pts;
        scores[p.id] = (scores[p.id] ?? 0) + pts;
        streak[p.id] = (streak[p.id] ?? 0) + 1;
        bestStreak[p.id] = Math.max(bestStreak[p.id] ?? 0, streak[p.id]);
        goodCount[p.id] = (goodCount[p.id] ?? 0) + 1;
        fastMs[p.id] = Math.min(fastMs[p.id] ?? Infinity, total - timeLeft);
      } else {
        gained[p.id] = -1;
        scores[p.id] = Math.max(0, (scores[p.id] ?? 0) - 1); // plancher 0
        streak[p.id] = 0;
      }
      continue;
    }

    if (mode === "survival") {
      if (good && a) {
        gained[p.id] = 1;
        scores[p.id] = (scores[p.id] ?? 0) + 1;
        streak[p.id] = (streak[p.id] ?? 0) + 1;
        bestStreak[p.id] = Math.max(bestStreak[p.id] ?? 0, streak[p.id]);
        goodCount[p.id] = (goodCount[p.id] ?? 0) + 1;
        const timeLeft = Math.max(0, (state.deadline ?? ctx.now) - a.at);
        fastMs[p.id] = Math.min(fastMs[p.id] ?? Infinity, total - timeLeft);
      } else {
        gained[p.id] = 0;
        streak[p.id] = 0;
        lives[p.id] = Math.max(0, (lives[p.id] ?? SURVIVAL_LIVES) - 1); // erreur/non-réponse = −1 vie
      }
      continue;
    }

    if (mode === "teams") {
      if (good) {
        gained[p.id] = 1;
        scores[p.id] = (scores[p.id] ?? 0) + 1; // +1 à chaque membre → score d'équipe partagé
        if (a) goodCount[p.id] = (goodCount[p.id] ?? 0) + 1;
      } else {
        gained[p.id] = 0;
      }
      continue;
    }

    // classic
    if (good && a) {
      const timeLeft = Math.max(0, (state.deadline ?? ctx.now) - a.at);
      const frac = total > 0 ? Math.max(0, Math.min(1, timeLeft / total)) : 0;
      const pts = Math.round(BASE_POINTS + SPEED_POINTS * frac);
      gained[p.id] = pts;
      scores[p.id] = (scores[p.id] ?? 0) + pts;
      streak[p.id] = (streak[p.id] ?? 0) + 1;
      bestStreak[p.id] = Math.max(bestStreak[p.id] ?? 0, streak[p.id]);
      goodCount[p.id] = (goodCount[p.id] ?? 0) + 1;
      fastMs[p.id] = Math.min(fastMs[p.id] ?? Infinity, total - timeLeft);
    } else {
      gained[p.id] = 0;
      streak[p.id] = 0;
    }
  }
  return { ...state, phase: "reveal", gained, correct, scores, streak, bestStreak, fastMs, goodCount, lives, deadline: ctx.now + REVEAL_MS };
}

function nextQuestion(state: QuizState, ctx: GameContext): QuizState {
  const nextIndex = state.index + 1;
  // Survie : si tout le monde est éliminé, la partie s'arrête tout de suite.
  if (state.config.mode === "survival" && state.players.every((p) => (state.lives[p.id] ?? 0) <= 0)) {
    return { ...state, phase: "final", deadline: null };
  }
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
  const mode = state.config.mode;
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
      ...(mode === "survival" ? { lives: state.lives[p.id] ?? 0, eliminated: (state.lives[p.id] ?? 0) <= 0 } : {}),
      ...(mode === "teams" ? { team: state.teamOf[p.id] ?? 0 } : {}),
    }))
    .sort((a, b) => b.score - a.score);

  // Score d'équipe = total d'un membre représentatif (tous les membres partagent
  // le même total puisqu'on crédite chaque membre à chaque bonne réponse d'équipe).
  let teamScores: [number, number] | null = null;
  if (mode === "teams") {
    const repl = (t: number) => {
      const rep = state.players.find((p) => state.teamOf[p.id] === t);
      return rep ? state.scores[rep.id] ?? 0 : 0;
    };
    teamScores = [repl(0), repl(1)];
  }

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
    mode,
    index: state.index,
    total: state.questions.length,
    question: state.phase === "final" ? null : publicQuestion(q),
    deadline: state.deadline,
    secondsPerQuestion: state.config.secondsPerQuestion,
    yourLives: mode === "survival" ? state.lives[viewerId] ?? 0 : null,
    yourEliminated: mode === "survival" && (state.lives[viewerId] ?? 0) <= 0,
    teamScores,
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
