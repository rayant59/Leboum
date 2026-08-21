// ---------------------------------------------------------------------------
// Faux-artiste — pure engine. One secret impostor doesn't get the word; everyone
// draws at once, then votes on who the impostor is. Reuses the shared word bank.
// Strokes are ephemeral (server-relayed), not part of this state.
// ---------------------------------------------------------------------------

import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { pickWordEntries } from "../draw/words";
import type {
  FakeArtistClientAction,
  FakeArtistConfig,
  FakeArtistPublic,
  FakeArtistSettings,
  FakeArtistState,
} from "./types";

export const FA_ROUNDS_MIN = 2;
export const FA_ROUNDS_MAX = 8;

export function resolveFakeArtistConfig(settings: FakeArtistSettings): FakeArtistConfig {
  const totalRounds = Math.min(FA_ROUNDS_MAX, Math.max(FA_ROUNDS_MIN, Math.round(settings.totalRounds || 3)));
  return { totalRounds, drawMs: 60_000, voteMs: 30_000, revealMs: 9_000 };
}

const ok = (state: FakeArtistState): GameReduceResult<FakeArtistState> => ({ state });

function startRound(
  base: Omit<FakeArtistState, "phase" | "word" | "theme" | "impostorId" | "votes" | "deadline" | "result">,
  ctx: GameContext,
): FakeArtistState {
  const [entry] = pickWordEntries(1, ctx.rng);
  const impostor = base.players[Math.floor(ctx.rng() * base.players.length)]?.id ?? null;
  return {
    ...base,
    phase: "drawing",
    word: entry.word,
    theme: entry.theme,
    impostorId: impostor,
    votes: {},
    deadline: ctx.now + base.config.drawMs,
    result: null,
  };
}

export function createFakeArtist(
  players: GamePlayer[],
  settings: FakeArtistSettings,
  ctx: GameContext,
): FakeArtistState {
  const config = resolveFakeArtistConfig(settings);
  const scores: Record<PlayerId, number> = {};
  for (const p of players) scores[p.id] = 0;
  return startRound(
    { round: 1, totalRounds: config.totalRounds, players, scores, config },
    ctx,
  );
}

export function reduceFakeArtist(
  state: FakeArtistState,
  action: GameAction<FakeArtistClientAction>,
  ctx: GameContext,
): GameReduceResult<FakeArtistState> {
  switch (action.type) {
    case "client": {
      const { playerId, msg } = action;
      if (state.phase !== "voting") return ok(state);
      if (!state.players.some((p) => p.id === playerId)) return ok(state);
      if (!state.players.some((p) => p.id === msg.targetId)) return ok(state);
      if (msg.targetId === playerId) return ok(state); // no self-vote
      const votes = { ...state.votes, [playerId]: msg.targetId };
      const next = { ...state, votes };
      // Everyone voted → resolve early.
      return ok(Object.keys(votes).length >= state.players.length ? toReveal(next, ctx) : next);
    }
    case "advance":
      return ok(advance(state, ctx));
    case "presence":
      return ok(applyPresence(state, action.connectedIds, ctx));
  }
}

function advance(state: FakeArtistState, ctx: GameContext): FakeArtistState {
  switch (state.phase) {
    case "drawing":
      return { ...state, phase: "voting", deadline: ctx.now + state.config.voteMs };
    case "voting":
      return toReveal(state, ctx);
    case "reveal":
      return nextRound(state, ctx);
    case "scoreboard":
      return state;
  }
}

function applyPresence(state: FakeArtistState, connectedIds: PlayerId[], ctx: GameContext): FakeArtistState {
  if (state.phase !== "drawing" && state.phase !== "voting") return state;
  const connected = new Set(connectedIds);
  if (state.impostorId && !connected.has(state.impostorId)) return toReveal(state, ctx);
  if (state.phase === "voting") {
    const pending = state.players.filter((p) => connected.has(p.id) && state.votes[p.id] == null);
    if (pending.length === 0 && connected.size > 1) return toReveal(state, ctx);
  }
  return state;
}

/** Tally votes, decide if the impostor was caught, and award points. */
function toReveal(state: FakeArtistState, ctx: GameContext): FakeArtistState {
  const tally: Record<PlayerId, number> = {};
  for (const target of Object.values(state.votes)) tally[target] = (tally[target] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(tally));
  const impostor = state.impostorId;
  const caught = impostor != null && max > 0 && (tally[impostor] ?? 0) === max;

  const scores = { ...state.scores };
  if (impostor != null) {
    if (caught) {
      for (const [voter, target] of Object.entries(state.votes)) {
        if (voter !== impostor && target === impostor) scores[voter] = (scores[voter] ?? 0) + 100;
      }
    } else {
      scores[impostor] = (scores[impostor] ?? 0) + 200;
    }
  }
  return {
    ...state,
    phase: "reveal",
    scores,
    deadline: ctx.now + state.config.revealMs,
    result: { impostorId: impostor ?? "", word: state.word, caught, tally },
  };
}

function nextRound(state: FakeArtistState, ctx: GameContext): FakeArtistState {
  if (state.round >= state.totalRounds) {
    return { ...state, phase: "scoreboard", impostorId: null, deadline: null, result: null };
  }
  return startRound(
    {
      round: state.round + 1,
      totalRounds: state.totalRounds,
      players: state.players,
      scores: state.scores,
      config: state.config,
    },
    ctx,
  );
}

export function projectFakeArtist(state: FakeArtistState, viewerId: PlayerId): FakeArtistPublic {
  const revealed = state.phase === "reveal" || state.phase === "scoreboard";
  const youAreImpostor = viewerId === state.impostorId;
  return {
    phase: state.phase,
    round: state.round,
    totalRounds: state.totalRounds,
    players: state.players,
    deadline: state.deadline,
    scores: state.scores,
    theme: state.theme,
    word: revealed ? state.word : youAreImpostor ? null : state.word,
    youAreImpostor,
    impostorId: revealed ? state.impostorId : null,
    yourVote: state.votes[viewerId] ?? null,
    voteCount: Object.keys(state.votes).length,
    result: revealed ? state.result : null,
    config: state.config,
  };
}
