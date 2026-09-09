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

/** Modes (SPEC §2). `classic` par défaut ; `chain` et `duel` exigent 3 joueurs
 *  (sinon repli sur classic). */
export type MimicMode = "classic" | "chain" | "duel";

export interface MimicSettings {
  totalRounds?: number;    // nb de manches (défaut 4)
  recordSeconds?: number;  // durée d'enregistrement (défaut 6)
  mode?: string;           // classic | chain | duel
}

export interface MimicConfig {
  totalRounds: number;
  mode: MimicMode;
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
  // --- Orchestration par mode -------------------------------------------------
  /** Qui enregistre pour la sous-manche courante. classic : tout le monde ;
   *  duel : les 2 duellistes ; chain : uniquement le joueur courant de la chaîne. */
  activeIds: PlayerId[];
  // Duel
  duelPairs: PlayerId[][];   // paires de la manche (calculées au départ)
  duelIndex: number;         // paire courante (0-based)
  duelChampion: PlayerId | null; // vainqueur du duel précédent (appariement impair)
  // Chain
  chainOrder: PlayerId[];    // ordre fixe de la chaîne
  chainPos: number;          // position courante qui enregistre (0-based)
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
  mode: MimicMode;
  players: GamePlayer[];
  round: number;
  totalRounds: number;
  sound: MimicSound | null;            // son courant (id, nom, catégorie, src)
  // Orchestration par mode
  activeIds: PlayerId[];               // qui enregistre pour cette sous-manche
  youActive: boolean;                  // le spectateur enregistre-t-il ?
  // Duel
  duelChampionId: PlayerId | null;
  duelNo: number;                      // n° du duel dans la manche (1-based)
  duelTotal: number;                   // nb de duels dans la manche
  // Chain : à qui le joueur courant doit-il ressembler (prise à écouter avant
  // d'enregistrer, null = son d'origine) et qui enregistre.
  chainRecorderId: PlayerId | null;
  chainHearsId: PlayerId | null;       // null = son source ; sinon prise de ce joueur
  chainPos: number;                    // position dans la chaîne (0-based)
  chainLen: number;
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
