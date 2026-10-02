// « Ni oui ni non » — un joueur est la cible : les autres le bombardent de
// questions pour lui faire dire OUI ou NON avant la fin du chrono.
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";

/**
 * - `voix` : on joue à l'oral. Quiconque entend un oui/non appuie sur
 *   « Il l'a dit ! » ; les autres joueurs valident d'un vote éclair.
 * - `chat` : on joue par écrit. Le serveur repère tout seul un oui/non
 *   (ouais, nan… compris) dans les réponses de la cible.
 */
export type YesNoMode = "voix" | "chat";

export interface YesNoSettings {
  totalRounds?: number;
  seconds?: number;
  mode?: string;
}

export interface YesNoConfig {
  totalRounds: number;
  seconds: number;
  mode: YesNoMode;
}

export type YesNoPhase = "ready" | "hot" | "verdict" | "result" | "final";

export interface YesNoMessage {
  id: number;
  from: PlayerId;
  text: string;
  /** Message de la cible qui l'a trahie (mode chat). */
  fatal?: boolean;
}

export type YesNoOutcome = "survived" | "caught";

export interface YesNoResult {
  targetId: PlayerId;
  outcome: YesNoOutcome;
  catcherId: PlayerId | null;
  /** Mot fatal repéré (mode chat). */
  word: string | null;
  survivedMs: number;
  gained: Record<PlayerId, number>;
}

export interface YesNoState {
  phase: YesNoPhase;
  players: GamePlayer[];
  connectedIds: PlayerId[];
  config: YesNoConfig;
  order: PlayerId[];
  /** Tour courant (0-based) : cible = order[turn % n]. */
  turn: number;
  deadline: number | null;
  phaseMs: number;
  /** Temps de chrono restant pour la cible (gelé pendant un vote). */
  remainingMs: number;
  /** Début de la séquence « hot » en cours (pour mesurer la survie). */
  hotSince: number | null;
  accuserId: PlayerId | null;
  /** Vote éclair : votant → « oui, il l'a dit ». */
  votes: Record<PlayerId, boolean>;
  log: YesNoMessage[];
  nextMsgId: number;
  result: YesNoResult | null;
  scores: Record<PlayerId, number>;
  /** Stats de fin. */
  catches: Record<PlayerId, number>;
  survivals: Record<PlayerId, number>;
}

export type YesNoClientAction =
  | { kind: "accuse" }
  | { kind: "verdict"; said: boolean }
  | { kind: "say"; text: string };

export interface YesNoPublic {
  phase: YesNoPhase;
  mode: YesNoMode;
  players: GamePlayer[];
  order: PlayerId[];
  turn: number; // 1-based
  totalTurns: number;
  targetId: PlayerId | null;
  deadline: number | null;
  phaseMs: number;
  /** Chrono de la cible restant (pour l'afficher pendant un vote). */
  remainingMs: number;
  seconds: number;
  accuserId: PlayerId | null;
  votedIds: PlayerId[];
  yourVote: boolean | null;
  log: YesNoMessage[];
  result: YesNoResult | null;
  scores: Record<PlayerId, number>;
  catches: Record<PlayerId, number> | null;
  survivals: Record<PlayerId, number> | null;
}
