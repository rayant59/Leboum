// ---------------------------------------------------------------------------
// Draw & Guess "game modes". A mode is a strategy object that parametrizes the
// engine — timings and scoring today, with documented extension points for
// richer future modes. Adding a mode = adding an object to DRAW_MODES; the core
// engine never changes.
//
// FUTURE EXTENSION POINTS (to add here as optional hooks when built):
//   - drawersForTurn(order, turnIndex): who draws (relay = swap mid-turn;
//     coop = several; fake-artist = everyone "draws" but one lacks the word).
//   - wordKnownBy(state): which players see the word (fake-artist hides it from
//     the impostor).
//   - canGuess / winCondition: fake-artist flips the goal (spot the impostor).
//   - onTick(state): blind mode hides the drawer's own strokes, constraint mode
//     limits tools — these are client concerns keyed off `mode`.
// Because modes are data, none of the above requires touching the reducer.
// ---------------------------------------------------------------------------

import type { DrawConfig, DrawSettings } from "./types";
import { DRAW_THEMES } from "./words";

export const DRAW_ROUNDS_MIN = 2;
export const DRAW_ROUNDS_MAX = 8;

export interface DrawMode {
  id: string;
  label: string;
  description: string;
  /** Turn timings + parameters for a game of `totalRounds` rounds. */
  resolveConfig(totalRounds: number): DrawConfig;
  /** Points for a correct guess, given the fraction of drawing time left (1→0). */
  scoreGuess(remainingFraction: number): number;
  /** Optional per-turn drawing constraint (constraints mode): a label to show
   *  and an enforceable rule id (null = voluntary rule, just displayed). */
  constraint?: (rng: () => number) => { label: string; rule: string | null } | null;
  /** The drawer can't see their own strokes (blind mode) — read by the client. */
  blind?: boolean;
}

const CONSTRAINTS: { label: string; rule: string | null }[] = [
  { label: "Une seule couleur 🎨", rule: "one_color" },
  { label: "Effet miroir 🪞", rule: "mirror" },
  { label: "Ça tremble ! 🫨", rule: "shake" },
  { label: "Curseur inversé 🔄", rule: "inverted" },
  { label: "Le trait tremble 〰️", rule: "jitter" },
  { label: "Pinceau traître 😈", rule: "betray" },
  { label: "Pinceau élastique 🪢", rule: "elastic" },
  { label: "Taille qui change 📏", rule: "size_shift" },
  { label: "Couleur qui change 🌈", rule: "color_shift" },
  { label: "Brouillard 🌫️", rule: "fog" },
  { label: "Toile qui rétrécit 🔻", rule: "shrink" },
  { label: "Curseur fantôme 👻", rule: "ghost_cursor" },
  { label: "Toile baladeuse 🏃", rule: "roam" },
];

function clampRounds(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.min(DRAW_ROUNDS_MAX, Math.max(DRAW_ROUNDS_MIN, Math.round(n)));
}

const classic: DrawMode = {
  id: "classic",
  label: "Classique",
  description: "Un dessine, les autres devinent. Le plus rapide marque le plus.",
  resolveConfig: (totalRounds) => ({
    totalRounds: clampRounds(totalRounds),
    chooseMs: 15_000,
    drawMs: 80_000,
    revealMs: 8_000,
    wordChoiceCount: 5,
    pointsDrawerPerGuess: 25,
  }),
  // 60 pts base + up to 60 for speed → early guesses ~120, last ~60.
  scoreGuess: (frac) => 60 + Math.round(60 * Math.max(0, Math.min(1, frac))),
};

const blind: DrawMode = {
  id: "blind",
  label: "Aveugle",
  description: "Tu dessines sans voir ton propre trait 😅. Plus de temps pour compenser.",
  resolveConfig: (totalRounds) => ({
    totalRounds: clampRounds(totalRounds),
    chooseMs: 12_000,
    drawMs: 95_000,
    revealMs: 8_000,
    wordChoiceCount: 5,
    pointsDrawerPerGuess: 30,
  }),
  scoreGuess: (frac) => 60 + Math.round(60 * Math.max(0, Math.min(1, frac))),
  blind: true,
};

const constraints: DrawMode = {
  id: "constraints",
  label: "Contraintes",
  description: "Chaque dessin impose une règle absurde (une couleur, sans lever le crayon…).",
  resolveConfig: (totalRounds) => ({
    totalRounds: clampRounds(totalRounds),
    chooseMs: 15_000,
    drawMs: 85_000,
    revealMs: 8_000,
    wordChoiceCount: 5,
    pointsDrawerPerGuess: 25,
  }),
  scoreGuess: (frac) => 60 + Math.round(60 * Math.max(0, Math.min(1, frac))),
  constraint: (rng) => CONSTRAINTS[Math.floor(rng() * CONSTRAINTS.length)],
};

const coop: DrawMode = {
  id: "coop",
  label: "Coopératif",
  description: "En équipe : tous vos points sont mis en commun pour un score collectif.",
  resolveConfig: (totalRounds) => ({
    totalRounds: clampRounds(totalRounds),
    chooseMs: 15_000,
    drawMs: 80_000,
    revealMs: 8_000,
    wordChoiceCount: 5,
    pointsDrawerPerGuess: 25,
  }),
  scoreGuess: (frac) => 60 + Math.round(60 * Math.max(0, Math.min(1, frac))),
};

export const DRAW_MODES: Record<string, DrawMode> = { classic, blind, constraints, coop };
export const DEFAULT_DRAW_SETTINGS: DrawSettings = { totalRounds: 3, mode: "classic" };

export function getDrawMode(id: string): DrawMode {
  return DRAW_MODES[id] ?? classic;
}

export function sanitizeDrawSettings(input: Partial<DrawSettings> | undefined): DrawSettings {
  const mode = input?.mode && DRAW_MODES[input.mode] ? input.mode : DEFAULT_DRAW_SETTINGS.mode;
  const themes = Array.isArray(input?.themes)
    ? input!.themes.filter((t) => DRAW_THEMES.includes(t))
    : [];
  return {
    totalRounds: clampRounds(input?.totalRounds ?? DEFAULT_DRAW_SETTINGS.totalRounds),
    mode,
    themes,
  };
}

export function resolveDrawConfig(settings: DrawSettings): DrawConfig {
  return getDrawMode(settings.mode).resolveConfig(settings.totalRounds);
}
