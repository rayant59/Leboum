// « Mot interdit » — un joueur fait deviner un mot sans prononcer (ni écrire)
// le mot lui-même ni les mots interdits de la carte. Chacun passe à son tour,
// chrono en main : un maximum de cartes avant la fin du temps.
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";

/**
 * - `ecrit` : indices écrits dans le salon. Le serveur bloque tout indice qui
 *   contient un mot interdit et valide seul les bonnes réponses (à distance).
 * - `oral`  : on parle à voix haute (même pièce). Le joueur suivant est le
 *   « censeur » : il voit la carte et buzze si un mot interdit est prononcé.
 *   Celui qui fait deviner désigne qui a trouvé.
 */
export type TabooMode = "ecrit" | "oral";

export interface TabooSettings {
  /** Tours de table (chaque joueur fait deviner une fois par tour). */
  totalRounds?: number;
  /** Durée d'un passage (s). */
  seconds?: number;
  mode?: string;
}

export interface TabooConfig {
  totalRounds: number;
  turnSeconds: number;
  mode: TabooMode;
}

export interface TabooCard {
  word: string;
  forbidden: string[];
}

export type TabooOutcome = "found" | "passed" | "forbidden";

export interface TabooPlayedCard {
  card: TabooCard;
  outcome: TabooOutcome;
  /** Qui a trouvé (outcome = found). */
  finderId?: PlayerId;
  /** Mot interdit en cause (outcome = forbidden, mode écrit). */
  culprit?: string;
}

export interface TabooMessage {
  id: number;
  from: PlayerId;
  kind: "clue" | "guess" | "system";
  text: string;
}

export type TabooPhase = "ready" | "turn" | "recap" | "final";

export interface TabooState {
  phase: TabooPhase;
  players: GamePlayer[];
  connectedIds: PlayerId[];
  config: TabooConfig;
  /** Ordre de passage (les arrivants s'ajoutent à la fin). */
  order: PlayerId[];
  /** Passage courant (0-based) : donneur = order[turn % order.length]. */
  turn: number;
  deck: TabooCard[];
  /** Prochaine carte à tirer dans `deck`. */
  cursor: number;
  current: TabooCard | null;
  /** Cartes jouées pendant le passage courant. */
  played: TabooPlayedCard[];
  /** Fil du passage en cours (mode écrit). */
  log: TabooMessage[];
  nextMsgId: number;
  deadline: number | null;
  phaseMs: number;
  scores: Record<PlayerId, number>;
  /** Points gagnés pendant le passage courant (récap). */
  gained: Record<PlayerId, number>;
  /** Stats de fin. */
  cardsGiven: Record<PlayerId, number>;
  cardsFound: Record<PlayerId, number>;
  slips: Record<PlayerId, number>;
}

export type TabooClientAction =
  | { kind: "start" }
  | { kind: "clue"; text: string }
  | { kind: "guess"; text: string }
  | { kind: "found"; finderId: PlayerId }
  | { kind: "pass" }
  | { kind: "buzz" };

export interface TabooPublic {
  phase: TabooPhase;
  mode: TabooMode;
  players: GamePlayer[];
  order: PlayerId[];
  turn: number; // 1-based
  totalTurns: number;
  giverId: PlayerId | null;
  /** Censeur (mode oral) : voit la carte et peut buzzer. */
  censorId: PlayerId | null;
  /** La carte, seulement pour le donneur et le censeur (et au récap). */
  card: TabooCard | null;
  /** Nombre de cartes déjà jouées dans ce passage. */
  playedCount: number;
  foundCount: number;
  log: TabooMessage[];
  deadline: number | null;
  phaseMs: number;
  scores: Record<PlayerId, number>;
  /** Récap du passage (phase recap / final). */
  recap: { giverId: PlayerId; played: TabooPlayedCard[]; gained: Record<PlayerId, number> } | null;
  cardsFound: Record<PlayerId, number> | null;
  cardsGiven: Record<PlayerId, number> | null;
}
