// ---------------------------------------------------------------------------
// Room engine — the authoritative, pure state machine for a room.
//
// Rules of the house:
//  * Pure & deterministic: (state, action) -> new state. No Date.now(), no I/O,
//    no randomness. Timestamps arrive on the action; the caller owns the clock.
//  * Server-authoritative: the server is the ONLY caller. Clients send intents;
//    the engine validates them and is the single source of truth for who is
//    host, who is ready, and whether a game may start.
//  * Immutable: never mutate the input state. Always return a fresh object so
//    change-detection (and future time-travel/debugging) stays trivial.
// ---------------------------------------------------------------------------

import type {
  Player,
  ReduceResult,
  RoomAction,
  RoomConfig,
  RoomState,
} from "./types";
import { colorForId, sanitizeName } from "./util";

export const DEFAULT_CONFIG: RoomConfig = {
  minPlayers: 2,
  maxPlayers: 8,
  minReadyToStart: 2,
};

export function createInitialState(
  code: string,
  now: number,
  config: RoomConfig = DEFAULT_CONFIG,
): RoomState {
  return {
    code,
    phase: "lobby",
    hostId: null,
    players: {},
    playerOrder: [],
    config,
    createdAt: now,
    gameId: null,
  };
}

// --- helpers ----------------------------------------------------------------

function connectedIds(state: RoomState): string[] {
  return state.playerOrder.filter((id) => state.players[id]?.isConnected);
}

/** First connected player in join order — used for host succession. */
function firstConnected(state: RoomState): string | null {
  return connectedIds(state)[0] ?? null;
}

function ok(state: RoomState): ReduceResult {
  return { state };
}

function reject(
  state: RoomState,
  error: NonNullable<ReduceResult["error"]>,
): ReduceResult {
  return { state, error };
}

// --- reducer ----------------------------------------------------------------

export function reduce(state: RoomState, action: RoomAction): ReduceResult {
  switch (action.type) {
    case "join": {
      const name = sanitizeName(action.name);
      if (name.length < 1) {
        return reject(state, { code: "invalid_name", message: "Choisis un pseudo." });
      }

      const existing = state.players[action.playerId];
      // Re-join with a known id == reconnect. Never duplicate a player.
      if (existing) {
        return ok(patchPlayer(state, action.playerId, { isConnected: true, name }));
      }

      if (connectedIds(state).length >= state.config.maxPlayers) {
        return reject(state, {
          code: "room_full",
          message: `La partie est complète (${state.config.maxPlayers} joueurs max).`,
        });
      }

      const isFirst = state.playerOrder.length === 0;
      const player: Player = {
        id: action.playerId,
        name,
        color: colorForId(action.playerId),
        isHost: isFirst,
        isConnected: true,
        isReady: false,
        joinedAt: action.now,
        score: 0,
      };

      return ok({
        ...state,
        hostId: isFirst ? action.playerId : state.hostId,
        players: { ...state.players, [action.playerId]: player },
        playerOrder: [...state.playerOrder, action.playerId],
      });
    }

    case "disconnect": {
      const p = state.players[action.playerId];
      if (!p) return ok(state);
      // Keep the player in the list (grace window) but mark them away and
      // un-ready them so a stale "ready" can't let the host start without them.
      let next = patchPlayer(state, action.playerId, {
        isConnected: false,
        isReady: false,
      });
      next = transferHostIfNeeded(next, action.playerId);
      return ok(next);
    }

    case "reconnect": {
      const p = state.players[action.playerId];
      if (!p) return ok(state);
      return ok(patchPlayer(state, action.playerId, { isConnected: true }));
    }

    case "leave": {
      const p = state.players[action.playerId];
      if (!p) return ok(state);
      const players = { ...state.players };
      delete players[action.playerId];
      let next: RoomState = {
        ...state,
        players,
        playerOrder: state.playerOrder.filter((id) => id !== action.playerId),
      };
      next = transferHostIfNeeded(next, action.playerId);
      return ok(next);
    }

    case "set_ready": {
      if (state.phase !== "lobby") {
        return reject(state, { code: "wrong_phase", message: "La partie a déjà commencé." });
      }
      const p = state.players[action.playerId];
      if (!p || !p.isConnected) return ok(state);
      return ok(patchPlayer(state, action.playerId, { isReady: action.ready }));
    }

    case "set_name": {
      const name = sanitizeName(action.name);
      if (name.length < 1) {
        return reject(state, { code: "invalid_name", message: "Pseudo invalide." });
      }
      if (!state.players[action.playerId]) return ok(state);
      return ok(patchPlayer(state, action.playerId, { name }));
    }

    case "set_avatar": {
      if (!state.players[action.playerId]) return ok(state);
      // Accept a small image data URL or null (reset). Size is capped server-side.
      const avatar = typeof action.avatar === "string" && action.avatar.startsWith("data:image/") ? action.avatar : null;
      return ok(patchPlayer(state, action.playerId, { avatar }));
    }

    case "start_game": {
      if (action.playerId !== state.hostId) {
        return reject(state, { code: "not_host", message: "Seul l'hôte peut lancer la partie." });
      }
      if (state.phase !== "lobby") {
        return reject(state, { code: "wrong_phase", message: "La partie a déjà commencé." });
      }
      const readyConnected = state.playerOrder.filter(
        (id) => state.players[id]?.isConnected && state.players[id]?.isReady,
      );
      if (readyConnected.length < state.config.minReadyToStart) {
        return reject(state, {
          code: "not_enough_ready",
          message: `Il faut au moins ${state.config.minReadyToStart} joueurs prêts.`,
        });
      }
      return ok({ ...state, phase: "in_game", gameId: action.gameId });
    }

    default: {
      // Exhaustiveness guard — a new action type will fail the build here.
      const _never: never = action;
      return ok(state);
    }
  }
}

// --- state helpers ----------------------------------------------------------

function patchPlayer(
  state: RoomState,
  id: string,
  patch: Partial<Player>,
): RoomState {
  const p = state.players[id];
  if (!p) return state;
  return { ...state, players: { ...state.players, [id]: { ...p, ...patch } } };
}

/**
 * If the affected player was the host, hand the crown to the first connected
 * player in join order. If nobody is connected, the id stays put (the room is
 * effectively empty and the server will dispose of it).
 */
function transferHostIfNeeded(state: RoomState, affectedId: string): RoomState {
  if (state.hostId !== affectedId) return state;
  const heir = firstConnected(state);
  if (!heir) return state;

  const players = { ...state.players };
  if (players[affectedId]) players[affectedId] = { ...players[affectedId], isHost: false };
  players[heir] = { ...players[heir], isHost: true };
  return { ...state, hostId: heir, players };
}

// --- read-model helpers (used by UI; kept here so rules live in one place) ---

export function canStart(state: RoomState): boolean {
  const readyConnected = state.playerOrder.filter(
    (id) => state.players[id]?.isConnected && state.players[id]?.isReady,
  ).length;
  return state.phase === "lobby" && readyConnected >= state.config.minReadyToStart;
}

export function connectedPlayers(state: RoomState): Player[] {
  return state.playerOrder
    .map((id) => state.players[id])
    .filter((p): p is Player => !!p && p.isConnected);
}
