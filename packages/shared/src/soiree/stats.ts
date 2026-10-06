// ---------------------------------------------------------------------------
// Fin de soirée (phase 15) — stats fun calculées à partir des résultats
// standard des jeux (classements + distinctions). Pur, partagé client/serveur.
//
// Règle d'or : une distinction partagée à égalité n'est pas décernée
// (comme `bestBy`) — on préfère ne rien dire qu'être injuste.
// ---------------------------------------------------------------------------

import type { PlayerId } from "../room/types";
import { GAME_CATALOG } from "../platform/catalog";
import { bestBy, plural } from "../platform/result";
import { soireeStandings } from "./engine";
import type { SoireeGameRecord, SoireeState } from "./types";

export interface SoireeHighlight {
  /** Identifiant stable (« most_wins », « best_drawer »…). */
  id: string;
  label: string;
  playerId: PlayerId;
  detail?: string;
}

/** Ligne du « film de la soirée » : un jeu joué et son vainqueur. */
export interface SoireeGameRecap {
  index: number;
  gameId: string;
  /** Vainqueur(s) — plusieurs en cas d'égalité ; vide en coopératif. */
  winners: PlayerId[];
  coop: boolean;
  /** Meilleur score du jeu, dans son propre barème. */
  topScore: number;
}

/** Bilan personnel d'un joueur (affiché sur son téléphone). */
export interface SoireePlayerSummary {
  place: number;
  total: number;
  wins: number;
  podiums: number;
  played: number;
  /** Son meilleur jeu de la soirée (meilleure place). */
  best: { gameId: string; place: number } | null;
}

/** Jeux « de tête » pour la distinction « Tête de quiz ». */
export const QUIZ_GAMES = ["quiz", "reco", "pixel", "ranking"];

/** Distinctions de jeux équivalentes regroupées sous une même clé. */
const AWARD_ALIASES: Record<string, string> = { best_writer: "golden_pen", funny_pen: "golden_pen" };

/** Distinctions mises en avant en premier (celles de la feuille de route). */
const AWARD_PRIORITY = ["best_drawer", "best_liar", "funny_best", "golden_pen", "detective", "best_mimic"];

export const SOIREE_MAX_HIGHLIGHTS = 8;

const gameName = (id: string) => GAME_CATALOG[id]?.name ?? id;
const ordinal = (n: number) => (n === 1 ? "1re" : `${n}e`);
const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR").replace(/\s/g, " ");
const winnersOf = (r: SoireeGameRecord) => (r.coop ? [] : r.ranking.filter((x) => x.place === 1).map((x) => x.id));

/** Le film de la soirée : chaque jeu joué, dans l'ordre, avec son vainqueur. */
export function soireeRecap(s: SoireeState): SoireeGameRecap[] {
  return s.records.map((r) => ({
    index: r.index,
    gameId: r.gameId,
    winners: winnersOf(r),
    coop: r.coop,
    topScore: Math.max(0, ...r.ranking.map((x) => x.score)),
  }));
}

/** Bilan d'un joueur ; null s'il n'a pas participé à la soirée. */
export function playerSummary(s: SoireeState, id: PlayerId): SoireePlayerSummary | null {
  const row = soireeStandings(s).find((r) => r.id === id);
  if (!row) return null;
  let best: SoireePlayerSummary["best"] = null;
  let bestPts = -1;
  let podiums = 0;
  for (const r of s.records) {
    const me = r.ranking.find((x) => x.id === id);
    if (!me) continue;
    if (!r.coop && me.place <= 3) podiums++;
    const pts = r.points[id] ?? 0;
    if (!r.coop && (!best || me.place < best.place || (me.place === best.place && pts > bestPts))) {
      best = { gameId: r.gameId, place: me.place };
      bestPts = pts;
    }
  }
  return { place: row.place, total: row.total, wins: row.wins, podiums, played: row.played, best };
}

/** Joueur strictement en tête d'une mesure (aucun en cas d'égalité ou si ≤ min). */
function strictTop(values: Record<PlayerId, number>, min = 0): PlayerId | null {
  const filtered: Record<PlayerId, number> = {};
  for (const [id, v] of Object.entries(values)) if (v > min) filtered[id] = v;
  return bestBy(filtered);
}

/** Classement cumulé après les `k` premiers jeux (place par joueur). */
function placesAfter(s: SoireeState, k: number): Record<PlayerId, number> {
  const partial: SoireeState = { ...s, records: s.records.slice(0, k), totals: {} };
  for (const r of partial.records) for (const [id, p] of Object.entries(r.points)) partial.totals[id] = (partial.totals[id] ?? 0) + p;
  return Object.fromEntries(soireeStandings(partial).map((r) => [r.id, r.place]));
}

/**
 * Les distinctions de fin de soirée, les plus marquantes d'abord :
 * plus de jeux gagnés, plus gros carton, tête de quiz, distinctions des jeux
 * (meilleur dessinateur, meilleur menteur, réponse la plus drôle…),
 * remontada, abonné au podium.
 */
export function soireeHighlights(s: SoireeState): SoireeHighlight[] {
  const out: SoireeHighlight[] = [];
  const records = s.records;
  if (!records.length) return out;
  const standings = soireeStandings(s);
  const champion = standings.length > 1 && standings[0].place === 1 && standings[1].place !== 1 ? standings[0].id : null;

  // 1. Plus de jeux gagnés (au moins 2, sans égalité).
  const wins = Object.fromEntries(standings.map((r) => [r.id, r.wins]));
  const winner = strictTop(wins, 1);
  if (winner) out.push({ id: "most_wins", label: "Plus de jeux gagnés", playerId: winner, detail: plural(wins[winner], "victoire") });

  // 2. Plus gros carton : la victoire la plus nette d'un jeu (écart relatif au 2e).
  let carton: { id: PlayerId; margin: number; record: SoireeGameRecord; score: number } | null = null;
  for (const r of records) {
    if (r.coop) continue;
    const w = winnersOf(r);
    if (w.length !== 1) continue;
    const sorted = r.ranking.map((x) => x.score).sort((a, b) => b - a);
    const top = sorted[0] ?? 0;
    if (top <= 0) continue;
    const margin = (top - (sorted[1] ?? 0)) / top;
    if (margin >= 0.25 && (!carton || margin > carton.margin)) carton = { id: w[0], margin, record: r, score: top };
  }
  if (carton) out.push({ id: "big_win", label: "Plus gros carton", playerId: carton.id, detail: `${gameName(carton.record.gameId)} · ${fmt(carton.score)} pt${carton.score > 1 ? "s" : ""}` });

  // 3. Tête de quiz : le plus de points de soirée sur les jeux de culture / réflexion.
  const quiz = records.filter((r) => QUIZ_GAMES.includes(r.gameId) && !r.coop);
  if (quiz.length) {
    const pts: Record<PlayerId, number> = {};
    for (const r of quiz) for (const [id, p] of Object.entries(r.points)) pts[id] = (pts[id] ?? 0) + p;
    const brain = strictTop(pts);
    if (brain) {
      const detail = quiz.length === 1 ? `${ordinal(quiz[0].ranking.find((x) => x.id === brain)?.place ?? 1)} place à ${gameName(quiz[0].gameId)}` : `${plural(pts[brain], "pt", "pts")} sur ${quiz.length} jeux de tête`;
      out.push({ id: "quiz_head", label: "Tête de quiz", playerId: brain, detail });
    }
  }

  // 4. Distinctions des jeux, regroupées (un même titre gagné plusieurs fois compte).
  const groups = new Map<string, { label: string; byPlayer: Record<PlayerId, number>; firstDetail: Record<PlayerId, string | undefined> }>();
  for (const r of records) {
    for (const a of r.awards) {
      const key = AWARD_ALIASES[a.id] ?? a.id;
      const g = groups.get(key) ?? { label: a.label, byPlayer: {}, firstDetail: {} };
      g.byPlayer[a.playerId] = (g.byPlayer[a.playerId] ?? 0) + 1;
      if (!(a.playerId in g.firstDetail)) g.firstDetail[a.playerId] = a.detail;
      groups.set(key, g);
    }
  }
  const keys = [...groups.keys()].sort((a, b) => rank(a) - rank(b));
  for (const key of keys) {
    const g = groups.get(key)!;
    const who = strictTop(g.byPlayer);
    if (!who) continue;
    const n = g.byPlayer[who];
    out.push({ id: key, label: g.label, playerId: who, detail: n > 1 ? `dans ${plural(n, "jeu", "jeux")}` : g.firstDetail[who] });
  }

  // 5. Remontada : la plus belle remontée depuis le 1er jeu (2 places ou plus).
  if (records.length >= 3) {
    const start = placesAfter(s, 1);
    const end = Object.fromEntries(standings.map((r) => [r.id, r.place]));
    const climb: Record<PlayerId, number> = {};
    for (const [id, p] of Object.entries(end)) if (start[id] != null) climb[id] = start[id] - p;
    const hero = strictTop(climb, 1);
    if (hero) out.push({ id: "comeback", label: "Remontada", playerId: hero, detail: `de la ${ordinal(start[hero])} à la ${ordinal(end[hero])} place` });
  }

  // 6. Abonné au podium : sur le podium à chaque jeu (hors champion).
  const scored = records.filter((r) => !r.coop);
  if (scored.length >= 3) {
    const always = standings
      .map((r) => r.id)
      .filter((id) => id !== champion && scored.every((r) => (r.ranking.find((x) => x.id === id)?.place ?? 99) <= 3));
    if (always.length === 1) out.push({ id: "always_podium", label: "Abonné au podium", playerId: always[0], detail: `${scored.length} podiums sur ${scored.length}` });
  }

  return out.slice(0, SOIREE_MAX_HIGHLIGHTS);
}

function rank(key: string): number {
  const i = AWARD_PRIORITY.indexOf(key);
  return i < 0 ? AWARD_PRIORITY.length : i;
}
