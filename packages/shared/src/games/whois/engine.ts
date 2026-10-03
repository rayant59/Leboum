// Moteur pur de « Qui de nous ? ».
// Flux : question (vote) → révélation (décompte + points) → … → final.
// Barème : voter comme la majorité = +100 (« tu lis dans les pensées de la
// table ») ; être l'élu du tour = +50 (la vedette). Égalité : tous les élus.
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { latePlayers, withZeros, zeroScores } from "../../platform/presence";
import { argmaxAll, clampInt, shuffle } from "../../platform/util";
import { whoisBank } from "./questions";
import {
  WHOIS_CATEGORIES,
  type WhoisCategory,
  type WhoisClientAction,
  type WhoisConfig,
  type WhoisPublic,
  type WhoisSettings,
  type WhoisState,
} from "./types";

export const WHOIS_REVEAL_MS = 7000;
export const WHOIS_MAJORITY_POINTS = 100;
export const WHOIS_ELECTED_POINTS = 50;

const ALL_CATS = Object.keys(WHOIS_CATEGORIES) as WhoisCategory[];

export function resolveWhoisConfig(s: WhoisSettings | undefined): WhoisConfig {
  const mode = s?.mode;
  const categories = mode && (ALL_CATS as string[]).includes(mode) ? [mode as WhoisCategory] : ALL_CATS;
  return {
    totalRounds: clampInt(s?.totalRounds, 3, 25, 10),
    seconds: clampInt(s?.seconds, 8, 120, 20),
    categories,
  };
}


export function createWhois(players: GamePlayer[], settings: WhoisSettings, ctx: GameContext): WhoisState {
  const config = resolveWhoisConfig(settings);
  let pool = shuffle(whoisBank(config.categories), ctx.rng);
  if (pool.length === 0) pool = shuffle(whoisBank(ALL_CATS), ctx.rng);
  const questions = pool.slice(0, config.totalRounds);
  return {
    phase: "question",
    players,
    connectedIds: players.map((p) => p.id),
    config: { ...config, totalRounds: questions.length },
    questions,
    index: 0,
    votes: {},
    deadline: ctx.now + config.seconds * 1000,
    scores: zeroScores(players),
    gained: {},
    tally: {},
    elected: [],
    timesElected: zeroScores(players),
    majorityVotes: zeroScores(players),
    history: [],
  };
}

/** Joueurs attendus pour voter : connectés et dans la partie. */
function expectedVoters(s: WhoisState): PlayerId[] {
  return s.players.map((p) => p.id).filter((id) => s.connectedIds.includes(id));
}

function reveal(s: WhoisState, ctx: GameContext): WhoisState {
  const tally: Record<PlayerId, number> = zeroScores(s.players);
  for (const target of Object.values(s.votes)) tally[target] = (tally[target] ?? 0) + 1;
  const elected = argmaxAll(tally);
  const gained: Record<PlayerId, number> = zeroScores(s.players);
  const scores = { ...s.scores };
  const majorityVotes = { ...s.majorityVotes };
  const timesElected = { ...s.timesElected };
  for (const [voter, target] of Object.entries(s.votes)) {
    if (elected.includes(target)) {
      gained[voter] = (gained[voter] ?? 0) + WHOIS_MAJORITY_POINTS;
      majorityVotes[voter] = (majorityVotes[voter] ?? 0) + 1;
    }
  }
  for (const id of elected) {
    gained[id] = (gained[id] ?? 0) + WHOIS_ELECTED_POINTS;
    timesElected[id] = (timesElected[id] ?? 0) + 1;
  }
  for (const [id, g] of Object.entries(gained)) scores[id] = (scores[id] ?? 0) + g;
  const q = s.questions[s.index];
  return {
    ...s,
    phase: "reveal",
    tally,
    elected,
    gained,
    scores,
    majorityVotes,
    timesElected,
    history: [...s.history, { question: q?.text ?? "", elected, votes: Object.keys(s.votes).length }],
    deadline: ctx.now + WHOIS_REVEAL_MS,
  };
}

function nextQuestion(s: WhoisState, ctx: GameContext): WhoisState {
  const index = s.index + 1;
  if (index >= s.questions.length) return { ...s, phase: "final", deadline: null };
  return { ...s, phase: "question", index, votes: {}, gained: {}, tally: {}, elected: [], deadline: ctx.now + s.config.seconds * 1000 };
}

export function reduceWhois(s: WhoisState, action: GameAction<WhoisClientAction>, ctx: GameContext): GameReduceResult<WhoisState> {
  switch (action.type) {
    case "presence": {
      const added = latePlayers(s.players, action.players);
      let next: WhoisState = { ...s, connectedIds: action.connectedIds };
      if (added.length) {
        next = {
          ...next,
          players: [...s.players, ...added],
          scores: withZeros(s.scores, added),
          timesElected: withZeros(s.timesElected, added),
          majorityVotes: withZeros(s.majorityVotes, added),
        };
      }
      // Quelqu'un est parti : si tous les présents ont voté, on révèle.
      if (next.phase === "question") {
        const voters = expectedVoters(next);
        if (voters.length > 0 && voters.every((id) => next.votes[id])) return { state: reveal(next, ctx) };
      }
      return { state: next };
    }
    case "advance": {
      if (s.phase === "question") return { state: reveal(s, ctx) };
      if (s.phase === "reveal") return { state: nextQuestion(s, ctx) };
      return { state: s };
    }
    case "client": {
      const { playerId, msg } = action;
      if (msg?.kind !== "vote" || s.phase !== "question") return { state: s };
      if (!s.players.some((p) => p.id === playerId)) return { state: s };
      if (msg.targetId === playerId) return { state: s, error: { code: "self_vote", message: "Pas de vote pour toi-même !" } };
      if (!s.players.some((p) => p.id === msg.targetId)) return { state: s };
      if (s.votes[playerId]) return { state: s };
      const next = { ...s, votes: { ...s.votes, [playerId]: msg.targetId } };
      const voters = expectedVoters(next);
      if (voters.length > 0 && voters.every((id) => next.votes[id])) return { state: reveal(next, ctx) };
      return { state: next };
    }
  }
  return { state: s };
}

export function projectWhois(s: WhoisState, viewerId: PlayerId): WhoisPublic {
  const q = s.questions[s.index] ?? null;
  const revealed = s.phase !== "question";
  const final = s.phase === "final";
  return {
    phase: s.phase,
    players: s.players,
    round: Math.min(s.index + 1, s.questions.length),
    totalRounds: s.questions.length,
    question: q,
    categoryLabel: q ? WHOIS_CATEGORIES[q.category] : "",
    deadline: s.deadline,
    seconds: s.config.seconds,
    scores: s.scores,
    votedIds: Object.keys(s.votes),
    yourVote: s.votes[viewerId] ?? null,
    votes: revealed ? s.votes : null,
    tally: revealed ? s.tally : null,
    elected: revealed ? s.elected : [],
    gained: revealed ? s.gained : null,
    timesElected: final ? s.timesElected : null,
    majorityVotes: final ? s.majorityVotes : null,
    history: final ? s.history : null,
  };
}
