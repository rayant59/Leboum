// « La Plus Drôle » — une phrase à compléter, réponses anonymes, vote.
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";

export interface FunnySettings {
  totalRounds?: number;
  /** Temps d'écriture (s). */
  seconds?: number;
}

export interface FunnyConfig {
  totalRounds: number;
  writeSeconds: number;
  voteSeconds: number;
  maxChars: number;
}

export type FunnyPhase = "write" | "reveal" | "vote" | "results" | "final";

export interface FunnyBest {
  prompt: string;
  text: string;
  authorId: PlayerId;
  votes: number;
}

export interface FunnyState {
  phase: FunnyPhase;
  players: GamePlayer[];
  connectedIds: PlayerId[];
  config: FunnyConfig;
  prompts: string[];
  /** Manche courante (0-based). */
  index: number;
  /** auteur → réponse (manche courante). */
  answers: Record<PlayerId, string>;
  /** Ordre d'affichage anonyme : jeton → auteur. Jamais projeté avant les résultats. */
  tokens: Record<string, PlayerId>;
  order: string[];
  /** votant → jeton choisi. */
  votes: Record<PlayerId, string>;
  deadline: number | null;
  /** Durée totale de la phase en cours (pour la jauge). */
  phaseMs: number;
  scores: Record<PlayerId, number>;
  gained: Record<PlayerId, number>;
  /** Jetons gagnants de la manche (égalités possibles). */
  winners: string[];
  votesReceived: Record<PlayerId, number>;
  roundWins: Record<PlayerId, number>;
  best: FunnyBest[];
}

export type FunnyClientAction =
  | { kind: "answer"; text: string }
  | { kind: "vote"; token: string };

export interface FunnyAnswerPublic {
  token: string;
  text: string;
}

export interface FunnyResultPublic extends FunnyAnswerPublic {
  authorId: PlayerId;
  votes: number;
  voters: PlayerId[];
  gained: number;
  winner: boolean;
}

export interface FunnyPublic {
  phase: FunnyPhase;
  players: GamePlayer[];
  round: number;
  totalRounds: number;
  prompt: string;
  deadline: number | null;
  phaseSeconds: number;
  maxChars: number;
  scores: Record<PlayerId, number>;
  submittedIds: PlayerId[];
  yourAnswer: string | null;
  /** Réponses anonymes (révélation & vote). */
  answers: FunnyAnswerPublic[] | null;
  yourToken: string | null;
  votedIds: PlayerId[];
  yourVote: string | null;
  /** Résultats de la manche, auteurs dévoilés. */
  results: FunnyResultPublic[] | null;
  /** Fin de partie. */
  best: FunnyBest[] | null;
  votesReceived: Record<PlayerId, number> | null;
  roundWins: Record<PlayerId, number> | null;
}
