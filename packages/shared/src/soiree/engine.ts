// Moteur pur de la Soirée LeBoum : (état, action) → nouvel état, sans I/O.
import type { GamePlayer } from "../game/types";
import type { PlayerId } from "../room/types";
import { rankResult, type GameResult } from "../platform/result";
import { soireePoints } from "./score";
import { SOIREE_MAX_ITEMS, type SoireeItem, type SoireePlayer, type SoireeStanding, type SoireeState } from "./types";

export function createSoiree(items: SoireeItem[], now: number): SoireeState {
  return {
    items: items.slice(0, SOIREE_MAX_ITEMS).map((i) => ({ gameId: i.gameId, settings: i.settings, ...(i.surprise ? { surprise: true } : {}) })),
    current: 0,
    records: [],
    totals: {},
    players: {},
    finished: items.length === 0,
    startedAt: now,
  };
}

/** Le jeu au programme à l'index courant (null une fois la soirée finie). */
export function currentItem(s: SoireeState): SoireeItem | null {
  return s.finished ? null : s.items[s.current] ?? null;
}

/** Le résultat du jeu courant est-il déjà enregistré pour cette partie ? */
export function isRecorded(s: SoireeState, index: number, run?: number): boolean {
  return s.records.some((r) => r.index === index && (run == null || r.run === run));
}

function sumTotals(s: SoireeState): Record<PlayerId, number> {
  const totals: Record<PlayerId, number> = {};
  for (const id of Object.keys(s.players)) totals[id] = 0;
  for (const r of s.records) for (const [id, p] of Object.entries(r.points)) totals[id] = (totals[id] ?? 0) + p;
  return totals;
}

/** Ajoute des joueurs à la soirée (identité figée pour le classement final). */
export function withPlayers(s: SoireeState, players: (GamePlayer | SoireePlayer)[]): SoireeState {
  const next = { ...s.players };
  let changed = false;
  for (const p of players) {
    const prev = next[p.id];
    const snap: SoireePlayer = { id: p.id, name: p.name, color: p.color, avatar: p.avatar ?? null };
    if (!prev || prev.name !== snap.name || prev.avatar !== snap.avatar || prev.color !== snap.color) {
      next[p.id] = snap;
      changed = true;
    }
  }
  if (!changed) return s;
  const out = { ...s, players: next };
  return { ...out, totals: sumTotals(out) };
}

/**
 * Enregistre le résultat d'un jeu terminé. Une revanche du même jeu (`run`
 * différent) remplace l'ancien résultat : jamais de double comptage.
 */
export function recordGame(s: SoireeState, index: number, run: number, gameId: string, result: GameResult, players: GamePlayer[]): SoireeState {
  if (isRecorded(s, index, run)) return s;
  const base = withPlayers(s, players);
  const ids = players.map((p) => p.id);
  const ranking = rankResult(result, ids);
  const record = {
    index,
    gameId,
    run,
    scores: result.scores,
    ranking,
    points: soireePoints(ranking, !!result.coop),
    coop: !!result.coop,
    awards: result.awards ?? [],
  };
  const records = [...base.records.filter((r) => r.index !== index), record].sort((a, b) => a.index - b.index);
  const out = { ...base, records };
  return { ...out, totals: sumTotals(out) };
}

/** Passe au jeu suivant ; la soirée est finie après le dernier. */
export function nextGame(s: SoireeState): SoireeState {
  if (s.finished) return s;
  const current = s.current + 1;
  return { ...s, current, finished: current >= s.items.length };
}

/** Saute le jeu courant (injouable au nombre de joueurs présents) et passe au suivant. */
export function skipGame(s: SoireeState): SoireeState {
  if (s.finished) return s;
  const skipped = [...new Set([...(s.skipped ?? []), s.current])];
  return nextGame({ ...s, skipped });
}

/** Le jeu `gameId` est-il jouable avec `count` joueurs connectés ? */
export function soireeGameFits(minPlayers: number, maxPlayers: number, count: number): boolean {
  return count >= minPlayers && count <= maxPlayers;
}

/** Termine la soirée tout de suite (ex. plus assez de joueurs). */
export function finishSoiree(s: SoireeState): SoireeState {
  return s.finished ? s : { ...s, finished: true };
}

/** Classement général : total décroissant, départage au nombre de jeux gagnés. */
export function soireeStandings(s: SoireeState): SoireeStanding[] {
  const rows = Object.keys(s.players).map((id) => ({
    id,
    total: s.totals[id] ?? 0,
    wins: s.records.filter((r) => !r.coop && r.ranking.some((x) => x.id === id && x.place === 1)).length,
    played: s.records.filter((r) => r.ranking.some((x) => x.id === id)).length,
  }));
  rows.sort((a, b) => b.total - a.total || b.wins - a.wins);
  const out: SoireeStanding[] = [];
  rows.forEach((r, i) => {
    const prev = out[i - 1];
    const place = prev && prev.total === r.total && prev.wins === r.wins ? prev.place : i + 1;
    out.push({ ...r, place });
  });
  return out;
}

/** Fin de soirée : un joueur réclame (ou retire) sa demande de revanche. */
export function voteRematch(s: SoireeState, playerId: PlayerId, want = true): SoireeState {
  if (!s.finished || !s.players[playerId]) return s;
  const votes = new Set(s.rematchVotes ?? []);
  if (want) votes.add(playerId);
  else votes.delete(playerId);
  return { ...s, rematchVotes: [...votes] };
}
