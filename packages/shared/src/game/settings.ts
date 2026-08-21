// ---------------------------------------------------------------------------
// Game settings — pure helpers. The host picks a rounds count and a speed
// preset in the lobby; the server resolves that into the engine's SubtitlesConfig
// at game start. Kept pure and validated so a malicious client can't inject
// absurd values.
// ---------------------------------------------------------------------------

import type { GameSettings, GameSpeed, SubtitlesConfig } from "./types";

export const ROUNDS_MIN = 2;
export const ROUNDS_MAX = 6;
export const POINTS_PER_VOTE = 100;

export const DEFAULT_GAME_SETTINGS: GameSettings = { totalRounds: 3, speed: "normal" };

interface SpeedPreset {
  label: string;
  watchingMs: number;
  writingMs: number;
  screeningMs: number;
  votingMs: number;
  resultsMs: number;
}

export const SPEED_PRESETS: Record<GameSpeed, SpeedPreset> = {
  fast: { label: "Rapide", watchingMs: 10_000, writingMs: 40_000, screeningMs: 7_000, votingMs: 18_000, resultsMs: 7_000 },
  normal: { label: "Normal", watchingMs: 15_000, writingMs: 60_000, screeningMs: 9_000, votingMs: 25_000, resultsMs: 9_000 },
  relaxed: { label: "Détendu", watchingMs: 20_000, writingMs: 90_000, screeningMs: 11_000, votingMs: 35_000, resultsMs: 12_000 },
};

function clampRounds(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_GAME_SETTINGS.totalRounds;
  return Math.min(ROUNDS_MAX, Math.max(ROUNDS_MIN, Math.round(n)));
}

function isSpeed(v: unknown): v is GameSpeed {
  return v === "fast" || v === "normal" || v === "relaxed";
}

/** Clamp/validate whatever a client sent into safe settings. */
export function sanitizeSettings(input: Partial<GameSettings> | undefined): GameSettings {
  return {
    totalRounds: clampRounds(input?.totalRounds ?? DEFAULT_GAME_SETTINGS.totalRounds),
    speed: isSpeed(input?.speed) ? input!.speed : DEFAULT_GAME_SETTINGS.speed,
  };
}

/** Turn host settings into the engine's config. */
export function resolveConfig(settings: GameSettings): SubtitlesConfig {
  const p = SPEED_PRESETS[settings.speed] ?? SPEED_PRESETS.normal;
  return {
    totalRounds: clampRounds(settings.totalRounds),
    watchingMs: p.watchingMs,
    writingMs: p.writingMs,
    screeningMs: p.screeningMs,
    votingMs: p.votingMs,
    resultsMs: p.resultsMs,
    pointsPerVote: POINTS_PER_VOTE,
  };
}
