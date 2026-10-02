// « Imposteur » — tout le monde reçoit le même mot… sauf un.
// Chacun donne un indice à tour de rôle, puis la table vote pour démasquer
// l'imposteur. Plusieurs manches, un nouvel imposteur à chaque fois.
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";

/**
 * - `classique` : l'imposteur SAIT qu'il l'est et ne connaît que la catégorie.
 *   S'il est démasqué, il peut encore voler la manche en devinant le mot.
 * - `infiltre` : l'imposteur reçoit un mot voisin et ne sait PAS qu'il est
 *   l'imposteur (personne ne connaît son rôle avant la révélation).
 */
export type ImposterMode = "classique" | "infiltre";

export interface ImposterSettings {
  totalRounds?: number;
  /** Temps pour donner un indice (s). */
  seconds?: number;
  mode?: string;
}

export interface ImposterConfig {
  totalRounds: number;
  clueSeconds: number;
  voteSeconds: number;
  guessSeconds: number;
  /** Nombre de tours d'indices par manche. */
  passes: number;
  mode: ImposterMode;
}

/** Une paire de mots proches d'une même catégorie (le 2ᵉ sert en mode infiltré). */
export interface ImposterPair {
  category: string;
  word: string;
  decoy: string;
}

export type ImposterPhase = "secret" | "clues" | "vote" | "guess" | "reveal" | "final";

export interface ImposterClue {
  playerId: PlayerId;
  text: string;
  pass: number; // 1-based
}

/** Issue d'une manche. */
export type ImposterOutcome =
  | "caught" //       démasqué, n'a pas trouvé le mot
  | "stolen" //       démasqué mais a deviné le mot (mode classique)
  | "escaped" //      pas démasqué (vote raté ou égalité)
  | "left"; //        l'imposteur a quitté la partie

export interface ImposterRoundSummary {
  imposterId: PlayerId;
  word: string;
  decoy: string | null;
  outcome: ImposterOutcome;
}

export interface ImposterState {
  phase: ImposterPhase;
  players: GamePlayer[];
  connectedIds: PlayerId[];
  config: ImposterConfig;
  pairs: ImposterPair[];
  /** Manche courante (0-based). */
  index: number;
  /** Joueurs qui participent à la manche (les arrivants attendent la suivante). */
  roster: PlayerId[];
  imposterId: PlayerId;
  /** Ordre de parole de la manche. */
  order: PlayerId[];
  /** Position dans `order` et tour d'indices courant (1-based). */
  turn: number;
  pass: number;
  clues: ImposterClue[];
  /** Qui a vu sa carte (phase « secret »). */
  seen: PlayerId[];
  /** votant → suspect. */
  votes: Record<PlayerId, PlayerId>;
  /** Proposition de l'imposteur démasqué (mode classique). */
  guess: string | null;
  outcome: ImposterOutcome | null;
  tally: Record<PlayerId, number>;
  /** Le ou les plus votés. */
  accused: PlayerId[];
  deadline: number | null;
  /** Durée totale de la phase en cours (jauge). */
  phaseMs: number;
  scores: Record<PlayerId, number>;
  gained: Record<PlayerId, number>;
  /** Stats de fin : manches gagnées en imposteur, votes justes. */
  imposterWins: Record<PlayerId, number>;
  goodVotes: Record<PlayerId, number>;
  history: ImposterRoundSummary[];
  /** Imposteurs déjà tirés (pour faire tourner le rôle). */
  pastImposters: PlayerId[];
}

export type ImposterClientAction =
  | { kind: "seen" }
  | { kind: "clue"; text: string }
  | { kind: "vote"; targetId: PlayerId }
  | { kind: "guess"; text: string };

export interface ImposterReveal {
  imposterId: PlayerId;
  word: string;
  decoy: string | null;
  outcome: ImposterOutcome;
  guess: string | null;
  votes: Record<PlayerId, PlayerId>;
  tally: Record<PlayerId, number>;
  accused: PlayerId[];
  gained: Record<PlayerId, number>;
}

export interface ImposterPublic {
  phase: ImposterPhase;
  mode: ImposterMode;
  players: GamePlayer[];
  roster: PlayerId[];
  round: number; // 1-based
  totalRounds: number;
  category: string;
  /** Ton mot. `null` si tu es l'imposteur en mode classique (ou spectateur). */
  yourWord: string | null;
  /** Vrai seulement pour l'imposteur en mode classique (en infiltré, personne ne sait). */
  youAreImposter: boolean;
  order: PlayerId[];
  currentId: PlayerId | null;
  pass: number;
  passes: number;
  clues: ImposterClue[];
  seenIds: PlayerId[];
  votedIds: PlayerId[];
  yourVote: PlayerId | null;
  /** Accusé(s) pendant la phase « guess » (l'imposteur démasqué). */
  accused: PlayerId[];
  deadline: number | null;
  phaseMs: number;
  scores: Record<PlayerId, number>;
  reveal: ImposterReveal | null;
  imposterWins: Record<PlayerId, number> | null;
  goodVotes: Record<PlayerId, number> | null;
  history: ImposterRoundSummary[] | null;
}
