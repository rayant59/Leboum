// ---------------------------------------------------------------------------
// Room protocol — shared source of truth between the room server and clients.
//
// Design intent: everything here is data. The game logic lives in a pure
// reducer (engine.ts) so it can be unit-tested with zero infrastructure and
// reused across any transport (PartyKit today, anything tomorrow).
// ---------------------------------------------------------------------------

export type PlayerId = string;

/** A participant in a room. */
export interface Player {
  id: PlayerId;
  name: string;
  /** Deterministic accent colour derived from the id — stable across renders. */
  color: string;
  /** Optional custom avatar (small square data URL). Null → colour + initials. */
  avatar?: string | null;
  isHost: boolean;
  /** False while the socket is gone but we keep a grace window for reconnection. */
  isConnected: boolean;
  isReady: boolean;
  joinedAt: number;
  score: number;
}

/**
 * Room lifecycle. Étape 1 only needs `lobby` and the transition into a game.
 * The per-game phases (playing / submitting / voting / results) will be owned
 * by the game module, not the room — see `gameId` as the hand-off seam.
 */
export type RoomPhase = "lobby" | "in_game";

export interface RoomConfig {
  minPlayers: number;
  maxPlayers: number;
  /** Ready & connected players required before the host can start. */
  minReadyToStart: number;
}

export interface RoomState {
  code: string;
  phase: RoomPhase;
  hostId: PlayerId | null;
  players: Record<PlayerId, Player>;
  /** Stable join order — the source of truth for host succession and rendering. */
  playerOrder: PlayerId[];
  config: RoomConfig;
  createdAt: number;
  /** Set when a game starts; identifies which game module owns the session. */
  gameId: string | null;
}

/**
 * What clients are allowed to see. Identical to RoomState today, but kept as a
 * separate type so private fields can never leak by accident.
 */
export type PublicRoomState = RoomState;

export type RoomErrorCode =
  | "room_full"
  | "invalid_name"
  | "not_host"
  | "not_enough_ready"
  | "wrong_phase"
  | "unknown";

// --- Actions consumed by the pure engine ------------------------------------
// These are ClientMessages enriched with the acting player's id + a timestamp,
// which the server adds from the connection context (never trusted from the
// client). The engine only ever sees these.

export type RoomAction =
  | { type: "join"; playerId: PlayerId; name: string; now: number }
  | { type: "leave"; playerId: PlayerId; now: number }
  | { type: "disconnect"; playerId: PlayerId; now: number }
  | { type: "reconnect"; playerId: PlayerId; now: number }
  | { type: "set_ready"; playerId: PlayerId; ready: boolean; now: number }
  | { type: "set_name"; playerId: PlayerId; name: string; now: number }
  | { type: "set_avatar"; playerId: PlayerId; avatar: string | null; now: number }
  | { type: "start_game"; playerId: PlayerId; gameId: string; now: number };

export interface ReduceResult {
  state: RoomState;
  /** Present when the action was rejected; the server relays it to that player. */
  error?: { code: RoomErrorCode; message: string };
}
