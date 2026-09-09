import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { RecoItem } from "./bank";

export type RecoPhase = "question" | "reveal" | "final";

/** Modes partagés par Œil de Boum (reco) et Pixel Panic (pixel).
 *  reco : classic · zoom · theme — pixel : classic · rush · coop.
 *  Tout mode non géré par un jeu retombe sur `classic`. */
export type RecoMode = "classic" | "zoom" | "theme" | "rush" | "coop";

export interface RecoConfig { totalQuestions: number; secondsPerQuestion: number; category: string; mode: RecoMode }
export interface RecoSettings { totalQuestions?: number; secondsPerQuestion?: number; category?: string; mode?: string }
export interface RecoAnswer { value: string; at: number }

export interface RecoState {
  phase: RecoPhase;
  players: GamePlayer[];
  connectedIds: PlayerId[];
  config: RecoConfig;
  items: RecoItem[];
  index: number;
  startedAt: number;
  deadline: number | null;
  answers: Record<PlayerId, RecoAnswer>;
  scores: Record<PlayerId, number>;
  gained: Record<PlayerId, number>;
  correct: Record<PlayerId, boolean>;
  streak: Record<PlayerId, number>;
  bestStreak: Record<PlayerId, number>;
  fastMs: Record<PlayerId, number>;
  goodCount: Record<PlayerId, number>;
  // Mode coop (Pixel) : chrono GLOBAL partagé + score collectif. `deadline`
  // porte alors le chrono global ; `revealAt` la fin de révélation de l'image
  // courante, et `coopScore` le nombre d'images trouvées par la table.
  coopScore: number;
  revealAt: number | null;
  lastFoundBy: PlayerId | null; // dernier joueur à avoir trouvé (flash coop)
}

export type RecoClientAction = { kind: "answer"; value: string };

export interface PublicRecoItem { id: string; wiki: string; wikiEn?: string; question: string; category: string; img?: string }

export interface RecoRankRow {
  id: PlayerId; name: string; color: string; avatar?: string | null;
  score: number; gained: number; correct: boolean; answered: boolean;
}

export interface RecoPublic {
  phase: RecoPhase;
  players: GamePlayer[];
  mode: RecoMode;
  index: number;
  total: number;
  item: PublicRecoItem | null; // never carries the answer during "question"
  deadline: number | null;
  secondsPerQuestion: number;
  answeredIds: PlayerId[];
  yourAnswer: string | null;
  ranking: RecoRankRow[];
  correctText: string | null; // reveal only
  yourCorrect: boolean | null;
  yourGained: number | null;
  nextWiki: string | null; // reveal only: next subject, for image preloading
  nextWikiEn: string | null;
  stats: { fastest: string | null; brain: string | null; streak: string | null } | null;
  // coop (Pixel) : score collectif + fin de révélation de l'image courante
  // (le chrono d'en-tête reste `deadline`, qui porte le chrono global).
  coopScore: number | null;
  revealDeadline: number | null;
  lastFoundBy: PlayerId | null;
}
