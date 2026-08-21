import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { DoublageCharacter } from "./videos";

export type DoublagePhase = "prep" | "dubbing" | "result";

/** Authoritative playback state. Clients derive the live position:
 *  playing ? positionMs + (now - anchor) : positionMs. */
export interface Playback {
  playing: boolean;
  positionMs: number;
  anchor: number; // server time when this state was set
}

export interface DoublageConfig {
  totalRounds: number; // reserved for future variants; the free mode uses 1
  mode: "free"; // future: "word" | "situation" | "duel"
}

export interface DoublageSettings {
  videoId?: string | null;
  mode?: "free";
}

export interface DoublageState {
  phase: DoublagePhase;
  players: GamePlayer[];
  videoId: string | null;
  customSrc: string | null; // host-provided video path/URL (overrides catalog)
  customTitle: string | null;
  characters: DoublageCharacter[]; // from the chosen video
  durationMs: number;
  assignments: Record<string, PlayerId | null>; // characterId -> player
  ready: Record<PlayerId, boolean>;
  playback: Playback;
  deadline: number | null;
  config: DoublageConfig;
}

export type DoublageClientAction =
  | { kind: "pick_video"; videoId: string } // host
  | { kind: "custom_video"; src: string; title?: string; characterCount?: number } // host: own video
  | { kind: "assign"; characterId: string; playerId: PlayerId | null } // host
  | { kind: "ready"; ready: boolean }
  | { kind: "control"; op: "play" | "pause" | "seek" | "restart"; positionMs?: number } // host
  | { kind: "start" } // host: prep -> dubbing
  | { kind: "to_result" } // host or auto at end of scene
  | { kind: "to_prep" }; // host: back to preparation

export interface DoublagePublic {
  phase: DoublagePhase;
  players: GamePlayer[];
  videoId: string | null;
  videoSrc: string | null;
  videoTitle: string | null;
  characters: DoublageCharacter[];
  durationMs: number;
  assignments: Record<string, PlayerId | null>;
  ready: Record<PlayerId, boolean>;
  playback: Playback;
  deadline: number | null;
  yourCharacterId: string | null;
  allReady: boolean;
  config: DoublageConfig;
}
