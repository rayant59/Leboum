// « Devine qui » — un joueur (le Maître du secret) connaît une personne
// mystère ; les autres l'interrogent par questions fermées (oui / non) et
// tentent de la deviner avant d'épuiser le stock de questions ou le chrono.
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";

/**
 * - `celebrites` : une personnalité ou un personnage connu, tiré au sort.
 * - `entrenous`  : (retiré) l'un des joueurs du salon — plus proposé.
 */
export type GuessWhoMode = "celebrites" | "entrenous";

export interface GuessWhoSettings {
  totalRounds?: number;
  seconds?: number;
  mode?: string;
}

export interface GuessWhoConfig {
  totalRounds: number;
  seconds: number;
  maxQuestions: number;
  mode: GuessWhoMode;
}

export interface Celebrity {
  name: string;
  /** Indice affiché au Maître du secret (« Footballeur français »). */
  hint: string;
  /** Autres réponses acceptées (« Zizou »). */
  aliases?: string[];
}

export type GuessWhoAnswer = "oui" | "non" | "nsp" | "skip";

export interface GuessWhoQuestion {
  id: number;
  askerId: PlayerId;
  text: string;
  answer: GuessWhoAnswer | null;
}

export interface GuessWhoGuess {
  playerId: PlayerId;
  /** Texte proposé (célébrités) ou joueur désigné (entre nous). */
  text: string;
  ok: boolean;
}

export type GuessWhoPhase = "secret" | "ask" | "reveal" | "final";

export interface GuessWhoState {
  phase: GuessWhoPhase;
  players: GamePlayer[];
  connectedIds: PlayerId[];
  config: GuessWhoConfig;
  order: PlayerId[];
  /** Manche courante (0-based) : Maître = order[round % n]. */
  round: number;
  deck: Celebrity[];
  /** Personne mystère de la manche. */
  celebrity: Celebrity | null;
  secretPlayerId: PlayerId | null;
  questions: GuessWhoQuestion[];
  guesses: GuessWhoGuess[];
  nextId: number;
  /** Questions restantes (une mauvaise réponse en coûte une aussi). */
  left: number;
  finderId: PlayerId | null;
  deadline: number | null;
  phaseMs: number;
  scores: Record<PlayerId, number>;
  gained: Record<PlayerId, number>;
  founds: Record<PlayerId, number>;
  masterWins: Record<PlayerId, number>;
}

export type GuessWhoClientAction =
  | { kind: "ready" }
  | { kind: "ask"; text: string }
  | { kind: "answer"; questionId: number; answer: GuessWhoAnswer }
  | { kind: "guess"; text?: string; targetId?: PlayerId };

export interface GuessWhoPublic {
  phase: GuessWhoPhase;
  mode: GuessWhoMode;
  players: GamePlayer[];
  order: PlayerId[];
  round: number; // 1-based
  totalRounds: number;
  masterId: PlayerId | null;
  /** Le secret : seulement pour le Maître (puis pour tous à la révélation). */
  celebrity: Celebrity | null;
  secretPlayerId: PlayerId | null;
  questions: GuessWhoQuestion[];
  guesses: GuessWhoGuess[];
  left: number;
  maxQuestions: number;
  finderId: PlayerId | null;
  deadline: number | null;
  phaseMs: number;
  scores: Record<PlayerId, number>;
  gained: Record<PlayerId, number> | null;
  founds: Record<PlayerId, number> | null;
  masterWins: Record<PlayerId, number> | null;
}
