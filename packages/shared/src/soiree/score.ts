// ---------------------------------------------------------------------------
// Score global — chaque jeu garde son barème ; la soirée convertit son
// CLASSEMENT en points de soirée. Ainsi un quiz à 3 000 points et une
// Boum Rush sans points pèsent pareil dans le total.
// ---------------------------------------------------------------------------

import type { PlayerId } from "../room/types";
import type { RankedPlayer } from "../platform/result";

/** Points par place : 1er 10, 2e 7, 3e 5, 4e 4, 5e 3, puis 2 pour avoir joué. */
export const PLACE_POINTS = [10, 7, 5, 4, 3] as const;
export const PARTICIPATION_POINTS = 2;
/** En coopératif, toute la tablée gagne ensemble. */
export const COOP_POINTS = 5;

export function pointsForPlace(place: number): number {
  return PLACE_POINTS[place - 1] ?? PARTICIPATION_POINTS;
}

/** Convertit le classement d'un jeu en points de soirée (égalités = mêmes points). */
export function soireePoints(ranking: RankedPlayer[], coop: boolean): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  for (const r of ranking) out[r.id] = coop ? COOP_POINTS : pointsForPlace(r.place);
  return out;
}
