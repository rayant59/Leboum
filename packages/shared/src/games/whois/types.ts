// « Qui de nous ? » — une question, tout le monde vote pour un joueur.
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";

export type WhoisCategory = "drole" | "personnalite" | "absurde" | "amis" | "competition" | "soiree";

export const WHOIS_CATEGORIES: Record<WhoisCategory, string> = {
  drole: "Drôle",
  personnalite: "Personnalité",
  absurde: "Situations absurdes",
  amis: "Entre amis",
  competition: "Compétition",
  soiree: "Soirée",
};

export interface WhoisQuestion {
  text: string;
  category: WhoisCategory;
}

export interface WhoisSettings {
  totalRounds?: number;
  seconds?: number;
  /** Préréglage de catégories : "mix" ou une catégorie. */
  mode?: string;
}

export interface WhoisConfig {
  totalRounds: number;
  seconds: number;
  categories: WhoisCategory[];
}

export type WhoisPhase = "question" | "reveal" | "final";

export interface WhoisRoundSummary {
  question: string;
  elected: PlayerId[];
  votes: number;
}

export interface WhoisState {
  phase: WhoisPhase;
  players: GamePlayer[];
  connectedIds: PlayerId[];
  config: WhoisConfig;
  questions: WhoisQuestion[];
  /** Question courante (0-based). */
  index: number;
  /** votant → joueur désigné (manche courante). */
  votes: Record<PlayerId, PlayerId>;
  deadline: number | null;
  scores: Record<PlayerId, number>;
  /** Points gagnés à la dernière révélation. */
  gained: Record<PlayerId, number>;
  /** Votes reçus à la dernière révélation. */
  tally: Record<PlayerId, number>;
  /** Le ou les élus de la dernière révélation (égalité possible). */
  elected: PlayerId[];
  /** Stats de fin : nombre de fois élu, nombre de votes « dans la majorité ». */
  timesElected: Record<PlayerId, number>;
  majorityVotes: Record<PlayerId, number>;
  history: WhoisRoundSummary[];
}

export type WhoisClientAction = { kind: "vote"; targetId: PlayerId };

export interface WhoisPublic {
  phase: WhoisPhase;
  players: GamePlayer[];
  round: number; // 1-based
  totalRounds: number;
  question: WhoisQuestion | null;
  categoryLabel: string;
  deadline: number | null;
  seconds: number;
  scores: Record<PlayerId, number>;
  /** Qui a déjà voté (jamais pour qui, avant la révélation). */
  votedIds: PlayerId[];
  yourVote: PlayerId | null;
  /** Révélation : votes détaillés, décompte, élus, points gagnés. */
  votes: Record<PlayerId, PlayerId> | null;
  tally: Record<PlayerId, number> | null;
  elected: PlayerId[];
  gained: Record<PlayerId, number> | null;
  /** Fin de partie : distinctions. */
  timesElected: Record<PlayerId, number> | null;
  majorityVotes: Record<PlayerId, number> | null;
  history: WhoisRoundSummary[] | null;
}
