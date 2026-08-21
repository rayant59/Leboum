// ---------------------------------------------------------------------------
// Subtitles game module — types.
//
// A "game module" runs inside a room once the phase is `in_game`. It follows
// the same discipline as the room engine: a pure, authoritative state machine.
// This is the seam every future game reuses — implement these shapes, register
// the module, done. The room already hands off via RoomState.gameId.
// ---------------------------------------------------------------------------

import type { PlayerId } from "../room/types";

/** One dialogue line a player must write for a scene, with the timing at which
 *  it appears during the replay. Times are relative to the watch window start
 *  (0 = the moment the clip window begins). You author these when you cut a
 *  scene; the game fills them with the players' invented lines. */
export interface CaptionSlot {
  id: string;
  /** Optional speaker hint shown in the writing form (e.g. "A", "B", "Le chef"). */
  speaker?: string;
  fromMs: number;
  toMs: number;
}

/** A clip to subtitle. The engine treats this as opaque data; where it comes
 *  from (self-hosted file, YouTube, later other providers) is the ClipProvider's
 *  job, never the engine's. */
export interface Clip {
  id: string;
  title: string;
  /** Playback source. */
  kind: "file" | "youtube";
  /** For kind === "file": a video URL (same-origin `public/clips/…` recommended). */
  url?: string;
  /** For kind === "youtube": the video id. */
  youtubeId?: string;
  /** Where in the source to begin the watch window (skips intros). */
  startSec?: number;
  /** Spoken language, shown as an on-screen tag (e.g. "coréen"). The whole
   *  point: players hear it but don't understand it, so they invent the lines. */
  lang?: string;
  /** Dialogue script: one slot per line to write. Omit for a single caption. */
  script?: CaptionSlot[];
  /** Optional source length metadata (not used for phase timing). */
  durationMs?: number;
  /** Shown as required attribution when relevant. */
  attribution?: string;
  /** Fallback accent colour for the placeholder frame. */
  posterColor?: string;
}

/** A single line covering the whole window — the default when a clip has no
 *  dialogue script (classic one-caption behaviour). */
export const DEFAULT_SLOT: CaptionSlot = {
  id: "line",
  fromMs: 0,
  toMs: Number.MAX_SAFE_INTEGER,
};

/** The dialogue slots for a clip: its script, or a single full-window slot. */
export function clipSlots(clip: Clip | null | undefined): CaptionSlot[] {
  return clip?.script && clip.script.length > 0 ? clip.script : [DEFAULT_SLOT];
}

export interface ClipProvider {
  /** Pick `count` distinct clips for a game. Impure edge (may shuffle/fetch). */
  pick(count: number): Clip[];
}

export type GamePhase =
  | "watching" // the clip plays for everyone
  | "writing" // players submit one caption
  | "screening" // the clip replays once per caption, subtitle overlaid (anonymous)
  | "voting" // captions revealed anonymously, everyone votes
  | "results" // authorship + votes + points for the round
  | "scoreboard"; // final standings

export interface SubtitlesConfig {
  totalRounds: number;
  watchingMs: number;
  writingMs: number;
  /** Duration of each caption's replay during the screening phase. */
  screeningMs: number;
  votingMs: number;
  /** How long the round results stay on screen before the next round. */
  resultsMs: number;
  /** Points awarded to a caption's author per vote it receives. */
  pointsPerVote: number;
}

export const DEFAULT_SUBTITLES_CONFIG: SubtitlesConfig = {
  totalRounds: 3,
  watchingMs: 12_000,
  writingMs: 60_000,
  screeningMs: 9_000,
  votingMs: 25_000,
  resultsMs: 9_000,
  pointsPerVote: 100,
};

/** Snapshot of a player taken at game start — enough to render without the
 *  room, and stable even if someone drops mid-game. */
export interface GamePlayer {
  id: PlayerId;
  name: string;
  color: string;
  avatar?: string | null;
}

export interface Submission {
  authorId: PlayerId;
  text: string;
}

export interface RoundResultEntry {
  authorId: PlayerId;
  lines: string[];
  voterIds: PlayerId[];
  points: number;
}

export interface SubtitlesState {
  phase: GamePhase;
  round: number; // 1-based
  players: GamePlayer[];
  clips: Clip[]; // one per round, chosen at start
  config: SubtitlesConfig;
  /** When the current phase auto-advances (server compares against its clock). */
  deadline: number | null;
  /** Which caption is being screened (0-based) during the `screening` phase. */
  screenIndex: number;
  /** Captions for the current round: authorId -> the lines they wrote (one per
   *  dialogue slot; a single-element array for classic one-caption scenes). */
  submissions: Record<PlayerId, string[]>;
  /** Votes for the current round: voterId -> authorId they voted for. */
  votes: Record<PlayerId, PlayerId>;
  /** Cumulative scores across rounds. */
  scores: Record<PlayerId, number>;
  /** Computed when entering `results`. */
  roundResults: RoundResultEntry[] | null;
}

export type SubtitlesAction =
  | { type: "submit"; playerId: PlayerId; lines: string[]; now: number }
  | { type: "vote"; playerId: PlayerId; authorId: PlayerId; now: number }
  | { type: "advance"; now: number } // timer/host-driven phase progression
  | { type: "next_round"; now: number };

export type SubtitlesErrorCode =
  | "wrong_phase"
  | "empty_caption"
  | "self_vote"
  | "unknown_target"
  | "not_a_player";

export interface SubtitlesReduceResult {
  state: SubtitlesState;
  error?: { code: SubtitlesErrorCode; message: string };
}

/** Host-facing game settings, chosen in the lobby before starting. Friendlier
 *  than raw millisecond fields: a rounds count + a speed preset. */
export type GameSpeed = "fast" | "normal" | "relaxed";

export interface GameSettings {
  totalRounds: number;
  speed: GameSpeed;
}

export function currentClip(s: SubtitlesState): Clip | null {
  return s.clips[s.round - 1] ?? null;
}

/** What a client is allowed to ask the game to do. The server turns these into
 *  authoritative SubtitlesActions (adding the player id and a timestamp). During
 *  voting the client references an opaque token, not an author — it literally
 *  cannot know who wrote what. */
export type GameClientAction =
  | { kind: "submit"; lines: string[] }
  | { kind: "vote"; token: string };

/** An anonymised caption shown during voting: no author, just an opaque token
 *  and the invented line(s) of dialogue. */
export interface VotingCaption {
  token: string;
  lines: string[];
}

/**
 * The projection of the game a client is allowed to see. It deliberately omits
 * caption authorship during writing and voting — the server computes this per
 * recipient from the internal SubtitlesState. Authors are only revealed in
 * `roundResults` (results / scoreboard).
 */
export interface PublicGameState {
  phase: GamePhase;
  round: number;
  totalRounds: number;
  clip: Clip | null; // current clip only — future clips are never leaked
  /** Optional style constraint for this round ("write it like an ad"). */
  twist: string | null;
  config: SubtitlesConfig;
  deadline: number | null;
  players: GamePlayer[];
  scores: Record<PlayerId, number>;
  // writing
  submittedIds: PlayerId[]; // who has written (no text, no authorship of captions)
  youSubmitted: boolean;
  // voting
  captions: VotingCaption[]; // anonymised + stable order (used in screening & voting)
  /** Which caption is on screen during `screening` (0-based). */
  screenIndex: number;
  yourToken: string | null; // token of your own caption, so the UI can disable it
  yourVote: string | null; // token you voted for
  votedCount: number;
  // results / scoreboard (authors revealed here only)
  roundResults: RoundResultEntry[] | null;
}
