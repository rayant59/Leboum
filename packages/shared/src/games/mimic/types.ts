import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { MimicSound } from "./sounds";

// Machine à états (serveur autoritaire). Le client n'en décide jamais.
export type MimicPhase =
  | "prep"        // test micro + prêt (une fois, avant la 1re manche)
  | "reference"   // 🎧 on écoute le son à imiter
  | "countdown"   // 3 · 2 · 1
  | "recording"   // 🔴 tout le monde enregistre (une seule prise)
  | "processing"  // court instant : on attend que les prises arrivent
  | "playback"    // 🎧 lecture des prises une par une
  | "voting"      // ⭐ on vote pour la meilleure imitation
  | "scoreboard"  // classement de la manche
  | "gameover";   // 🏆 victoire

export interface MimicSettings {
  totalRounds?: number;    // nb de manches (défaut 4)
  recordSeconds?: number;  // durée d'enregistrement (défaut 6)
}

export interface MimicConfig {
  totalRounds: number;
  referenceMs: number;
  countdownMs: number;
  recordMs: number;
  processingMs: number;
  playbackPadMs: number;   // marge ajoutée à recordMs pour la fenêtre de lecture d'une prise
  votingMs: number;        // sécurité (avance dès que tout le monde a voté)
  scoreboardMs: number;
}

export type MimicClientAction =
  | { kind: "ready"; ready: boolean }              // prep
  | { kind: "start" }                              // hôte : prep -> manche 1
  | { kind: "take_done"; empty?: boolean }         // « j'ai fini » (l'audio part en éphémère)
  | { kind: "vote"; targetId: PlayerId }           // voting
  | { kind: "next" };                              // hôte : scoreboard -> manche suivante

export interface MimicState {
  phase: MimicPhase;
  players: GamePlayer[];
  connectedIds: PlayerId[];
  round: number;                       // 1-based
  soundId: string | null;              // son de référence courant
  usedSoundIds: string[];              // anti-répétition
  ready: Record<PlayerId, boolean>;    // prep
  submitted: Record<PlayerId, boolean>;// qui a rendu sa prise (remis à zéro chaque manche)
  emptyTake: Record<PlayerId, boolean>;// prise vide (rien enregistré)
  playbackOrder: PlayerId[];           // ordre de lecture des prises
  playbackIndex: number;               // prise en cours de lecture
  votes: Record<PlayerId, PlayerId>;   // voterId -> targetId (manche courante)
  roundVotes: Record<PlayerId, number>;// votes reçus cette manche (calculé au scoreboard)
  scores: Record<PlayerId, number>;    // cumulés
  bestCount: Record<PlayerId, number>; // nb de « meilleure imitation » (stats)
  votesReceivedTotal: Record<PlayerId, number>; // stats de fin
  deadline: number | null;
  winnerId: PlayerId | null;
  config: MimicConfig;
}

export interface MimicRankRow {
  id: PlayerId;
  name: string;
  color: string;
  avatar?: string | null;
  score: number;
  roundVotes: number;    // votes reçus la manche affichée
  isBest: boolean;       // meilleure imitation de la manche
}

export interface MimicPublic {
  phase: MimicPhase;
  players: GamePlayer[];
  round: number;
  totalRounds: number;
  sound: MimicSound | null;            // son courant (id, nom, catégorie, src)
  ready: Record<PlayerId, boolean>;
  allReady: boolean;
  submittedIds: PlayerId[];            // qui a rendu sa prise
  youSubmitted: boolean;
  recordMs: number;
  // playback
  playbackOrder: PlayerId[];
  playbackIndex: number;
  currentTakeId: PlayerId | null;      // prise en cours de lecture
  // voting
  votedIds: PlayerId[];                // qui a voté (pas pour qui)
  yourVote: PlayerId | null;
  ranking: MimicRankRow[];             // trié par score décroissant
  deadline: number | null;
  winnerId: PlayerId | null;
  stats: { topVotes: string | null; bestImitator: string | null } | null;
}
