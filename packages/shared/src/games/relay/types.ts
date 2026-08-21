import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";

export type RelayPhase = "drawing" | "reveal" | "scoreboard";

export interface RelayConfig {
  totalRounds: number;
  drawMs: number;
  swapMs: number; // how often the active drawer rotates
  revealMs: number;
  pointsDrawerPerGuess: number;
}

export interface RelaySettings {
  totalRounds: number;
}

export interface RelayTurnResult {
  word: string;
  drawerIds: PlayerId[];
  guesserIds: PlayerId[];
}

/** Two players share the pen on the same word (both know it) and swap every
 *  `swapMs`; everyone else guesses. The pair rotates each turn so everyone draws. */
export interface RelayState {
  phase: RelayPhase;
  round: number;
  totalRounds: number;
  players: GamePlayer[];
  order: PlayerId[]; // fixed rotation order
  pairStart: number; // index into `order` for this turn's drawing pair
  drawerIds: PlayerId[]; // the (up to) 2 relay drawers this turn
  activeIdx: number; // which of drawerIds is currently drawing
  word: string | null;
  theme: string | null;
  wordPattern: string;
  guessedAt: Record<PlayerId, number>;
  scores: Record<PlayerId, number>;
  deadline: number | null; // phase end
  swapDeadline: number | null; // next active-drawer rotation
  result: RelayTurnResult | null;
  config: RelayConfig;
}

export type RelayClientAction = { kind: "guess"; text: string };

export interface RelayPublic {
  phase: RelayPhase;
  round: number;
  totalRounds: number;
  players: GamePlayer[];
  drawerIds: PlayerId[];
  activeDrawerId: PlayerId | null;
  youAreDrawer: boolean; // you're one of the two relay drawers
  youAreActive: boolean; // it's your turn on the pen right now
  youGuessed: boolean;
  deadline: number | null;
  swapDeadline: number | null;
  scores: Record<PlayerId, number>;
  guessedIds: PlayerId[];
  foundOrder: PlayerId[];
  wordPattern: string;
  wordSegments: string[];
  wordSeparators: string[];
  word: string | null; // shown to the drawers, guessers who found it, and at reveal
  result: RelayTurnResult | null;
  config: RelayConfig;
}
