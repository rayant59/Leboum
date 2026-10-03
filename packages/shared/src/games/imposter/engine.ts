// Moteur pur de l'« Imposteur ».
// Flux d'une manche : attribution secrète → ordre de parole → indices (chrono
// par joueur, 1 ou 2 tours) → vote → [classique : dernière chance de
// l'imposteur démasqué] → révélation → score. Puis manche suivante.
//
// Barème :
//   • voter pour l'imposteur ........................ +100 (par joueur)
//   • imposteur pas démasqué (vote raté / égalité) ... +250 pour lui
//   • imposteur démasqué mais trouve le mot .......... +150 pour lui
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { latePlayers, withZeros, zeroScores } from "../../platform/presence";
import { argmaxAll, clampInt, shuffle } from "../../platform/util";
import { isWordGuess, normalizeWord } from "../../platform/text";
import { imposterBank } from "./words";
import type {
  ImposterClientAction,
  ImposterConfig,
  ImposterMode,
  ImposterOutcome,
  ImposterPublic,
  ImposterSettings,
  ImposterState,
} from "./types";

export const IMPOSTER_SECRET_MS = 10_000;
export const IMPOSTER_REVEAL_MS = 10_000;
export const IMPOSTER_VOTE_POINTS = 100;
export const IMPOSTER_ESCAPE_POINTS = 250;
export const IMPOSTER_STEAL_POINTS = 150;
export const IMPOSTER_CLUE_MAX = 40;

export function resolveImposterConfig(s: ImposterSettings | undefined, playerCount = 4): ImposterConfig {
  const mode: ImposterMode = s?.mode === "infiltre" ? "infiltre" : "classique";
  return {
    totalRounds: clampInt(s?.totalRounds, 1, 10, 3),
    clueSeconds: clampInt(s?.seconds, 10, 90, 30),
    voteSeconds: 45,
    guessSeconds: 25,
    // Petites tables : deux tours d'indices pour avoir de quoi débattre.
    passes: playerCount <= 6 ? 2 : 1,
    mode,
  };
}

/** Comparaison souple d'un mot (partagée : `platform/text.ts`). */
export { normalizeWord };

/** L'imposteur a-t-il trouvé le mot ? (accents, articles, pluriel, 1 faute). */
export function isImposterGuessRight(guess: string, word: string): boolean {
  return isWordGuess(guess, word);
}


export function createImposter(players: GamePlayer[], settings: ImposterSettings, ctx: GameContext): ImposterState {
  const config = resolveImposterConfig(settings, players.length);
  const pairs = shuffle(imposterBank(), ctx.rng).slice(0, config.totalRounds);
  const base: ImposterState = {
    phase: "secret",
    players,
    connectedIds: players.map((p) => p.id),
    config: { ...config, totalRounds: pairs.length },
    pairs,
    index: 0,
    roster: [],
    imposterId: players[0]?.id ?? "",
    order: [],
    turn: 0,
    pass: 1,
    clues: [],
    seen: [],
    votes: {},
    guess: null,
    outcome: null,
    tally: {},
    accused: [],
    deadline: null,
    phaseMs: 0,
    scores: zeroScores(players),
    gained: {},
    imposterWins: zeroScores(players),
    goodVotes: zeroScores(players),
    history: [],
    pastImposters: [],
  };
  return startRound(base, 0, ctx);
}

/** Prépare la manche `index` : nouveaux rôles, nouvel ordre de parole. */
function startRound(s: ImposterState, index: number, ctx: GameContext): ImposterState {
  const connected = s.players.map((p) => p.id).filter((id) => s.connectedIds.includes(id));
  const roster = connected.length >= 2 ? connected : s.players.map((p) => p.id);
  // Faire tourner le rôle : on évite ceux qui ont déjà été imposteurs.
  const fresh = roster.filter((id) => !s.pastImposters.includes(id));
  const pool = fresh.length ? fresh : roster.filter((id) => id !== s.pastImposters[s.pastImposters.length - 1]);
  const candidates = pool.length ? pool : roster;
  const imposterId = candidates[Math.floor(ctx.rng() * candidates.length)] ?? roster[0];
  let order = shuffle(roster, ctx.rng);
  // En classique, l'imposteur ne parle jamais en premier (il n'a aucun indice).
  if (s.config.mode === "classique" && order[0] === imposterId && order.length > 1) {
    order = [...order.slice(1), order[0]];
  }
  return {
    ...s,
    phase: "secret",
    index,
    roster,
    imposterId,
    order,
    turn: 0,
    pass: 1,
    clues: [],
    seen: [],
    votes: {},
    guess: null,
    outcome: null,
    tally: {},
    accused: [],
    gained: {},
    deadline: ctx.now + IMPOSTER_SECRET_MS,
    phaseMs: IMPOSTER_SECRET_MS,
    pastImposters: [...s.pastImposters, imposterId],
  };
}

const isOn = (s: ImposterState, id: PlayerId) => s.connectedIds.includes(id);

function startClues(s: ImposterState, ctx: GameContext): ImposterState {
  const next: ImposterState = { ...s, phase: "clues", turn: 0, pass: 1 };
  return skipAbsent(withClueDeadline(next, ctx), ctx);
}

function withClueDeadline(s: ImposterState, ctx: GameContext): ImposterState {
  const ms = s.config.clueSeconds * 1000;
  return { ...s, deadline: ctx.now + ms, phaseMs: ms };
}

/** Passe au joueur suivant (et au tour suivant, puis au vote). */
function nextTurn(s: ImposterState, ctx: GameContext): ImposterState {
  let turn = s.turn + 1;
  let pass = s.pass;
  if (turn >= s.order.length) {
    turn = 0;
    pass += 1;
  }
  if (pass > s.config.passes) return startVote(s, ctx);
  return skipAbsent(withClueDeadline({ ...s, turn, pass }, ctx), ctx);
}

/** Saute les joueurs déconnectés dont c'est le tour. */
function skipAbsent(s: ImposterState, ctx: GameContext): ImposterState {
  if (s.phase !== "clues") return s;
  if (!s.order.some((id) => isOn(s, id))) return startVote(s, ctx);
  const cur = s.order[s.turn];
  return cur && !isOn(s, cur) ? nextTurn(s, ctx) : s;
}

function startVote(s: ImposterState, ctx: GameContext): ImposterState {
  const ms = s.config.voteSeconds * 1000;
  return { ...s, phase: "vote", votes: {}, deadline: ctx.now + ms, phaseMs: ms };
}

function expectedVoters(s: ImposterState): PlayerId[] {
  return s.roster.filter((id) => isOn(s, id));
}

function resolveVote(s: ImposterState, ctx: GameContext): ImposterState {
  const tally: Record<PlayerId, number> = Object.fromEntries(s.roster.map((id) => [id, 0]));
  for (const t of Object.values(s.votes)) tally[t] = (tally[t] ?? 0) + 1;
  const accused = argmaxAll(tally);
  const caught = accused.length === 1 && accused[0] === s.imposterId;
  const next = { ...s, tally, accused };
  if (caught && s.config.mode === "classique" && isOn(s, s.imposterId)) {
    const ms = s.config.guessSeconds * 1000;
    return { ...next, phase: "guess", deadline: ctx.now + ms, phaseMs: ms };
  }
  return finishRound(next, caught ? "caught" : "escaped", ctx);
}

function finishRound(s: ImposterState, outcome: ImposterOutcome, ctx: GameContext): ImposterState {
  const gained: Record<PlayerId, number> = {};
  const scores = { ...s.scores };
  const goodVotes = { ...s.goodVotes };
  const imposterWins = { ...s.imposterWins };
  if (outcome !== "left") {
    for (const [voter, target] of Object.entries(s.votes)) {
      if (voter !== s.imposterId && target === s.imposterId) {
        gained[voter] = (gained[voter] ?? 0) + IMPOSTER_VOTE_POINTS;
        goodVotes[voter] = (goodVotes[voter] ?? 0) + 1;
      }
    }
    if (outcome === "escaped" || outcome === "stolen") {
      gained[s.imposterId] = (gained[s.imposterId] ?? 0) + (outcome === "escaped" ? IMPOSTER_ESCAPE_POINTS : IMPOSTER_STEAL_POINTS);
      imposterWins[s.imposterId] = (imposterWins[s.imposterId] ?? 0) + 1;
    }
  }
  for (const [id, g] of Object.entries(gained)) scores[id] = (scores[id] ?? 0) + g;
  const pair = s.pairs[s.index];
  return {
    ...s,
    phase: "reveal",
    outcome,
    gained,
    scores,
    goodVotes,
    imposterWins,
    history: [
      ...s.history,
      { imposterId: s.imposterId, word: pair?.word ?? "", decoy: s.config.mode === "infiltre" ? pair?.decoy ?? null : null, outcome },
    ],
    deadline: ctx.now + IMPOSTER_REVEAL_MS,
    phaseMs: IMPOSTER_REVEAL_MS,
  };
}

function nextRound(s: ImposterState, ctx: GameContext): ImposterState {
  const index = s.index + 1;
  if (index >= s.pairs.length) return { ...s, phase: "final", deadline: null, phaseMs: 0 };
  return startRound(s, index, ctx);
}

/** Le mot que voit un joueur de la manche (null = imposteur classique). */
export function wordFor(s: ImposterState, id: PlayerId): string | null {
  const pair = s.pairs[s.index];
  if (!pair || !s.roster.includes(id)) return null;
  if (id !== s.imposterId) return pair.word;
  return s.config.mode === "infiltre" ? pair.decoy : null;
}

export function reduceImposter(
  s: ImposterState,
  action: GameAction<ImposterClientAction>,
  ctx: GameContext,
): GameReduceResult<ImposterState> {
  switch (action.type) {
    case "presence": {
      const added = latePlayers(s.players, action.players);
      let next: ImposterState = { ...s, connectedIds: action.connectedIds };
      if (added.length) {
        next = {
          ...next,
          players: [...s.players, ...added],
          scores: withZeros(s.scores, added),
          imposterWins: withZeros(s.imposterWins, added),
          goodVotes: withZeros(s.goodVotes, added),
        };
      }
      const live = next.phase === "secret" || next.phase === "clues" || next.phase === "vote" || next.phase === "guess";
      // L'imposteur est parti : la manche s'arrête là, sans points.
      if (live && !isOn(next, next.imposterId)) return { state: finishRound(next, "left", ctx) };
      if (next.phase === "secret") {
        const need = expectedVoters(next);
        if (need.length && need.every((id) => next.seen.includes(id))) return { state: startClues(next, ctx) };
      }
      if (next.phase === "clues") return { state: skipAbsent(next, ctx) };
      if (next.phase === "vote") {
        const voters = expectedVoters(next);
        if (voters.length && voters.every((id) => next.votes[id])) return { state: resolveVote(next, ctx) };
      }
      return { state: next };
    }
    case "advance": {
      switch (s.phase) {
        case "secret":
          return { state: startClues(s, ctx) };
        case "clues": {
          // Temps écoulé : le joueur passe son tour (indice vide).
          const cur = s.order[s.turn];
          const clues = cur ? [...s.clues, { playerId: cur, text: "", pass: s.pass }] : s.clues;
          return { state: nextTurn({ ...s, clues }, ctx) };
        }
        case "vote":
          return { state: resolveVote(s, ctx) };
        case "guess":
          return { state: finishRound(s, "caught", ctx) };
        case "reveal":
          return { state: nextRound(s, ctx) };
      }
      return { state: s };
    }
    case "client": {
      const { playerId, msg } = action;
      if (!s.roster.includes(playerId)) return { state: s };
      switch (msg?.kind) {
        case "seen": {
          if (s.phase !== "secret" || s.seen.includes(playerId)) return { state: s };
          const next = { ...s, seen: [...s.seen, playerId] };
          const need = expectedVoters(next);
          if (need.every((id) => next.seen.includes(id))) return { state: startClues(next, ctx) };
          return { state: next };
        }
        case "clue": {
          if (s.phase !== "clues" || s.order[s.turn] !== playerId) return { state: s };
          const text = String(msg.text ?? "").replace(/\s+/g, " ").trim().slice(0, IMPOSTER_CLUE_MAX);
          if (!text) return { state: s };
          const own = wordFor(s, playerId);
          if (own && normalizeWord(text).includes(normalizeWord(own))) {
            return { state: s, error: { code: "clue_is_word", message: "Pas le mot lui-même, petit malin !" } };
          }
          const clues = [...s.clues, { playerId, text, pass: s.pass }];
          return { state: nextTurn({ ...s, clues }, ctx) };
        }
        case "vote": {
          if (s.phase !== "vote" || s.votes[playerId]) return { state: s };
          if (msg.targetId === playerId) return { state: s, error: { code: "self_vote", message: "Tu ne peux pas voter contre toi-même !" } };
          if (!s.roster.includes(msg.targetId)) return { state: s };
          const next = { ...s, votes: { ...s.votes, [playerId]: msg.targetId } };
          const voters = expectedVoters(next);
          if (voters.every((id) => next.votes[id])) return { state: resolveVote(next, ctx) };
          return { state: next };
        }
        case "guess": {
          if (s.phase !== "guess" || playerId !== s.imposterId) return { state: s };
          const guess = String(msg.text ?? "").trim().slice(0, IMPOSTER_CLUE_MAX);
          if (!guess) return { state: s };
          const ok = isImposterGuessRight(guess, s.pairs[s.index]?.word ?? "");
          return { state: finishRound({ ...s, guess }, ok ? "stolen" : "caught", ctx) };
        }
      }
      return { state: s };
    }
  }
  return { state: s };
}

export function projectImposter(s: ImposterState, viewerId: PlayerId): ImposterPublic {
  const pair = s.pairs[s.index];
  const revealed = s.phase === "reveal" || s.phase === "final";
  const final = s.phase === "final";
  return {
    phase: s.phase,
    mode: s.config.mode,
    players: s.players,
    roster: s.roster,
    round: Math.min(s.index + 1, s.pairs.length),
    totalRounds: s.pairs.length,
    category: pair?.category ?? "",
    yourWord: final ? null : wordFor(s, viewerId),
    youAreImposter: !final && s.config.mode === "classique" && viewerId === s.imposterId && s.roster.includes(viewerId),
    order: s.order,
    currentId: s.phase === "clues" ? s.order[s.turn] ?? null : null,
    pass: s.pass,
    passes: s.config.passes,
    clues: s.clues,
    seenIds: s.seen,
    votedIds: Object.keys(s.votes),
    yourVote: s.votes[viewerId] ?? null,
    accused: s.phase === "guess" || revealed ? s.accused : [],
    deadline: s.deadline,
    phaseMs: s.phaseMs,
    scores: s.scores,
    reveal:
      revealed && s.outcome && pair
        ? {
            imposterId: s.imposterId,
            word: pair.word,
            decoy: s.config.mode === "infiltre" ? pair.decoy : null,
            outcome: s.outcome,
            guess: s.guess,
            votes: s.votes,
            tally: s.tally,
            accused: s.accused,
            gained: s.gained,
          }
        : null,
    imposterWins: final ? s.imposterWins : null,
    goodVotes: final ? s.goodVotes : null,
    history: final ? s.history : null,
  };
}
