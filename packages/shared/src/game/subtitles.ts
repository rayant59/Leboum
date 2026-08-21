// ---------------------------------------------------------------------------
// Subtitles game engine — pure, authoritative state machine.
//
// Phase loop, per round:
//   watching -> writing -> voting -> results -> (next round | scoreboard)
//
// Same rules of the house as the room engine: no clock, no I/O, no randomness;
// timestamps arrive on the action; never mutate the input; the server is the
// only caller and the single source of truth.
// ---------------------------------------------------------------------------

import type { PlayerId } from "../room/types";
import { sanitizeName } from "../room/util";
import {
  clipSlots,
  currentClip,
  type Clip,
  type GamePlayer,
  type RoundResultEntry,
  type SubtitlesAction,
  type SubtitlesConfig,
  type SubtitlesReduceResult,
  type SubtitlesState,
  DEFAULT_SUBTITLES_CONFIG,
} from "./types";

const CAPTION_MAX = 140;

/** Trim a caption defensively (angle brackets stripped; the UI still escapes). */
export function sanitizeCaption(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CAPTION_MAX);
}

export function createSubtitlesGame(
  players: GamePlayer[],
  clips: Clip[],
  now: number,
  config: SubtitlesConfig = DEFAULT_SUBTITLES_CONFIG,
): SubtitlesState {
  const scores: Record<PlayerId, number> = {};
  for (const p of players) scores[p.id] = 0;
  return {
    phase: "watching",
    round: 1,
    players,
    clips: clips.slice(0, config.totalRounds),
    config,
    deadline: now + config.watchingMs,
    screenIndex: 0,
    submissions: {},
    votes: {},
    scores,
    roundResults: null,
  };
}

// --- helpers ----------------------------------------------------------------

const ok = (state: SubtitlesState): SubtitlesReduceResult => ({ state });
const fail = (
  state: SubtitlesState,
  code: NonNullable<SubtitlesReduceResult["error"]>["code"],
  message: string,
): SubtitlesReduceResult => ({ state, error: { code, message } });

function isPlayer(s: SubtitlesState, id: PlayerId): boolean {
  return s.players.some((p) => p.id === id);
}

function everyoneSubmitted(s: SubtitlesState): boolean {
  return s.players.every((p) => Array.isArray(s.submissions[p.id]));
}

/** Only players who wrote a caption may vote (nothing to vote on otherwise). */
function everyoneVoted(s: SubtitlesState): boolean {
  return s.players
    .filter((p) => Array.isArray(s.submissions[p.id]))
    .every((p) => typeof s.votes[p.id] === "string");
}

function computeResults(s: SubtitlesState): RoundResultEntry[] {
  const tally: RoundResultEntry[] = Object.entries(s.submissions).map(
    ([authorId, lines]) => ({ authorId, lines, voterIds: [], points: 0 }),
  );
  const byAuthor = new Map(tally.map((e) => [e.authorId, e]));
  for (const [voterId, authorId] of Object.entries(s.votes)) {
    const entry = byAuthor.get(authorId);
    if (entry) entry.voterIds.push(voterId);
  }
  for (const e of tally) e.points = e.voterIds.length * s.config.pointsPerVote;
  // Highest scoring caption first.
  tally.sort((a, b) => b.points - a.points || b.voterIds.length - a.voterIds.length);
  return tally;
}

/** Enter a phase and set its deadline from `now`. */
function enter(s: SubtitlesState, phase: SubtitlesState["phase"], now: number): SubtitlesState {
  const durations: Record<string, number> = {
    watching: s.config.watchingMs,
    writing: s.config.writingMs,
    voting: s.config.votingMs,
  };
  const ms = durations[phase];
  return { ...s, phase, deadline: ms != null ? now + ms : null };
}

function toResults(s: SubtitlesState, now: number): SubtitlesState {
  const results = computeResults(s);
  const scores = { ...s.scores };
  for (const e of results) scores[e.authorId] = (scores[e.authorId] ?? 0) + e.points;
  return {
    ...s,
    phase: "results",
    deadline: now + s.config.resultsMs,
    roundResults: results,
    scores,
  };
}

/** Begin the screening phase: the clip replays once per caption. */
function toScreening(s: SubtitlesState, now: number): SubtitlesState {
  return { ...s, phase: "screening", screenIndex: 0, deadline: now + s.config.screeningMs };
}

/** After the last caption has been screened, open voting (or skip to results if
 *  there aren't at least two captions to choose between). */
function afterScreening(s: SubtitlesState, now: number): SubtitlesState {
  const count = Object.keys(s.submissions).length;
  return count >= 2 ? enter(s, "voting", now) : toResults(s, now);
}

/** Move from results to the next round, or to the final scoreboard. */
function advanceRound(s: SubtitlesState, now: number): SubtitlesState {
  if (s.round >= s.config.totalRounds) {
    return { ...s, phase: "scoreboard", deadline: null };
  }
  const advanced: SubtitlesState = {
    ...s,
    round: s.round + 1,
    screenIndex: 0,
    submissions: {},
    votes: {},
    roundResults: null,
  };
  return enter(advanced, "watching", now);
}

// --- reducer ----------------------------------------------------------------

export function reduceSubtitles(
  s: SubtitlesState,
  action: SubtitlesAction,
): SubtitlesReduceResult {
  switch (action.type) {
    case "submit": {
      if (s.phase !== "writing") return fail(s, "wrong_phase", "Ce n'est pas le moment d'écrire.");
      if (!isPlayer(s, action.playerId)) return fail(s, "not_a_player", "Tu n'es pas dans la partie.");
      const slots = clipSlots(currentClip(s));
      const lines = slots.map((_, i) => sanitizeCaption(action.lines[i] ?? ""));
      if (lines.some((l) => l.length === 0)) {
        return fail(
          s,
          "empty_caption",
          slots.length > 1 ? "Complète toutes les répliques." : "Écris quelque chose avant de valider.",
        );
      }
      let next: SubtitlesState = {
        ...s,
        submissions: { ...s.submissions, [action.playerId]: lines },
      };
      // When the last caption lands, roll straight into the screening reveal.
      if (everyoneSubmitted(next)) next = toScreening(next, action.now);
      return ok(next);
    }

    case "vote": {
      if (s.phase !== "voting") return fail(s, "wrong_phase", "Le vote n'est pas ouvert.");
      if (!isPlayer(s, action.playerId)) return fail(s, "not_a_player", "Tu n'es pas dans la partie.");
      if (action.authorId === action.playerId) return fail(s, "self_vote", "On ne vote pas pour soi-même.");
      if (!Array.isArray(s.submissions[action.authorId]))
        return fail(s, "unknown_target", "Ce sous-titre n'existe pas.");
      let next: SubtitlesState = {
        ...s,
        votes: { ...s.votes, [action.playerId]: action.authorId },
      };
      if (everyoneVoted(next)) next = toResults(next, action.now);
      return ok(next);
    }

    case "advance": {
      // Timer- or host-driven progression through the current phase.
      switch (s.phase) {
        case "watching":
          return ok(enter(s, "writing", action.now));
        case "writing": {
          // Time's up. If anyone wrote, screen the captions; else go to results.
          const count = Object.keys(s.submissions).length;
          return ok(count >= 1 ? toScreening(s, action.now) : toResults(s, action.now));
        }
        case "screening": {
          const count = Object.keys(s.submissions).length;
          const nextIndex = s.screenIndex + 1;
          if (nextIndex >= count) return ok(afterScreening(s, action.now));
          return ok({ ...s, screenIndex: nextIndex, deadline: action.now + s.config.screeningMs });
        }
        case "voting":
          return ok(toResults(s, action.now));
        case "results":
          return ok(advanceRound(s, action.now));
        default:
          return ok(s); // scoreboard is terminal
      }
    }

    case "next_round": {
      if (s.phase !== "results") return fail(s, "wrong_phase", "La manche n'est pas terminée.");
      return ok(advanceRound(s, action.now));
    }

    default: {
      const _never: never = action;
      return ok(s);
    }
  }
}

// --- read models (UI convenience; rules stay here) --------------------------

export function hasSubmitted(s: SubtitlesState, id: PlayerId): boolean {
  return Array.isArray(s.submissions[id]);
}

export function submissionCount(s: SubtitlesState): number {
  return Object.keys(s.submissions).length;
}

/** Captions for the voting screen, order stable but author hidden. */
export function anonymousCaptions(s: SubtitlesState): { authorId: PlayerId; lines: string[] }[] {
  return Object.entries(s.submissions).map(([authorId, lines]) => ({ authorId, lines }));
}

export function standings(s: SubtitlesState): GamePlayer[] {
  return [...s.players].sort((a, b) => (s.scores[b.id] ?? 0) - (s.scores[a.id] ?? 0));
}
