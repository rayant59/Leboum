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
import type { BombeClientAction, BombePublic } from "./games/bombe/types";
import type { MimicClientAction, MimicPublic } from "./games/mimic/types";
import type { SoireeItem, SoireeState } from "./soiree/types";
import type { WhoisClientAction, WhoisPublic } from "./games/whois/types";
import type { FunnyClientAction, FunnyPublic } from "./games/funny/types";
import type { ImposterClientAction, ImposterPublic } from "./games/imposter/types";
import type { PhoneClientAction, PhonePublic } from "./games/phone/types";
import type { TabooClientAction, TabooPublic } from "./games/taboo/types";
import type { YesNoClientAction, YesNoPublic } from "./games/yesno/types";
import type { GuessWhoClientAction, GuessWhoPublic } from "./games/guesswho/types";
import type { RankingClientAction, RankingPublic } from "./games/ranking/types";

/** Any game's public projection. Discriminate with the state message `gameId`. */
export type AnyPublicGame = PublicGameState | DrawPublic | FakeArtistPublic | RelayPublic | DoublagePublic | QuizPublic | RecoPublic | BombePublic | MimicPublic | WhoisPublic | FunnyPublic | ImposterPublic | PhonePublic | TabooPublic | YesNoPublic | GuessWhoPublic | RankingPublic;

// --- Client -> server -------------------------------------------------------

export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "leave" }
  | { type: "set_ready"; ready: boolean }
  | { type: "set_name"; name: string }
  | { type: "set_avatar"; avatar: string | null }
  | { type: "set_settings"; settings: GameSettings } // host only
  | { type: "set_pending_game"; gameId: string; soiree?: string[] } // host only: preview selection (and soirée programme) to guests
  | { type: "start_game"; gameId: string; settings?: unknown }
  | { type: "game"; action: GameClientAction | DrawClientAction | FakeArtistClientAction | DoublageClientAction | QuizClientAction | BombeClientAction | MimicClientAction | WhoisClientAction | FunnyClientAction | ImposterClientAction | PhoneClientAction | TabooClientAction | YesNoClientAction | GuessWhoClientAction | RankingClientAction }
  | { type: "voice_take"; round: number; audio: string } // mimic: my recorded take (base64 data URL), relayed to all
  | { type: "bombe_typing"; text: string } // bombe: live preview of what the active player is typing
  | { type: "skip" } // host advances the current game phase early
  | { type: "debug_fill" } // host-only TEST helper: auto-write for everyone
  | { type: "return_lobby" } // host-only: end the game, back to the lobby
  | { type: "play_again" } // host-only: start a fresh game right away
  | { type: "react"; emoji: string } // ephemeral live emoji reaction
  | { type: "speaking"; speaking: boolean } // ephemeral: I am / am not talking (doublage)
  | { type: "chat"; text: string } // ephemeral discussion message (not a guess)
  | { type: "draw_stroke"; stroke: DrawStroke } // ephemeral: drawer's stroke
  | { type: "draw_fill"; x: number; y: number; color: string } // ephemeral: bucket fill
  | { type: "draw_clear" } // ephemeral: drawer cleared the canvas
  | { type: "redeem_pass"; sessionId: string } // Pass Soirée : activer un paiement sur ce salon
  // --- Soirée LeBoum (hôte) ---
  | { type: "soiree_start"; items: SoireeItem[] } // lance une soirée depuis le salon
  | { type: "soiree_next" } // jeu suivant du programme
  | { type: "soiree_rematch" } // revanche : même programme, scores à zéro
  | { type: "soiree_vote_rematch"; want: boolean } // fin de soirée : « je veux la revanche »
  | { type: "soiree_end" }; // termine la soirée

// --- Server -> client -------------------------------------------------------

export type ServerMessage =
  | {
      type: "state";
      state: PublicRoomState;
      gameId: string | null;
      game: AnyPublicGame | null;
      /** Lobby game settings chosen by the host (applied at start). */
      settings: GameSettings;
      /** Game the host is about to launch (shown to guests in the lobby). */
      pendingGame: string | null;
      /** Programme de soirée préparé par l'hôte (ids de jeux), montré aux invités. */
      pendingSoiree?: string[];
      /** La partie en cours est terminée (moteur : `isOver`). */
      gameOver?: boolean;
      /** Numéro de la partie en cours (change à chaque lancement / revanche). */
      gameRun?: number;
      /** Soirée en cours (programme, résultats, score global), sinon null. */
      soiree?: SoireeState | null;
      /** The server's clock at send time, so clients can correct for skew and
       *  synchronise video playback to the authoritative timeline. */
      serverTime: number;
      /** Temps figé depuis le panneau Admin (en local) : les chronos sont à l'arrêt. */
      paused?: boolean;
      you: PlayerId;
    }
  | { type: "error"; code: RoomErrorCode | SubtitlesErrorCode | string; message: string }
  | { type: "reaction"; emoji: string; from: PlayerId } // ephemeral, not state
  | { type: "speaking"; from: PlayerId; speaking: boolean } // ephemeral talk indicator
  | { type: "stroke"; stroke: DrawStroke; from: PlayerId } // ephemeral draw relay
  | { type: "fill"; x: number; y: number; color: string; from: PlayerId } // ephemeral bucket fill
  | { type: "draw_clear"; from: PlayerId } // ephemeral: clear a canvas (per author)
  | { type: "chat"; from: PlayerId; name: string; text: string; kind: "guess" | "correct" | "system" | "talk" }
  | { type: "voice_take"; round: number; from: PlayerId; audio: string } // mimic: a player's recorded take, relayed to all
  | { type: "bombe_typing"; from: PlayerId; text: string }; // bombe: live typing preview of the active player
