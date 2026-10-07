// ---------------------------------------------------------------------------
// Soirée LeBoum — une session qui enchaîne plusieurs Game Modes dans le même
// salon, avec un score global. Données pures, partagées client ⇄ serveur.
// ---------------------------------------------------------------------------

import type { PlayerId } from "../room/types";
import type { GameAward, RankedPlayer } from "../platform/result";

/** Un jeu au programme de la soirée, avec ses réglages de lancement. */
export interface SoireeItem {
  gameId: string;
  settings?: unknown;
  /** Jeu tiré au sort (« Jeu surprise ») : `gameId` est révélé au lancement. */
  surprise?: boolean;
}

/** Ce qu'un jeu terminé a rapporté à la soirée. */
export interface SoireeGameRecord {
  /** Position dans le programme (0 = premier jeu). */
  index: number;
  gameId: string;
  /** Identifiant de la partie jouée (une revanche remplace le résultat). */
  run: number;
  /** Score du jeu, dans son propre barème. */
  scores: Record<PlayerId, number>;
  /** Classement du jeu (place 1 = vainqueur). */
  ranking: RankedPlayer[];
  /** Points de soirée gagnés sur ce jeu. */
  points: Record<PlayerId, number>;
  coop: boolean;
  awards: GameAward[];
}

/** Identité figée d'un joueur : le classement final l'affiche même s'il est parti. */
export interface SoireePlayer {
  id: PlayerId;
  name: string;
  color: string;
  avatar?: string | null;
}

export interface SoireeState {
  items: SoireeItem[];
  /** Jeu en cours (ou prochain à jouer). `>= items.length` une fois finie. */
  current: number;
  records: SoireeGameRecord[];
  /** Score total de soirée par joueur (somme des `points`). */
  totals: Record<PlayerId, number>;
  players: Record<PlayerId, SoireePlayer>;
  finished: boolean;
  startedAt: number;
  /** Index des jeux passés faute du bon nombre de joueurs (affichés comme tels). */
  skipped?: number[];
  /** Fin de soirée : joueurs qui réclament une revanche (l'hôte la lance). */
  rematchVotes?: PlayerId[];
}

/** Ligne du classement de soirée. */
export interface SoireeStanding {
  id: PlayerId;
  total: number;
  place: number;
  /** Nombre de jeux gagnés (1re place, hors coop). */
  wins: number;
  played: number;
}

/** Nombre max de jeux dans une soirée. */
export const SOIREE_MAX_ITEMS = 12;
