// ---------------------------------------------------------------------------
// Relais — pure engine. Two players share the pen on the same word and rotate
// every `swapMs`; the others guess. Reuses the shared word bank. Strokes are
// ephemeral (server-relayed). The active-drawer rotation is driven by the
// server on a timer calling `swapActiveDrawer` (pure).
// ---------------------------------------------------------------------------

import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { pickWordEntries } from "../draw/words";
import { normalize } from "../draw/engine";
import type {
  RelayClientAction,
  RelayConfig,
  RelayPublic,
  RelaySettings,
  RelayState,
} from "./types";

export const RELAY_ROUNDS_MIN = 2;
export const RELAY_ROUNDS_MAX = 8;

export function resolveRelayConfig(settings: RelaySettings): RelayConfig {
  const totalRounds = Math.min(RELAY_ROUNDS_MAX, Math.max(RELAY_ROUNDS_MIN, Math.round(settings.totalRounds || 3)));
  return { totalRounds, drawMs: 90_000, swapMs: 12_000, revealMs: 8_000, pointsDrawerPerGuess: 20 };
}

const isLetter = (c: string) => /[a-zA-ZÀ-ÿ]/.test(c);
function maskWord(word: string): string {
  return [...word].map((c) => (isLetter(c) ? "_" : c)).join(" ");
}
function segments(word: string): string[] {
  const segs: string[] = [];
  let cur = "";
  for (const c of word) {
    if (!isLetter(c)) {
      if (cur) segs.push(cur);
      cur = "";
    } else cur += "_";
  }
  if (cur) segs.push(cur);
  return segs;
}
function separatorsOf(word: string): string[] {
  const seps: string[] = [];
  let sawLetter = false;
  let sep: string | null = null;
  for (const c of word) {
    if (isLetter(c)) {
      if (sawLetter && sep !== null) seps.push(sep === "-" ? "-" : " ");
      sep = null;
      sawLetter = true;
    } else if (sep === null) {
      sep = c;
    }
  }
  return seps;
}

const ok = (state: RelayState): GameReduceResult<RelayState> => ({ state });

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startTurn(state: RelayState, pairStart: number, ctx: GameContext): RelayState {
  const n = state.order.length;
  const drawerIds =
    n <= 1 ? state.order.slice() : [state.order[pairStart % n], state.order[(pairStart + 1) % n]];
  const [entry] = pickWordEntries(1, ctx.rng);
  return {
    ...state,
    phase: "drawing",
    pairStart,
    drawerIds,
    activeIdx: 0,
    word: entry.word,
    theme: entry.theme,
    wordPattern: maskWord(entry.word),
    guessedAt: {},
    deadline: ctx.now + state.config.drawMs,
    swapDeadline: ctx.now + state.config.swapMs,
    result: null,
  };
}

export function createRelay(players: GamePlayer[], settings: RelaySettings, ctx: GameContext): RelayState {
  const config = resolveRelayConfig(settings);
  const scores: Record<PlayerId, number> = {};
  for (const p of players) scores[p.id] = 0;
  const base: RelayState = {
    phase: "drawing",
    round: 1,
    totalRounds: config.totalRounds,
    players,
    order: shuffle(players.map((p) => p.id), ctx.rng),
    pairStart: 0,
    drawerIds: [],
    activeIdx: 0,
    word: null,
    theme: null,
    wordPattern: "",
    guessedAt: {},
    scores,
    deadline: null,
    swapDeadline: null,
    result: null,
    config,
  };
  return startTurn(base, 0, ctx);
}

/** Rotate the pen to the next relay drawer (server calls this on a timer). */
export function swapActiveDrawer(state: RelayState, ctx: GameContext): RelayState {
  if (state.phase !== "drawing" || state.drawerIds.length < 2) return state;
  return {
    ...state,
    activeIdx: (state.activeIdx + 1) % state.drawerIds.length,
    swapDeadline: ctx.now + state.config.swapMs,
  };
}

export function reduceRelay(
  state: RelayState,
  action: GameAction<RelayClientAction>,
  ctx: GameContext,
): GameReduceResult<RelayState> {
  switch (action.type) {
    case "client": {
      const { playerId, msg } = action;
      if (state.phase !== "drawing") return ok(state);
      if (!state.players.some((p) => p.id === playerId)) return ok(state);
      if (state.drawerIds.includes(playerId)) return ok(state); // drawers can't guess
      if (state.guessedAt[playerId] != null) return ok(state);
      const correct = state.word != null && normalize(msg.text) === normalize(state.word);
      if (!correct) return ok(state);
      const frac = state.deadline != null ? (state.deadline - ctx.now) / state.config.drawMs : 0;
      const pts = 60 + Math.round(60 * Math.max(0, Math.min(1, frac)));
      const scores = { ...state.scores, [playerId]: (state.scores[playerId] ?? 0) + pts };
      for (const d of state.drawerIds) scores[d] = (scores[d] ?? 0) + state.config.pointsDrawerPerGuess;
      const next = { ...state, guessedAt: { ...state.guessedAt, [playerId]: ctx.now }, scores };
      const guessers = state.players.length - state.drawerIds.length;
      return ok(Object.keys(next.guessedAt).length >= guessers ? toReveal(next, ctx) : next);
    }
    case "advance":
      return ok(advance(state, ctx));
    case "presence":
      return ok(applyPresence(state, action.connectedIds, ctx));
  }
}

function advance(state: RelayState, ctx: GameContext): RelayState {
  switch (state.phase) {
    case "drawing":
      return toReveal(state, ctx);
    case "reveal":
      return nextTurn(state, ctx);
    case "scoreboard":
      return state;
  }
}

function applyPresence(state: RelayState, connectedIds: PlayerId[], ctx: GameContext): RelayState {
  if (state.phase !== "drawing") return state;
  const connected = new Set(connectedIds);
  const activeDrawers = state.drawerIds.filter((id) => connected.has(id));
  if (activeDrawers.length === 0) return toReveal(state, ctx); // nobody left to draw
  const pending = state.players.filter(
    (p) => !state.drawerIds.includes(p.id) && connected.has(p.id) && state.guessedAt[p.id] == null,
  );
  return pending.length === 0 && connected.size > state.drawerIds.length ? toReveal(state, ctx) : state;
}

function toReveal(state: RelayState, ctx: GameContext): RelayState {
  return {
    ...state,
    phase: "reveal",
    deadline: ctx.now + state.config.revealMs,
    swapDeadline: null,
    result: {
      word: state.word ?? "",
      drawerIds: state.drawerIds,
      guesserIds: Object.keys(state.guessedAt),
    },
  };
}

function nextTurn(state: RelayState, ctx: GameContext): RelayState {
  const totalTurns = state.round; // one drawing pair per round
  if (totalTurns >= state.totalRounds) {
    return { ...state, phase: "scoreboard", deadline: null, swapDeadline: null, result: null, drawerIds: [] };
  }
  const withRound = { ...state, round: state.round + 1 };
  return startTurn(withRound, state.pairStart + 2, ctx);
}

export function projectRelay(state: RelayState, viewerId: PlayerId): RelayPublic {
  const revealed = state.phase === "reveal" || state.phase === "scoreboard";
  const isDrawer = state.drawerIds.includes(viewerId);
  const guessed = state.guessedAt[viewerId] != null;
  const canSeeWord = revealed || isDrawer || guessed;
  const foundOrder = Object.entries(state.guessedAt)
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);
  return {
    phase: state.phase,
    round: state.round,
    totalRounds: state.totalRounds,
    players: state.players,
    drawerIds: state.drawerIds,
    activeDrawerId: state.drawerIds[state.activeIdx] ?? null,
    youAreDrawer: isDrawer,
    youAreActive: viewerId === state.drawerIds[state.activeIdx],
    youGuessed: guessed,
    deadline: state.deadline,
    swapDeadline: state.swapDeadline,
    scores: state.scores,
    guessedIds: Object.keys(state.guessedAt),
    foundOrder,
    wordPattern: state.wordPattern,
    wordSegments: segments(state.word ?? ""),
    wordSeparators: separatorsOf(state.word ?? ""),
    word: canSeeWord ? state.word : null,
    result: revealed ? state.result : null,
    config: state.config,
  };
}
