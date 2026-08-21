// ---------------------------------------------------------------------------
// Wire protocol between clients and the room server.
//
// Kept in its own file (not room/types) so it can compose both the room domain
// and any game module without those domains depending on each other. The
// `game` payload is intentionally generic (per-game public projection); the
// client routes on `gameId`.
// ---------------------------------------------------------------------------

import type { PlayerId, PublicRoomState, RoomErrorCode } from "./room/types";
import type { GameClientAction, GameSettings, PublicGameState, SubtitlesErrorCode } from "./game/types";
import type { DrawClientAction, DrawPublic, DrawStroke } from "./games/draw/types";
import type { FakeArtistClientAction, FakeArtistPublic } from "./games/fakeartist/types";
import type { RelayPublic } from "./games/relay/types";
import type { DoublageClientAction, DoublagePublic } from "./games/doublage/types";
import type { QuizClientAction, QuizPublic } from "./games/quiz/types";
import type { RecoPublic } from "./games/reconnaissance/types";

/** Any game's public projection. Discriminate with the state message `gameId`. */
export type AnyPublicGame = PublicGameState | DrawPublic | FakeArtistPublic | RelayPublic | DoublagePublic | QuizPublic | RecoPublic;

// --- Client -> server -------------------------------------------------------

export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "leave" }
  | { type: "set_ready"; ready: boolean }
  | { type: "set_name"; name: string }
  | { type: "set_avatar"; avatar: string | null }
  | { type: "set_settings"; settings: GameSettings } // host only
  | { type: "start_game"; gameId: string; settings?: unknown }
  | { type: "game"; action: GameClientAction | DrawClientAction | FakeArtistClientAction | DoublageClientAction | QuizClientAction }
  | { type: "skip" } // host advances the current game phase early
  | { type: "debug_fill" } // host-only TEST helper: auto-write for everyone
  | { type: "return_lobby" } // host-only: end the game, back to the lobby
  | { type: "play_again" } // host-only: start a fresh game right away
  | { type: "react"; emoji: string } // ephemeral live emoji reaction
  | { type: "speaking"; speaking: boolean } // ephemeral: I am / am not talking (doublage)
  | { type: "chat"; text: string } // ephemeral discussion message (not a guess)
  | { type: "draw_stroke"; stroke: DrawStroke } // ephemeral: drawer's stroke
  | { type: "draw_fill"; x: number; y: number; color: string } // ephemeral: bucket fill
  | { type: "draw_clear" }; // ephemeral: drawer cleared the canvas

// --- Server -> client -------------------------------------------------------

export type ServerMessage =
  | {
      type: "state";
      state: PublicRoomState;
      gameId: string | null;
      game: AnyPublicGame | null;
      /** Lobby game settings chosen by the host (applied at start). */
      settings: GameSettings;
      /** The server's clock at send time, so clients can correct for skew and
       *  synchronise video playback to the authoritative timeline. */
      serverTime: number;
      you: PlayerId;
    }
  | { type: "error"; code: RoomErrorCode | SubtitlesErrorCode | string; message: string }
  | { type: "reaction"; emoji: string; from: PlayerId } // ephemeral, not state
  | { type: "speaking"; from: PlayerId; speaking: boolean } // ephemeral talk indicator
  | { type: "stroke"; stroke: DrawStroke; from: PlayerId } // ephemeral draw relay
  | { type: "fill"; x: number; y: number; color: string; from: PlayerId } // ephemeral bucket fill
  | { type: "draw_clear"; from: PlayerId } // ephemeral: clear a canvas (per author)
  | { type: "chat"; from: PlayerId; name: string; text: string; kind: "guess" | "correct" | "system" | "talk" };
