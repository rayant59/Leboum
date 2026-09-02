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

/** Événement « nouvelle(s) lettre(s) » pour l'animation (un tick). */
export interface BombeLetterEvent {
  playerId: PlayerId;
  newLetters: string[];   // lettres A-V nouvellement découvertes (majuscules)
  gainedLife: boolean;    // le joueur a gagné +1 vie
  atMax: boolean;         // lettres découvertes mais déjà au max de vies
  at: number;             // horloge serveur (pour dédupliquer l'animation)
}

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
  usedLetters: string[];                   // lettres A-V déjà découvertes (majuscules)
  letterEvent: BombeLetterEvent | null;    // dernière découverte de lettre (animation)
  recentSyllables: string[];               // anti-répétition
  wordsFound: Record<PlayerId, number>;    // stats
  turnsSurvived: Record<PlayerId, number>; // stats
  lastWord: string | null;                 // dernier mot validé (affichage)
  lastWordBy: PlayerId | null;
  justExploded: PlayerId | null;           // victime de la dernière explosion (animation)
  explodePause: boolean;                    // true pendant la pause « la bombe a sauté »
  pendingNext: PlayerId | null;             // joueur à qui armer le tour après la pause
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
  // Timer. On expose la vraie échéance pour que la mèche brûle EXACTEMENT jusqu'à
  // l'explosion (sinon la bombe « explose trop tôt » visuellement). La part de
  // mystère vient de la durée aléatoire choisie par le serveur à chaque tour.
  turnStartedAt: number;
  minMs: number;
  maxMs: number;
  deadline: number | null;          // instant réel d'explosion (horloge serveur)
  maxDeadline: number;              // turnStartedAt + maxMs (borne haute)
  lives: Record<PlayerId, number>;
  maxLives: number;
  eliminatedIds: PlayerId[];
  ranking: BombeRankRow[];
  lastWord: string | null;
  lastWordBy: PlayerId | null;
  justExploded: PlayerId | null;
  usedCount: number;
  aliveCount: number;
  usedLetters: string[];            // lettres A-V découvertes (pour l'affichage de la grille)
  letterEvent: BombeLetterEvent | null; // animation « nouvelle lettre »
  winnerId: PlayerId | null;
  // stats de fin
  stats: { words: string | null; survivor: string | null } | null;
}
