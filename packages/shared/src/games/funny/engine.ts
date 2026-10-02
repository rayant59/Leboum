// Moteur pur de « La Plus Drôle ».
// Flux : écriture → révélation (lecture anonyme) → vote → résultats → … → final.
// Barème : +100 par vote reçu ; la ou les réponses les plus votées : +50.
// Anonymat : les auteurs sont cachés derrière des jetons jusqu'aux résultats.
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { latePlayers, withZeros } from "../../platform/presence";
import { argmaxAll, clampInt, shuffle } from "../../platform/util";
import { funnyPromptBank } from "./prompts";
import type { FunnyClientAction, FunnyConfig, FunnyPublic, FunnySettings, FunnyState } from "./types";

export const FUNNY_MAX_CHARS = 80;
export const FUNNY_VOTE_POINTS = 100;
export const FUNNY_WIN_BONUS = 50;
export const FUNNY_RESULTS_MS = 9000;
/** Lecture : 2,5 s par réponse, entre 5 et 20 s. */
export const funnyRevealMs = (n: number) => Math.max(5000, Math.min(20000, n * 2500));

export function resolveFunnyConfig(s: FunnySettings | undefined): FunnyConfig {
  return {
    totalRounds: clampInt(s?.totalRounds, 2, 12, 5),
    writeSeconds: clampInt(s?.seconds, 20, 180, 60),
    voteSeconds: 30,
    maxChars: FUNNY_MAX_CHARS,
  };
}

const zeros = (players: GamePlayer[]) => Object.fromEntries(players.map((p) => [p.id, 0]));

/** Nettoie une réponse : espaces compactés, longueur bornée. */
export function cleanAnswer(text: unknown): string {
  if (typeof text !== "string") return "";
  return text.replace(/\s+/g, " ").trim().slice(0, FUNNY_MAX_CHARS);
}

export function createFunny(players: GamePlayer[], settings: FunnySettings, ctx: GameContext): FunnyState {
  const config = resolveFunnyConfig(settings);
  const prompts = shuffle(funnyPromptBank(), ctx.rng).slice(0, config.totalRounds);
  return {
    phase: "write",
    players,
    connectedIds: players.map((p) => p.id),
    config: { ...config, totalRounds: prompts.length },
    prompts,
    index: 0,
    answers: {},
    tokens: {},
    order: [],
    votes: {},
    deadline: ctx.now + config.writeSeconds * 1000,
    phaseMs: config.writeSeconds * 1000,
    scores: zeros(players),
    gained: {},
    winners: [],
    votesReceived: zeros(players),
    roundWins: zeros(players),
    best: [],
  };
}

const present = (s: FunnyState) => s.players.map((p) => p.id).filter((id) => s.connectedIds.includes(id));

/** Fin de l'écriture : on mélange les réponses derrière des jetons. */
function toReveal(s: FunnyState, ctx: GameContext): FunnyState {
  const authors = shuffle(Object.keys(s.answers), ctx.rng);
  if (authors.length === 0) return toResults({ ...s, tokens: {}, order: [] }, ctx);
  const tokens: Record<string, PlayerId> = {};
  const order: string[] = [];
  authors.forEach((a, i) => {
    const t = `r${s.index + 1}-${i + 1}-${Math.floor(ctx.rng() * 1e6).toString(36)}`;
    tokens[t] = a;
    order.push(t);
  });
  const ms = funnyRevealMs(order.length);
  return { ...s, phase: "reveal", tokens, order, votes: {}, deadline: ctx.now + ms, phaseMs: ms };
}

/** Votants attendus : présents ayant au moins une réponse (d'un autre) à choisir. */
function expectedVoters(s: FunnyState): PlayerId[] {
  return present(s).filter((id) => s.order.some((t) => s.tokens[t] !== id));
}

function toVote(s: FunnyState, ctx: GameContext): FunnyState {
  // Moins de 2 réponses : rien à départager, on passe aux résultats.
  if (s.order.length < 2) return toResults(s, ctx);
  const ms = s.config.voteSeconds * 1000;
  return { ...s, phase: "vote", deadline: ctx.now + ms, phaseMs: ms };
}

function toResults(s: FunnyState, ctx: GameContext): FunnyState {
  const count: Record<string, number> = Object.fromEntries(s.order.map((t) => [t, 0]));
  for (const t of Object.values(s.votes)) if (count[t] != null) count[t]++;
  const winners = argmaxAll(count);
  const gained: Record<PlayerId, number> = zeros(s.players);
  const scores = { ...s.scores };
  const votesReceived = { ...s.votesReceived };
  const roundWins = { ...s.roundWins };
  for (const t of s.order) {
    const author = s.tokens[t];
    const n = count[t] ?? 0;
    const g = n * FUNNY_VOTE_POINTS + (winners.includes(t) ? FUNNY_WIN_BONUS : 0);
    gained[author] = g;
    scores[author] = (scores[author] ?? 0) + g;
    votesReceived[author] = (votesReceived[author] ?? 0) + n;
    if (winners.includes(t)) roundWins[author] = (roundWins[author] ?? 0) + 1;
  }
  const prompt = s.prompts[s.index] ?? "";
  const best = [...s.best, ...winners.map((t) => ({ prompt, text: s.answers[s.tokens[t]] ?? "", authorId: s.tokens[t], votes: count[t] ?? 0 }))];
  return { ...s, phase: "results", winners, gained, scores, votesReceived, roundWins, best, deadline: ctx.now + FUNNY_RESULTS_MS, phaseMs: FUNNY_RESULTS_MS };
}

function nextRound(s: FunnyState, ctx: GameContext): FunnyState {
  const index = s.index + 1;
  if (index >= s.prompts.length) return { ...s, phase: "final", deadline: null, phaseMs: 0 };
  const ms = s.config.writeSeconds * 1000;
  return { ...s, phase: "write", index, answers: {}, tokens: {}, order: [], votes: {}, gained: {}, winners: [], deadline: ctx.now + ms, phaseMs: ms };
}

function maybeAuto(s: FunnyState, ctx: GameContext): FunnyState {
  if (s.phase === "write") {
    const ids = present(s);
    if (ids.length > 0 && ids.every((id) => s.answers[id])) return toReveal(s, ctx);
  } else if (s.phase === "vote") {
    const voters = expectedVoters(s);
    if (voters.length > 0 && voters.every((id) => s.votes[id])) return toResults(s, ctx);
  }
  return s;
}

export function reduceFunny(s: FunnyState, action: GameAction<FunnyClientAction>, ctx: GameContext): GameReduceResult<FunnyState> {
  switch (action.type) {
    case "presence": {
      const added = latePlayers(s.players, action.players);
      let next: FunnyState = { ...s, connectedIds: action.connectedIds };
      if (added.length) {
        next = {
          ...next,
          players: [...s.players, ...added],
          scores: withZeros(s.scores, added),
          votesReceived: withZeros(s.votesReceived, added),
          roundWins: withZeros(s.roundWins, added),
        };
      }
      return { state: maybeAuto(next, ctx) };
    }
    case "advance": {
      switch (s.phase) {
        case "write": return { state: toReveal(s, ctx) };
        case "reveal": return { state: toVote(s, ctx) };
        case "vote": return { state: toResults(s, ctx) };
        case "results": return { state: nextRound(s, ctx) };
        default: return { state: s };
      }
    }
    case "client": {
      const { playerId, msg } = action;
      if (!s.players.some((p) => p.id === playerId)) return { state: s };
      if (msg?.kind === "answer") {
        if (s.phase !== "write") return { state: s };
        const text = cleanAnswer(msg.text);
        if (!text) return { state: s, error: { code: "empty_answer", message: "Écris quelque chose !" } };
        return { state: maybeAuto({ ...s, answers: { ...s.answers, [playerId]: text } }, ctx) };
      }
      if (msg?.kind === "vote") {
        if (s.phase !== "vote" || s.votes[playerId]) return { state: s };
        const author = s.tokens[msg.token];
        if (!author) return { state: s };
        if (author === playerId) return { state: s, error: { code: "self_vote", message: "Pas de vote pour ta propre réponse !" } };
        return { state: maybeAuto({ ...s, votes: { ...s.votes, [playerId]: msg.token } }, ctx) };
      }
      return { state: s };
    }
  }
  return { state: s };
}

export function projectFunny(s: FunnyState, viewerId: PlayerId): FunnyPublic {
  const showAnswers = s.phase === "reveal" || s.phase === "vote" || s.phase === "results";
  const yourToken = s.order.find((t) => s.tokens[t] === viewerId) ?? null;
  let results: FunnyPublic["results"] = null;
  if (s.phase === "results") {
    results = s.order
      .map((t) => {
        const voters = Object.entries(s.votes).filter(([, v]) => v === t).map(([id]) => id);
        const authorId = s.tokens[t];
        return { token: t, text: s.answers[authorId] ?? "", authorId, votes: voters.length, voters, gained: s.gained[authorId] ?? 0, winner: s.winners.includes(t) };
      })
      .sort((a, b) => b.votes - a.votes);
  }
  const final = s.phase === "final";
  return {
    phase: s.phase,
    players: s.players,
    round: Math.min(s.index + 1, s.prompts.length),
    totalRounds: s.prompts.length,
    prompt: s.prompts[s.index] ?? "",
    deadline: s.deadline,
    phaseSeconds: Math.round(s.phaseMs / 1000),
    maxChars: s.config.maxChars,
    scores: s.scores,
    submittedIds: Object.keys(s.answers),
    yourAnswer: s.answers[viewerId] ?? null,
    answers: showAnswers ? s.order.map((t) => ({ token: t, text: s.answers[s.tokens[t]] ?? "" })) : null,
    yourToken: showAnswers ? yourToken : null,
    votedIds: Object.keys(s.votes),
    yourVote: s.votes[viewerId] ?? null,
    results,
    best: final ? s.best.slice().sort((a, b) => b.votes - a.votes).slice(0, 6) : null,
    votesReceived: final ? s.votesReceived : null,
    roundWins: final ? s.roundWins : null,
  };
}
