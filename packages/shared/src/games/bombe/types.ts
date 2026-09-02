import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";

export type BombePhase = "playing" | "gameover";

/** Réglages choisis par l'hôte dans le lobby. */
export interface BombeSettings {
  lives?: number;         // vies par joueur (défaut 3)
  minSeconds?: number;    // durée mini de la bombe (défaut 5)
  maxSeconds?: number;    // durée maxi de la bombe (défaut 12)
  minLetters?: number;    // longueur mini de la syllabe (2)
  maxLetters?: number;    // longueur maxi de la syllabe (3)
}

/** Config résolue (millisecondes), autoritaire côté serveur. */
export interface BombeConfig {
  lives: number;
  minMs: number;
  maxMs: number;
  minLetters: number;
  maxLetters: number;
}

export type BombeClientAction =
  | { kind: "submit"; text: string };     // le joueur courant valide un mot

/** État interne autoritaire (jamais envoyé tel quel au client). */
export interface BombeState {
  phase: BombePhase;
  players: GamePlayer[];
  connectedIds: PlayerId[];                // présence (mise à jour par le serveur)
  order: PlayerId[];                       // ordre de rotation fixe
  lives: Record<PlayerId, number>;
  eliminated: PlayerId[];                  // dans l'ordre d'élimination
  currentId: PlayerId | null;             // à qui de jouer
  syllable: string;                        // syllabe courante (normalisée, minuscule)
  turnStartedAt: number;                   // début du tour (horloge serveur)
  deadline: number | null;                 // instant EXACT d'explosion (secret)
  usedWords: string[];                     // mots déjà joués (normalisés) — interdits
  recentSyllables: string[];               // anti-répétition
  wordsFound: Record<PlayerId, number>;    // stats
  turnsSurvived: Record<PlayerId, number>; // stats
  lastWord: string | null;                 // dernier mot validé (affichage)
  lastWordBy: PlayerId | null;
  justExploded: PlayerId | null;           // pour l'animation d'explosion (un tick)
  winnerId: PlayerId | null;
  config: BombeConfig;
}

export interface BombeRankRow {
  id: PlayerId;
  name: string;
  color: string;
  avatar?: string | null;
  lives: number;
  eliminated: boolean;
  wordsFound: number;
  isCurrent: boolean;
}

/** Projection publique — ne révèle JAMAIS l'instant exact d'explosion. */
export interface BombePublic {
  phase: BombePhase;
  players: GamePlayer[];
  syllable: string;                 // affichée en gros
  currentId: PlayerId | null;
  youAreCurrent: boolean;
  // Timer : uniquement des bornes pour l'animation. Le vrai instant est secret.
  turnStartedAt: number;
  minMs: number;
  maxMs: number;
  maxDeadline: number;              // turnStartedAt + maxMs (borne haute, jamais l'exact)
  lives: Record<PlayerId, number>;
  maxLives: number;
  eliminatedIds: PlayerId[];
  ranking: BombeRankRow[];
  lastWord: string | null;
  lastWordBy: PlayerId | null;
  justExploded: PlayerId | null;
  usedCount: number;
  aliveCount: number;
  winnerId: PlayerId | null;
  // stats de fin
  stats: { words: string | null; survivor: string | null } | null;
}
