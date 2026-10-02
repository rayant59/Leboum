// ---------------------------------------------------------------------------
// Générateur de soirée (phase 14) — compose un programme selon la durée et
// l'ambiance, en respectant le nombre de joueurs de chaque jeu. Le résultat
// n'est qu'une proposition : l'hôte peut retirer, réordonner ou ajouter des jeux.
// ---------------------------------------------------------------------------

import { GAME_CATALOG, listedGames, type GameCategory, type GameModeInfo } from "../platform/catalog";
import { GAME_REGISTRY } from "../platform/registry";
import { shuffle } from "../platform/util";
import type { SoireeItem } from "./types";

/** Une recette : soit des jeux imposés, soit des quotas par famille. */
export interface SoireeFormat {
  id: string;
  name: string;
  /** Accroche affichée sur le bouton. */
  blurb: string;
  /** Durée visée (minutes, indicative). */
  minutes: number;
  /** Jeux imposés, dans l'ordre (remplacés s'ils sont injouables à ce nombre). */
  games?: string[];
  /** Ou : nombre de jeux par famille. */
  quotas?: Partial<Record<GameCategory, number>>;
  /** Parties raccourcies (moins de manches) pour tenir dans le temps. */
  short?: boolean;
}

export const SOIREE_FORMATS: SoireeFormat[] = [
  { id: "rapide", name: "Soirée rapide", blurb: "3 jeux nerveux, ~15 min", minutes: 15, games: ["bombe", "whois", "funny"], short: true },
  { id: "45min", name: "Soirée 45 min", blurb: "Social ×2, Créatif, Réflexion, Chaos", minutes: 45, quotas: { social: 2, creatif: 1, reflexion: 1, chaos: 1 } },
  { id: "chaos", name: "Soirée Chaos", blurb: "Ça crie, ça accuse, ça explose", minutes: 25, games: ["pixel", "bombe", "imposter", "yesno"], short: true },
  { id: "potes", name: "Entre potes", blurb: "Vos secrets, vos votes, vos fous rires", minutes: 40, quotas: { social: 4, creatif: 1 } },
  { id: "creative", name: "Soirée créative", blurb: "Crayons, imagination et images", minutes: 35, quotas: { creatif: 3, social: 1 } },
  { id: "cerveau", name: "Soirée cerveau", blurb: "Culture, logique et mauvaise foi", minutes: 35, quotas: { reflexion: 3, social: 1, chaos: 1 }, short: true },
  { id: "longue", name: "Grande soirée", blurb: "Le grand tour de LeBoum, ~1 h 15", minutes: 75, quotas: { social: 3, creatif: 2, reflexion: 2, chaos: 1, culture: 1 } },
];

/**
 * Réglages raccourcis par jeu (soirées courtes) — fusionnés avec les réglages
 * par défaut du module, puis passés à son `sanitizeSettings`.
 */
const SHORT_SETTINGS: Record<string, Record<string, unknown>> = {
  draw: { totalRounds: 2 },
  quiz: { totalQuestions: 6 },
  reco: { totalQuestions: 6 },
  pixel: { totalQuestions: 6 },
  whois: { totalRounds: 6 },
  funny: { totalRounds: 3 },
  imposter: { totalRounds: 2 },
  taboo: { totalRounds: 1, seconds: 45 },
  yesno: { totalRounds: 1, seconds: 30 },
  guesswho: { totalRounds: 2, seconds: 90 },
  ranking: { totalRounds: 3 },
  mimic: { totalRounds: 2 },
};

/** Un jeu est-il jouable à `players` joueurs ? */
export function playableWith(g: GameModeInfo, players: number): boolean {
  return players >= g.minPlayers && players <= g.maxPlayers && !!GAME_REGISTRY[g.id];
}

/** Réglages de lancement d'un jeu de soirée. */
export function soireeSettings(gameId: string, short = false): unknown {
  const mod = GAME_REGISTRY[gameId];
  if (!mod) return undefined;
  const base = mod.defaultSettings() as Record<string, unknown>;
  return mod.sanitizeSettings(short ? { ...base, ...(SHORT_SETTINGS[gameId] ?? {}) } : base);
}

export interface GeneratedItem extends SoireeItem {
  /** Libellé court pour l'interface (« Partie express »). */
  detail: string;
}

/**
 * Compose un programme. Jeux imposés d'abord (un jeu injouable est remplacé
 * par un autre de la même famille), sinon tirage par quotas de famille.
 * Jamais deux fois le même jeu ; on complète ailleurs si une famille est vide.
 */
export function generateSoiree(formatId: string, players: number, rng: () => number = Math.random): GeneratedItem[] {
  const format = SOIREE_FORMATS.find((f) => f.id === formatId) ?? SOIREE_FORMATS[1];
  const pool = listedGames().filter((g) => playableWith(g, players));
  const used = new Set<string>();
  const picked: GameModeInfo[] = [];
  const take = (g: GameModeInfo | undefined) => {
    if (g && !used.has(g.id)) {
      used.add(g.id);
      picked.push(g);
      return true;
    }
    return false;
  };
  const fromFamily = (cat: GameCategory) => shuffle(pool.filter((g) => g.category === cat && !used.has(g.id)), rng)[0];
  const anyOther = () => shuffle(pool.filter((g) => !used.has(g.id)), rng)[0];

  if (format.games) {
    for (const id of format.games) {
      const g = GAME_CATALOG[id];
      if (g && pool.includes(g)) take(g);
      else if (g) take(fromFamily(g.category) ?? anyOther());
    }
  } else if (format.quotas) {
    const slots: GameCategory[] = [];
    for (const [cat, n] of Object.entries(format.quotas) as [GameCategory, number][]) for (let i = 0; i < n; i++) slots.push(cat);
    for (const cat of slots) take(fromFamily(cat) ?? anyOther());
    // Pas d'ordre figé par famille : on alterne pour garder du rythme.
    picked.splice(0, picked.length, ...interleave(picked, rng));
  }
  return picked.map((g) => ({ gameId: g.id, settings: soireeSettings(g.id, !!format.short), detail: format.short ? "Partie express" : "Partie normale" }));
}

/** Mélange en évitant deux jeux de la même famille à la suite quand c'est possible. */
function interleave(games: GameModeInfo[], rng: () => number): GameModeInfo[] {
  const rest = shuffle(games, rng);
  const out: GameModeInfo[] = [];
  while (rest.length) {
    const prev = out[out.length - 1];
    const i = rest.findIndex((g) => !prev || g.category !== prev.category);
    out.push(rest.splice(i >= 0 ? i : 0, 1)[0]);
  }
  return out;
}

/** Durée estimée d'un programme (minutes). */
export function estimateMinutes(items: { gameId: string; detail?: string }[]): number {
  return items.reduce((m, it) => {
    const d = GAME_CATALOG[it.gameId]?.durationMin ?? 6;
    return m + (it.detail === "Partie express" ? Math.max(3, Math.round(d * 0.6)) : d);
  }, 0);
}
