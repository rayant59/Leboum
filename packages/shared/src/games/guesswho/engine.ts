// Moteur pur de « Devine qui ».
// Manche : secret (le Maître découvre la personne) → questions (chrono +
// stock limité) → révélation. Le rôle de Maître tourne à chaque manche.
//
// Barème :
//   • celui qui trouve : +100, +10 par question restante (trouver vite paie)
//   • le Maître du secret : +50 si la table trouve (il a intérêt à bien répondre)
//   • mauvaise proposition : coûte une question au stock commun
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { latePlayers, withZeros } from "../../platform/presence";
import { isWordGuess, normalizeWord } from "../../platform/text";
import { clampInt, shuffle } from "../../platform/util";
import { guessWhoBank } from "./people";
import type { Celebrity, GuessWhoClientAction, GuessWhoConfig, GuessWhoMode, GuessWhoPublic, GuessWhoSettings, GuessWhoState } from "./types";

export const GUESSWHO_SECRET_MS = 10_000;
export const GUESSWHO_REVEAL_MS = 8_000;
export const GUESSWHO_FIND_POINTS = 100;
export const GUESSWHO_PER_LEFT = 10;
export const GUESSWHO_MASTER_POINTS = 50;
export const GUESSWHO_MAX_QUESTIONS = 20;
export const GUESSWHO_TEXT_MAX = 100;

export function resolveGuessWhoConfig(s: GuessWhoSettings | undefined): GuessWhoConfig {
  const mode: GuessWhoMode = s?.mode === "entrenous" ? "entrenous" : "celebrites";
  return {
    totalRounds: clampInt(s?.totalRounds, 1, 10, 4),
    seconds: clampInt(s?.seconds, 45, 300, 120),
    maxQuestions: GUESSWHO_MAX_QUESTIONS,
    mode,
  };
}

/** La proposition désigne-t-elle bien la personne ? (nom, alias, nom de famille). */
export function isCelebrityGuess(guess: string, c: Celebrity): boolean {
  const names = [c.name, ...(c.aliases ?? [])];
  if (names.some((n) => isWordGuess(guess, n))) return true;
  const last = normalizeWord(c.name).split(" ").pop() ?? "";
  return last.length >= 4 && isWordGuess(guess, last);
}

const zeros = (players: GamePlayer[]) => Object.fromEntries(players.map((p) => [p.id, 0]));
export const masterOf = (s: Pick<GuessWhoState, "order" | "round">): PlayerId | null => (s.order.length ? s.order[s.round % s.order.length] : null);
const isOn = (s: GuessWhoState, id: PlayerId | null) => !!id && s.connectedIds.includes(id);

export function createGuessWho(players: GamePlayer[], settings: GuessWhoSettings, ctx: GameContext): GuessWhoState {
  const config = resolveGuessWhoConfig(settings);
  const base: GuessWhoState = {
    phase: "secret",
    players,
    connectedIds: players.map((p) => p.id),
    config,
    order: shuffle(players.map((p) => p.id), ctx.rng),
    round: 0,
    deck: shuffle(guessWhoBank(), ctx.rng),
    celebrity: null,
    secretPlayerId: null,
    questions: [],
    guesses: [],
    nextId: 1,
    left: config.maxQuestions,
    finderId: null,
    deadline: null,
    phaseMs: 0,
    scores: zeros(players),
    gained: {},
    founds: zeros(players),
    masterWins: zeros(players),
  };
  return startRound(base, 0, ctx);
}

function startRound(s: GuessWhoState, round: number, ctx: GameContext): GuessWhoState {
  let r = round;
  while (r < s.config.totalRounds && !isOn(s, masterOf({ ...s, round: r }))) r++;
  if (r >= s.config.totalRounds) return { ...s, phase: "final", deadline: null, phaseMs: 0, round: Math.max(0, s.config.totalRounds - 1) };
  const master = masterOf({ ...s, round: r })!;
  let deck = s.deck;
  if (!deck.length) deck = shuffle(guessWhoBank(), ctx.rng);
  let celebrity: Celebrity | null = null;
  let secretPlayerId: PlayerId | null = null;
  if (s.config.mode === "celebrites") {
    celebrity = deck[0];
    deck = deck.slice(1);
  } else {
    const pool = s.players.map((p) => p.id).filter((id) => id !== master && isOn(s, id));
    secretPlayerId = pool[Math.floor(ctx.rng() * pool.length)] ?? null;
  }
  return {
    ...s,
    phase: "secret",
    round: r,
    deck,
    celebrity,
    secretPlayerId,
    questions: [],
    guesses: [],
    left: s.config.maxQuestions,
    finderId: null,
    gained: {},
    deadline: ctx.now + GUESSWHO_SECRET_MS,
    phaseMs: GUESSWHO_SECRET_MS,
  };
}

function startAsk(s: GuessWhoState, ctx: GameContext): GuessWhoState {
  const ms = s.config.seconds * 1000;
  return { ...s, phase: "ask", deadline: ctx.now + ms, phaseMs: ms };
}

function reveal(s: GuessWhoState, finderId: PlayerId | null, ctx: GameContext): GuessWhoState {
  const master = masterOf(s)!;
  const gained: Record<PlayerId, number> = {};
  if (finderId) {
    gained[finderId] = GUESSWHO_FIND_POINTS + GUESSWHO_PER_LEFT * s.left;
    gained[master] = (gained[master] ?? 0) + GUESSWHO_MASTER_POINTS;
  }
  const scores = { ...s.scores };
  for (const [id, v] of Object.entries(gained)) scores[id] = (scores[id] ?? 0) + v;
  return {
    ...s,
    phase: "reveal",
    finderId,
    gained,
    scores,
    founds: finderId ? { ...s.founds, [finderId]: (s.founds[finderId] ?? 0) + 1 } : s.founds,
    masterWins: finderId ? { ...s.masterWins, [master]: (s.masterWins[master] ?? 0) + 1 } : s.masterWins,
    deadline: ctx.now + GUESSWHO_REVEAL_MS,
    phaseMs: GUESSWHO_REVEAL_MS,
  };
}

const nameOf = (s: GuessWhoState, id: PlayerId) => s.players.find((p) => p.id === id)?.name ?? "?";

export function reduceGuessWho(s: GuessWhoState, action: GameAction<GuessWhoClientAction>, ctx: GameContext): GameReduceResult<GuessWhoState> {
  switch (action.type) {
    case "presence": {
      const added = latePlayers(s.players, action.players);
      let next: GuessWhoState = { ...s, connectedIds: action.connectedIds };
      if (added.length) {
        next = {
          ...next,
          players: [...s.players, ...added],
          order: s.phase === "final" ? s.order : [...s.order, ...added.map((p) => p.id)],
          scores: withZeros(s.scores, added),
          founds: withZeros(s.founds, added),
          masterWins: withZeros(s.masterWins, added),
        };
      }
      // Le Maître est parti (ou la personne mystère en « entre nous ») : manche suivante.
      const live = next.phase === "secret" || next.phase === "ask";
      if (live && (!isOn(next, masterOf(next)) || (next.secretPlayerId && !isOn(next, next.secretPlayerId)))) {
        return { state: startRound(next, next.round + 1, ctx) };
      }
      return { state: next };
    }
    case "advance": {
      if (s.phase === "secret") return { state: startAsk(s, ctx) };
      if (s.phase === "ask") return { state: reveal(s, null, ctx) };
      if (s.phase === "reveal") return { state: startRound(s, s.round + 1, ctx) };
      return { state: s };
    }
    case "client": {
      const { playerId, msg } = action;
      const master = masterOf(s);
      const isMaster = playerId === master;
      if (!s.players.some((p) => p.id === playerId)) return { state: s };
      switch (msg?.kind) {
        case "ready":
          return { state: s.phase === "secret" && isMaster ? startAsk(s, ctx) : s };
        case "ask": {
          if (s.phase !== "ask" || isMaster || s.left <= 0) return { state: s };
          // Une question en attente à la fois par joueur (pas de spam).
          if (s.questions.some((q) => q.askerId === playerId && q.answer == null)) {
            return { state: s, error: { code: "pending_question", message: "Attends la réponse à ta question précédente." } };
          }
          const text = String(msg.text ?? "").replace(/\s+/g, " ").trim().slice(0, GUESSWHO_TEXT_MAX);
          if (!text) return { state: s };
          return { state: { ...s, questions: [...s.questions, { id: s.nextId, askerId: playerId, text, answer: null }], nextId: s.nextId + 1 } };
        }
        case "answer": {
          if (s.phase !== "ask" || !isMaster) return { state: s };
          const q = s.questions.find((x) => x.id === msg.questionId);
          if (!q || q.answer != null || !["oui", "non", "nsp", "skip"].includes(msg.answer)) return { state: s };
          // « Je ne sais pas » et « question écartée » ne consomment pas le stock.
          const counts = msg.answer === "oui" || msg.answer === "non";
          const next: GuessWhoState = {
            ...s,
            questions: s.questions.map((x) => (x.id === q.id ? { ...x, answer: msg.answer } : x)),
            left: counts ? s.left - 1 : s.left,
          };
          // Plus de questions : la table a encore jusqu'à la fin du chrono pour proposer.
          return { state: next };
        }
        case "guess": {
          if (s.phase !== "ask" || isMaster) return { state: s };
          let ok = false;
          let text = "";
          if (s.config.mode === "celebrites" && s.celebrity) {
            text = String(msg.text ?? "").replace(/\s+/g, " ").trim().slice(0, GUESSWHO_TEXT_MAX);
            if (!text) return { state: s };
            ok = isCelebrityGuess(text, s.celebrity);
          } else {
            if (!msg.targetId || !s.players.some((p) => p.id === msg.targetId)) return { state: s };
            text = nameOf(s, msg.targetId);
            ok = msg.targetId === s.secretPlayerId;
          }
          const guesses = [...s.guesses, { playerId, text, ok }];
          if (ok) return { state: reveal({ ...s, guesses }, playerId, ctx) };
          const left = Math.max(0, s.left - 1);
          const next = { ...s, guesses, left };
          // Stock épuisé par une mauvaise proposition : c'est fini.
          if (left <= 0 && !s.questions.some((q) => q.answer == null)) return { state: reveal(next, null, ctx) };
          return { state: next };
        }
      }
      return { state: s };
    }
  }
  return { state: s };
}

export function projectGuessWho(s: GuessWhoState, viewerId: PlayerId): GuessWhoPublic {
  const final = s.phase === "final";
  const master = final ? null : masterOf(s);
  const showSecret = s.phase === "reveal" || viewerId === master;
  return {
    phase: s.phase,
    mode: s.config.mode,
    players: s.players,
    order: s.order,
    round: Math.min(s.round + 1, s.config.totalRounds),
    totalRounds: s.config.totalRounds,
    masterId: master,
    celebrity: showSecret && !final ? s.celebrity : null,
    secretPlayerId: showSecret && !final ? s.secretPlayerId : null,
    questions: final ? [] : s.questions,
    guesses: final ? [] : s.guesses,
    left: s.left,
    maxQuestions: s.config.maxQuestions,
    finderId: s.phase === "reveal" ? s.finderId : null,
    deadline: s.deadline,
    phaseMs: s.phaseMs,
    scores: s.scores,
    gained: s.phase === "reveal" ? s.gained : null,
    founds: final ? s.founds : null,
    masterWins: final ? s.masterWins : null,
  };
}
