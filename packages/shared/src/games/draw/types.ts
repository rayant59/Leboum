import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { WordEntry } from "./words";

export type DrawPhase =
  | "choosing" // the drawer picks a word among a few choices
  | "drawing" // the drawer draws, everyone else guesses
  | "reveal" // the word is shown + who found it
  | "scoreboard"; // final standings

/** Resolved per-turn timings + parameters (produced by a DrawMode). */
export interface DrawConfig {
  totalRounds: number; // one round = every player draws once
  chooseMs: number;
  drawMs: number;
  revealMs: number;
  wordChoiceCount: number;
  pointsDrawerPerGuess: number;
}

/** Host-facing lobby settings. `mode` selects the rule set (timings/scoring). */
export interface DrawSettings {
  totalRounds: number;
  mode: string; // DrawMode id — "classic", "turbo", …
  themes?: string[]; // allowed themes; empty/undefined = all themes
}

export interface DrawTurnResult {
  word: string;
  drawerId: PlayerId;
  guesserIds: PlayerId[];
}

/** Authoritative state (server-held, reduced). Never sent as-is to clients. */
export interface DrawState {
  phase: DrawPhase;
  round: number;
  totalRounds: number;
  order: PlayerId[]; // drawing order
  turnInRound: number; // 0-based index within the round
  players: GamePlayer[];
  drawerId: PlayerId | null;
  word: string | null; // the secret word (hidden from guessers in projection)
  wordPattern: string; // masked word, e.g. "_ _ _ _"
  wordChoices: string[]; // choices shown to the drawer during `choosing`
  choicePool: WordEntry[]; // the entries behind the current choices (server-only)
  theme: string | null; // hidden theme of the chosen word
  themeRevealed: boolean; // the drawer revealed the theme to guessers
  finished: boolean; // the drawer signalled "done" (informational, no auto-advance)
  constraint: string | null; // per-turn drawing constraint (constraints mode)
  constraintRule: string | null; // enforceable rule id (null = voluntary)
  guessedAt: Record<PlayerId, number>; // guesser -> when they found it
  scores: Record<PlayerId, number>;
  deadline: number | null;
  result: DrawTurnResult | null; // set during `reveal`
  config: DrawConfig;
  mode: string;
  wordThemes: string[]; // active theme filter (empty = all)
  /** Tous les mots déjà PROPOSÉS cette partie : ils ne ressortent jamais. */
  usedWords: string[];
}

/** What a client may send. */
export type DrawClientAction =
  | { kind: "choose_word"; word: string }
  | { kind: "guess"; text: string }
  | { kind: "end_drawing" }
  | { kind: "reveal_theme" };

/** A single ephemeral drawing stroke (relayed, never stored in reduced state). */
export interface DrawStroke {
  points: { x: number; y: number }[]; // normalised 0..1 coordinates
  color: string;
  width: number;
}

/** The per-viewer public view. The word is only present for those allowed. */
export interface DrawPublic {
  phase: DrawPhase;
  round: number;
  totalRounds: number;
  turnInRound: number;
  players: GamePlayer[];
  drawerId: PlayerId | null;
  youAreDrawer: boolean;
  deadline: number | null;
  scores: Record<PlayerId, number>;
  guessedIds: PlayerId[]; // who has found it (no reveal of the word)
  youGuessed: boolean;
  wordPattern: string; // masked word for guessers
  wordSegments: string[]; // masked word split per sub-word (compound spacing)
  wordSeparators: string[]; // "-" or " " between each pair of sub-words
  constraint: string | null; // per-turn drawing constraint (constraints mode)
  constraintRule: string | null; // enforceable rule id (null = voluntary)
  theme: string | null; // present only once the drawer reveals it (or at reveal)
  themeRevealed: boolean;
  finished: boolean;
  foundOrder: PlayerId[]; // guessers in the order they found the word
  word: string | null; // present for the drawer, those who guessed, and at reveal
  wordChoices: string[] | null; // present only for the drawer during `choosing`
  result: DrawTurnResult | null; // present during reveal/scoreboard
  config: DrawConfig;
  mode: string;
}
