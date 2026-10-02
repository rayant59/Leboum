// « Le Top » — classe 5 éléments selon une consigne (du plus lourd au plus
// léger, du plus ancien au plus récent…). Plus ton ordre colle au bon, plus
// tu marques.
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";

/**
 * - `savoir` : l'ordre attendu est un fait (poids, dates, distances…).
 * - `table`  : l'ordre attendu est celui de la table (moyenne des classements) :
 *   il faut penser comme ses potes.
 */
export type RankingMode = "savoir" | "table";

export interface RankingSettings {
  totalRounds?: number;
  seconds?: number;
  mode?: string;
}

export interface RankingConfig {
  totalRounds: number;
  seconds: number;
  mode: RankingMode;
}

export interface RankingItem {
  label: string;
  /** Valeur affichée à la révélation (« 150 t »), mode savoir. */
  value?: string;
}

export interface RankingPrompt {
  title: string;
  /** Libellés des deux bouts du classement. */
  top: string;
  bottom: string;
  /** Éléments DANS LE BON ORDRE (du haut vers le bas). Mode table : ordre indifférent. */
  items: RankingItem[];
}

export type RankingPhase = "order" | "reveal" | "final";

export interface RankingState {
  phase: RankingPhase;
  players: GamePlayer[];
  connectedIds: PlayerId[];
  config: RankingConfig;
  prompts: RankingPrompt[];
  /** Manche courante (0-based). */
  index: number;
  /** Ordre d'affichage de départ (mêmes positions pour tous) : indices d'éléments. */
  shuffled: number[];
  /** Classements rendus : joueur → indices d'éléments, du haut vers le bas. */
  orders: Record<PlayerId, number[]>;
  /** Ordre attendu de la manche (calculé à la révélation en mode table). */
  expected: number[] | null;
  deadline: number | null;
  phaseMs: number;
  scores: Record<PlayerId, number>;
  gained: Record<PlayerId, number>;
  perfects: Record<PlayerId, number>;
}

export type RankingClientAction = { kind: "order"; order: number[] };

export interface RankingPublic {
  phase: RankingPhase;
  mode: RankingMode;
  players: GamePlayer[];
  round: number; // 1-based
  totalRounds: number;
  title: string;
  top: string;
  bottom: string;
  items: RankingItem[];
  /** Ordre de départ proposé à tous (positions affichées : 0..n-1). */
  shuffled: number[];
  yourOrder: number[] | null;
  submittedIds: PlayerId[];
  deadline: number | null;
  phaseMs: number;
  scores: Record<PlayerId, number>;
  /** Révélation : bon ordre, classements de chacun, points. */
  expected: number[] | null;
  orders: Record<PlayerId, number[]> | null;
  gained: Record<PlayerId, number> | null;
  perfects: Record<PlayerId, number> | null;
}
