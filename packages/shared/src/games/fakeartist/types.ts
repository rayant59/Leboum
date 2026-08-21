import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";

export type FakeArtistPhase = "drawing" | "voting" | "reveal" | "scoreboard";

export interface FakeArtistConfig {
  totalRounds: number;
  drawMs: number;
  voteMs: number;
  revealMs: number;
}

export interface FakeArtistSettings {
  totalRounds: number;
}

export interface FakeArtistResult {
  impostorId: PlayerId;
  word: string;
  caught: boolean;
  tally: Record<PlayerId, number>; // votes received per player
}

/** Authoritative state. The impostor id and word are secret (projection hides
 *  them appropriately) until the reveal. */
export interface FakeArtistState {
  phase: FakeArtistPhase;
  round: number;
  totalRounds: number;
  players: GamePlayer[];
  word: string; // the secret word (every real player sees it; impostor doesn't)
  theme: string;
  impostorId: PlayerId | null;
  votes: Record<PlayerId, PlayerId>; // voter -> suspected impostor
  scores: Record<PlayerId, number>;
  deadline: number | null;
  result: FakeArtistResult | null;
  config: FakeArtistConfig;
}

export type FakeArtistClientAction = { kind: "vote"; targetId: PlayerId };

export interface FakeArtistPublic {
  phase: FakeArtistPhase;
  round: number;
  totalRounds: number;
  players: GamePlayer[];
  deadline: number | null;
  scores: Record<PlayerId, number>;
  theme: string;
  word: string | null; // hidden from the impostor; shown to everyone at reveal
  youAreImpostor: boolean;
  impostorId: PlayerId | null; // only at reveal
  yourVote: PlayerId | null;
  voteCount: number; // how many players have voted (progress)
  result: FakeArtistResult | null;
  config: FakeArtistConfig;
}
