// ---------------------------------------------------------------------------
// The platform contract. Every game (Subtitles, Draw & Guess, …) is a module
// implementing this interface, so the server can host ANY game generically —
// no game-specific code in the server core. Pure functions only; the server
// is the impure adapter (clock, rng, sockets, timers, ephemeral relays).
// ---------------------------------------------------------------------------

import type { GamePlayer } from "../game/types";
import type { PlayerId } from "../room/types";

/** Impure inputs the server injects into otherwise-pure game functions. */
export interface GameContext {
  now: number;
  rng: () => number;
}

export interface GameError {
  code: string;
  message: string;
}

export interface GameReduceResult<State> {
  state: State;
  error?: GameError;
}

/**
 * A self-contained game. `State` is authoritative (server-held, reduced),
 * `Public` is what a client is allowed to see (per-viewer projection),
 * `Settings` is the host-facing lobby configuration, `ClientMsg` is the raw
 * action a client may send.
 */
export interface GameModule<State, Public, Settings, ClientMsg> {
  readonly id: string;
  readonly meta: { name: string; minPlayers: number; maxPlayers: number };

  // --- settings (lobby) ---
  defaultSettings(): Settings;
  sanitizeSettings(input: unknown): Settings;

  // --- lifecycle ---
  createState(players: GamePlayer[], settings: Settings, ctx: GameContext): State;
  reduce(state: State, action: GameAction<ClientMsg>, ctx: GameContext): GameReduceResult<State>;
  project(state: State, viewerId: PlayerId): Public;

  /** When the current phase should auto-advance (server schedules one timer). */
  deadline(state: State): number | null;
  /** True once the game is over (server can offer replay / return to lobby). */
  isOver(state: State): boolean;
}

/**
 * Every game's reducer handles these standard control actions in addition to
 * its own client actions:
 *  - `client`: a raw message from a player (submit, guess, choose_word, …)
 *  - `advance`: the deadline fired, or the host pressed "skip"
 *  - `presence`: the set of connected players changed (someone left/returned)
 */
export type GameAction<ClientMsg> =
  | { type: "client"; playerId: PlayerId; msg: ClientMsg }
  | { type: "advance" }
  | { type: "presence"; connectedIds: PlayerId[]; players?: GamePlayer[] };

/** A registry entry — a module with erased generics for storage/lookup. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameModule = GameModule<any, any, any, any>;
