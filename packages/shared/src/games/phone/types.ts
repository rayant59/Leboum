// « Téléphone cassé » — chaque joueur lance une chaîne avec une phrase ; la
// chaîne passe de main en main en alternant DESSIN et DESCRIPTION :
//   Phrase → Dessin → Description → Dessin → Description…
// À la fin, on dévoile chaque chaîne étape par étape (le meilleur moment).
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";

/**
 * - `classique` : 5 étapes max (phrase, dessin, description, dessin, description).
 * - `complet`   : la chaîne fait le tour complet de la table (1 étape par joueur).
 */
export type PhoneMode = "classique" | "complet";

export interface PhoneSettings {
  /** Temps pour dessiner (s). L'écriture dure ~60 % de ce temps. */
  seconds?: number;
  mode?: string;
}

export interface PhoneConfig {
  mode: PhoneMode;
  writeSeconds: number;
  drawSeconds: number;
  /** Nombre d'étapes par chaîne (fixé au départ selon le nombre de joueurs). */
  steps: number;
}

export type PhoneStepKind = "text" | "drawing";

export interface PhoneEntry {
  kind: PhoneStepKind;
  authorId: PlayerId;
  /** Texte, ou image `data:image/...` pour un dessin. Vide = rien rendu à temps. */
  content: string;
  /** Rempli automatiquement (joueur absent / chrono écoulé). */
  auto?: boolean;
}

export interface PhoneChain {
  /** Celui qui a écrit la phrase de départ. */
  ownerId: PlayerId;
  entries: PhoneEntry[];
}

export type PhasePhone = "play" | "reveal" | "final";

export interface PhoneState {
  phase: PhasePhone;
  players: GamePlayer[];
  connectedIds: PlayerId[];
  config: PhoneConfig;
  /** Ordre de passage (fixé au départ) : la chaîne c est traitée à l'étape k
   *  par `order[(c + k) % n]`. */
  order: PlayerId[];
  chains: PhoneChain[];
  /** Étape courante (0-based). */
  step: number;
  /** Rendus de l'étape courante : joueur → contenu (modifiable jusqu'à la fin). */
  pending: Record<PlayerId, string>;
  /** Révélation : chaîne courante et nombre d'étapes déjà dévoilées. */
  revealChain: number;
  revealShown: number;
  /** « J'adore » : clé `chaine:etape` → votants. */
  likes: Record<string, PlayerId[]>;
  deadline: number | null;
  phaseMs: number;
  scores: Record<PlayerId, number>;
  /** Stats de fin : likes reçus sur les dessins / sur les textes. */
  drawLikes: Record<PlayerId, number>;
  textLikes: Record<PlayerId, number>;
}

export type PhoneClientAction =
  | { kind: "submit"; content: string }
  | { kind: "like"; chain: number; step: number };

export interface PhonePublicEntry extends PhoneEntry {
  step: number;
  likes: number;
  youLiked: boolean;
}

export interface PhonePublicChain {
  index: number;
  ownerId: PlayerId;
  entries: PhonePublicEntry[];
}

export interface PhonePublic {
  phase: PhasePhone;
  mode: PhoneMode;
  players: GamePlayer[];
  /** Joueurs de la partie (les arrivants regardent). */
  order: PlayerId[];
  step: number; // 0-based
  steps: number;
  stepKind: PhoneStepKind;
  /** Ce que tu dois faire maintenant (null = spectateur). */
  task: { kind: PhoneStepKind; prev: PhoneEntry | null; first: boolean } | null;
  yourContent: string | null;
  submittedIds: PlayerId[];
  deadline: number | null;
  phaseMs: number;
  scores: Record<PlayerId, number>;
  /** Révélation : chaîne en cours (étapes dévoilées seulement). */
  reveal: { chain: PhonePublicChain; chainIndex: number; chainCount: number; shown: number } | null;
  /** Fin : toutes les chaînes. */
  album: PhonePublicChain[] | null;
  drawLikes: Record<PlayerId, number> | null;
  textLikes: Record<PlayerId, number> | null;
}
