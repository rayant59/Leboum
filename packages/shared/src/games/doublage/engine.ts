// ---------------------------------------------------------------------------
// Doublage (dubbing) — pure engine. Server-authoritative video playback so all
// clients stay in sync. Mic capture / recording / audio are client concerns.
// Designed so future variants (word / situation / duel) are just a `mode`.
// ---------------------------------------------------------------------------

import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { DOUBLAGE_VIDEOS, getDoublageVideo } from "./videos";
import type { DoublageClientAction, DoublagePublic, DoublageSettings, DoublageState, Playback } from "./types";

const PAUSED: Playback = { playing: false, positionMs: 0, anchor: 0 };
const ok = (state: DoublageState): GameReduceResult<DoublageState> => ({ state });

function livePositionMs(pb: Playback, now: number, durationMs: number): number {
  const raw = pb.playing ? pb.positionMs + (now - pb.anchor) : pb.positionMs;
  const cap = durationMs > 0 ? durationMs : Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.min(cap, raw));
}

/** Round-robin: assign the connected players across the video's characters. */
function autoAssign(characters: { id: string }[], players: GamePlayer[]): Record<string, PlayerId | null> {
  const out: Record<string, PlayerId | null> = {};
  characters.forEach((c, i) => {
    out[c.id] = players.length ? players[i % players.length].id : null;
  });
  return out;
}

function applyVideo(state: DoublageState, videoId: string): DoublageState {
  const video = getDoublageVideo(videoId);
  if (!video) return state;
  return {
    ...state,
    videoId: video.id,
    customSrc: null,
    customTitle: null,
    characters: video.characters,
    durationMs: video.durationMs,
    assignments: autoAssign(video.characters, state.players),
    playback: { ...PAUSED },
  };
}

/** Use a host-provided video (path or URL) with a chosen number of voices. */
function applyCustom(state: DoublageState, src: string, title: string | undefined, count: number | undefined): DoublageState {
  const clean = (src || "").trim().slice(0, 500);
  if (!clean) return state;
  const n = Math.max(1, Math.min(8, Math.round(count ?? Math.max(2, state.characters.length || 2))));
  const characters = Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(97 + i), name: `Voix ${i + 1}` }));
  return {
    ...state,
    videoId: "custom",
    customSrc: clean,
    customTitle: (title || "Ma vidéo").trim().slice(0, 80),
    characters,
    durationMs: 0,
    assignments: autoAssign(characters, state.players),
    playback: { ...PAUSED },
  };
}

export function createDoublage(players: GamePlayer[], settings: DoublageSettings, ctx: GameContext): DoublageState {
  const ready: Record<PlayerId, boolean> = {};
  for (const p of players) ready[p.id] = false;
  const base: DoublageState = {
    phase: "prep",
    players,
    videoId: null,
    customSrc: null,
    customTitle: null,
    characters: [],
    durationMs: 0,
    assignments: {},
    ready,
    playback: { ...PAUSED },
    deadline: null,
    config: { totalRounds: 1, mode: "free" },
  };
  const initialId = settings.videoId ?? DOUBLAGE_VIDEOS[0]?.id ?? null;
  return initialId ? applyVideo(base, initialId) : base;
}

export function reduceDoublage(
  state: DoublageState,
  action: GameAction<DoublageClientAction>,
  ctx: GameContext,
): GameReduceResult<DoublageState> {
  switch (action.type) {
    case "client": {
      const { playerId, msg } = action;
      if (!state.players.some((p) => p.id === playerId)) return ok(state);

      switch (msg.kind) {
        case "pick_video":
          if (state.phase !== "prep") return ok(state);
          return ok(applyVideo(state, msg.videoId));

        case "custom_video":
          if (state.phase !== "prep") return ok(state);
          return ok(applyCustom(state, msg.src, msg.title, msg.characterCount));

        case "assign": {
          if (state.phase !== "prep") return ok(state);
          if (!(msg.characterId in state.assignments)) return ok(state);
          return ok({ ...state, assignments: { ...state.assignments, [msg.characterId]: msg.playerId } });
        }

        case "ready":
          return ok({ ...state, ready: { ...state.ready, [playerId]: msg.ready } });

        case "start": {
          if (state.phase !== "prep" || !state.videoId) return ok(state);
          return ok(startDubbing(state, ctx));
        }

        case "control": {
          if (state.phase === "prep") return ok(state);
          return ok(applyControl(state, msg.op, msg.positionMs, ctx));
        }

        case "to_result":
          return ok(toResult(state));

        case "to_prep": {
          const ready: Record<PlayerId, boolean> = {};
          for (const p of state.players) ready[p.id] = false;
          return ok({ ...state, phase: "prep", playback: { ...PAUSED }, deadline: null, ready });
        }
      }
      return ok(state);
    }

    case "advance": {
      // Auto end-of-scene when the video reaches its (known) duration.
      if (state.phase === "dubbing" && state.playback.playing && state.durationMs > 0) {
        if (livePositionMs(state.playback, ctx.now, state.durationMs) >= state.durationMs) return ok(toResult(state));
      }
      return ok(state);
    }

    case "presence":
      return ok(state);
  }
}

function startDubbing(state: DoublageState, ctx: GameContext): DoublageState {
  const playback: Playback = { playing: true, positionMs: 0, anchor: ctx.now };
  return { ...state, phase: "dubbing", playback, deadline: state.durationMs > 0 ? ctx.now + state.durationMs : null };
}

function applyControl(state: DoublageState, op: string, positionMs: number | undefined, ctx: GameContext): DoublageState {
  const live = livePositionMs(state.playback, ctx.now, state.durationMs);
  let pb: Playback;
  switch (op) {
    case "play":
      pb = { playing: true, positionMs: live, anchor: ctx.now };
      break;
    case "pause":
      pb = { playing: false, positionMs: live, anchor: ctx.now };
      break;
    case "seek":
      pb = { playing: state.playback.playing, positionMs: Math.max(0, positionMs ?? 0), anchor: ctx.now };
      break;
    case "restart":
      pb = { playing: true, positionMs: 0, anchor: ctx.now };
      break;
    default:
      return state;
  }
  const deadline = pb.playing && state.durationMs > 0 ? ctx.now + Math.max(0, state.durationMs - pb.positionMs) : null;
  return { ...state, playback: pb, deadline };
}

function toResult(state: DoublageState): DoublageState {
  return { ...state, phase: "result", playback: { ...PAUSED }, deadline: null };
}

export function projectDoublage(state: DoublageState, viewerId: PlayerId): DoublagePublic {
  const video = getDoublageVideo(state.videoId);
  const yourCharacterId = Object.entries(state.assignments).find(([, pid]) => pid === viewerId)?.[0] ?? null;
  const videoSrc = state.customSrc ?? video?.src ?? null;
  const videoTitle = state.customTitle ?? video?.title ?? null;
  const assignedIds = new Set(Object.values(state.assignments).filter(Boolean) as string[]);
  const allReady = state.players.length > 0 && state.players.every((p) => state.ready[p.id]);
  return {
    phase: state.phase,
    players: state.players,
    videoId: state.videoId,
    videoSrc,
    videoTitle,
    characters: state.characters,
    durationMs: state.durationMs,
    assignments: state.assignments,
    ready: state.ready,
    playback: state.playback,
    deadline: state.deadline,
    yourCharacterId,
    allReady,
    config: state.config,
  };
  void assignedIds;
}
