// ---------------------------------------------------------------------------
// Résultat standard d'un Game Mode — le « passeport » qu'un jeu transmet au
// système de soirée quand il se termine. Chaque jeu garde son barème interne
// (`scores`) ; la soirée ne regarde que le classement qui en découle.
// ---------------------------------------------------------------------------

import type { GamePlayer } from "../game/types";
import type { PlayerId } from "../room/types";

export interface GameResult {
  /** Score du jeu par joueur, dans le barème propre au jeu. */
  scores: Record<PlayerId, number>;
  /** Classement explicite, meilleur d'abord (jeux à élimination). Sinon on
   *  classe par `scores` décroissant. Les joueurs absents de `order` suivent. */
  order?: PlayerId[];
  /** Mode coopératif : toute la tablée gagne ou perd ensemble. */
  coop?: boolean;
  /** Distinctions amusantes de fin de jeu : `titre → joueur`. */
  awards?: GameAward[];
}

export interface GameAward {
  /** Identifiant stable (ex. "best_drawer") — sert aux stats de fin de soirée. */
  id: string;
  /** Libellé affiché (« Meilleur dessinateur »). */
  label: string;
  playerId: PlayerId;
  /** Valeur mise en avant (« 12 mots »), optionnelle. */
  detail?: string;
}

/** Une ligne de classement : place 1 = meilleur ; les égalités partagent la place. */
export interface RankedPlayer {
  id: PlayerId;
  score: number;
  place: number;
}

/**
 * Classement d'un résultat. Égalité de score → même place (classement
 * « sportif » : 1, 1, 3). Avec `order`, la place suit l'ordre donné.
 */
export function rankResult(result: GameResult, players: PlayerId[]): RankedPlayer[] {
  const ids = Array.from(new Set([...(result.order ?? []), ...players, ...Object.keys(result.scores)]));
  const score = (id: PlayerId) => result.scores[id] ?? 0;
  if (result.order && result.order.length) {
    const pos = new Map(result.order.map((id, i) => [id, i]));
    const sorted = ids.slice().sort((a, b) => {
      const pa = pos.get(a) ?? Infinity;
      const pb = pos.get(b) ?? Infinity;
      if (pa !== pb) return pa - pb;
      return score(b) - score(a);
    });
    return sorted.map((id, i) => ({ id, score: score(id), place: i + 1 }));
  }
  const sorted = ids.slice().sort((a, b) => score(b) - score(a));
  const out: RankedPlayer[] = [];
  sorted.forEach((id, i) => {
    const prev = out[i - 1];
    const place = prev && prev.score === score(id) ? prev.place : i + 1;
    out.push({ id, score: score(id), place });
  });
  return out;
}

/** Raccourci : résultat d'un jeu à points, avec tous les joueurs présents. */
export function scoresResult(players: GamePlayer[], scores: Record<PlayerId, number>, extra: Partial<GameResult> = {}): GameResult {
  const out: Record<PlayerId, number> = {};
  for (const p of players) out[p.id] = scores[p.id] ?? 0;
  for (const [id, v] of Object.entries(scores)) if (out[id] == null) out[id] = v;
  return { scores: out, ...extra };
}

/** Le joueur au meilleur total d'une stat. `null` si tout le monde est à 0
 *  ou si plusieurs joueurs sont à égalité en tête (une distinction partagée
 *  au hasard serait injuste — on ne la décerne pas). */
export function bestBy(stat: Record<PlayerId, number> | null | undefined): PlayerId | null {
  if (!stat) return null;
  let best: PlayerId | null = null;
  let max = 0;
  let tie = false;
  for (const [id, v] of Object.entries(stat)) {
    if (v > max) {
      max = v;
      best = id;
      tie = false;
    } else if (v === max && v > 0) {
      tie = true;
    }
  }
  return tie ? null : best;
}

/** Accord simple : `plural(2, "vote")` → « 2 votes ». */
export function plural(n: number, word: string, pluralWord = word + "s"): string {
  return `${n} ${n > 1 ? pluralWord : word}`;
}
