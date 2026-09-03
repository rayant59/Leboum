// ---------------------------------------------------------------------------
// Mimic — moteur pur & autoritaire (façon Mimic Party).
//
// Un son de référence → tout le monde l'imite (une seule prise, enregistrée) →
// les prises sont rejouées une par une → on vote pour la meilleure → points →
// manche suivante. Le serveur possède TOUTES les transitions de phase (via
// `deadline`) ; le client ne fait qu'afficher et envoyer des intentions.
//
// L'audio des prises NE PASSE PAS par cet état : il est relayé en éphémère par
// le serveur (comme les traits de dessin). Ici on ne suit qu'un booléen
// « rendu » par joueur, pour savoir quand avancer.
// ---------------------------------------------------------------------------

import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { getMimicSound, pickMimicSound } from "./sounds";
import type { MimicClientAction, MimicConfig, MimicPublic, MimicRankRow, MimicSettings, MimicState } from "./types";

export const MIMIC_ROUNDS_MIN = 2;
export const MIMIC_ROUNDS_MAX = 8;
const RECENT_SOUNDS = 12;
const POINTS_PER_VOTE = 100;
const BEST_BONUS = 50;

export function resolveMimicConfig(settings: MimicSettings): MimicConfig {
  const totalRounds = clamp(settings.totalRounds ?? 4, MIMIC_ROUNDS_MIN, MIMIC_ROUNDS_MAX);
  const recordSec = clamp(settings.recordSeconds ?? 10, 5, 25);
  return {
    totalRounds,
    referenceMs: 6000,
    countdownMs: 3000,
    recordMs: recordSec * 1000,
    processingMs: 2500,
    playbackPadMs: 2200,
    votingMs: 40000,
    scoreboardMs: 8000,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function rec0(players: GamePlayer[]): Record<PlayerId, number> {
  const r: Record<PlayerId, number> = {};
  for (const p of players) r[p.id] = 0;
  return r;
}
function recFalse(players: GamePlayer[]): Record<PlayerId, boolean> {
  const r: Record<PlayerId, boolean> = {};
  for (const p of players) r[p.id] = false;
  return r;
}

const ok = (state: MimicState): GameReduceResult<MimicState> => ({ state });

export function createMimic(players: GamePlayer[], settings: MimicSettings, ctx: GameContext): MimicState {
  const config = resolveMimicConfig(settings);
  return {
    phase: "prep",
    players,
    connectedIds: players.map((p) => p.id),
    round: 0,
    soundId: null,
    usedSoundIds: [],
    ready: recFalse(players),
    submitted: recFalse(players),
    emptyTake: recFalse(players),
    playbackOrder: [],
    playbackIndex: 0,
    votes: {},
    roundVotes: rec0(players),
    scores: rec0(players),
    bestCount: rec0(players),
    votesReceivedTotal: rec0(players),
    deadline: null,
    winnerId: null,
    config,
  };
}

function connected(state: MimicState): PlayerId[] {
  const set = new Set(state.connectedIds);
  return state.players.filter((p) => set.has(p.id)).map((p) => p.id);
}

/** Démarre une manche : nouveau son + phase reference. */
function startRound(state: MimicState, round: number, ctx: GameContext): MimicState {
  const sound = pickMimicSound(ctx.rng, state.usedSoundIds);
  return {
    ...state,
    phase: "reference",
    round,
    soundId: sound?.id ?? null,
    usedSoundIds: sound ? [sound.id, ...state.usedSoundIds].slice(0, RECENT_SOUNDS) : state.usedSoundIds,
    submitted: recFalse(state.players),
    emptyTake: recFalse(state.players),
    playbackOrder: [],
    playbackIndex: 0,
    votes: {},
    deadline: ctx.now + state.config.referenceMs,
  };
}

export function reduceMimic(
  state: MimicState,
  action: GameAction<MimicClientAction>,
  ctx: GameContext,
): GameReduceResult<MimicState> {
  switch (action.type) {
    case "presence":
      return ok({ ...state, connectedIds: action.connectedIds });

    case "client": {
      const { playerId, msg } = action;
      if (!state.players.some((p) => p.id === playerId)) return ok(state);
      switch (msg.kind) {
        case "ready":
          if (state.phase !== "prep") return ok(state);
          return ok({ ...state, ready: { ...state.ready, [playerId]: msg.ready } });

        case "start": {
          if (state.phase !== "prep") return ok(state);
          return ok(startRound(state, 1, ctx));
        }

        case "take_done": {
          if (state.phase !== "recording") return ok(state);
          if (state.submitted[playerId]) return ok(state); // une seule prise — verrou
          const next: MimicState = {
            ...state,
            submitted: { ...state.submitted, [playerId]: true },
            emptyTake: { ...state.emptyTake, [playerId]: !!msg.empty },
          };
          // Tout le monde (connecté) a rendu → on passe au traitement.
          const conn = connected(next);
          if (conn.length > 0 && conn.every((id) => next.submitted[id])) {
            return ok(toProcessing(next, ctx));
          }
          return ok(next);
        }

        case "vote": {
          if (state.phase !== "voting") return ok(state);
          if (msg.targetId === playerId) return ok(state); // pas de vote pour soi
          if (!state.players.some((p) => p.id === msg.targetId)) return ok(state);
          if (state.votes[playerId]) return ok(state); // un seul vote
          const votes = { ...state.votes, [playerId]: msg.targetId };
          const next: MimicState = { ...state, votes };
          // Tout le monde a voté → dépouillement immédiat.
          const conn = connected(next).filter((id) => next.players.some((p) => p.id === id));
          if (conn.length > 0 && conn.every((id) => votes[id])) {
            return ok(tally(next, ctx));
          }
          return ok(next);
        }

        case "next": {
          if (state.phase !== "scoreboard") return ok(state);
          return ok(afterScoreboard(state, ctx));
        }
      }
      return ok(state);
    }

    case "advance":
      return ok(advance(state, ctx));
  }
}

function advance(state: MimicState, ctx: GameContext): MimicState {
  switch (state.phase) {
    case "prep":
      return state; // attend l'hôte
    case "reference":
      return { ...state, phase: "countdown", deadline: ctx.now + state.config.countdownMs };
    case "countdown":
      return { ...state, phase: "recording", deadline: ctx.now + state.config.recordMs };
    case "recording": {
      // Fin du temps : ceux qui n'ont rien rendu → prise vide.
      const submitted = { ...state.submitted };
      const emptyTake = { ...state.emptyTake };
      for (const id of connected(state)) {
        if (!submitted[id]) { submitted[id] = true; emptyTake[id] = true; }
      }
      return toProcessing({ ...state, submitted, emptyTake }, ctx);
    }
    case "processing":
      return toPlayback(state, ctx);
    case "playback": {
      const nextIdx = state.playbackIndex + 1;
      if (nextIdx < state.playbackOrder.length) {
        return { ...state, playbackIndex: nextIdx, deadline: ctx.now + state.config.recordMs + state.config.playbackPadMs };
      }
      return toVoting(state, ctx);
    }
    case "voting":
      return tally(state, ctx); // sécurité : le temps est écoulé
    case "scoreboard":
      return afterScoreboard(state, ctx);
    case "gameover":
      return state;
  }
}

function toProcessing(state: MimicState, ctx: GameContext): MimicState {
  return { ...state, phase: "processing", deadline: ctx.now + state.config.processingMs };
}

function toPlayback(state: MimicState, ctx: GameContext): MimicState {
  // Ordre de lecture : les joueurs connectés (prise vide incluse — on annonce « pas de prise »).
  const order = connected(state);
  if (order.length === 0) return toVoting({ ...state, playbackOrder: [], playbackIndex: 0 }, ctx);
  return {
    ...state,
    phase: "playback",
    playbackOrder: order,
    playbackIndex: 0,
    deadline: ctx.now + state.config.recordMs + state.config.playbackPadMs,
  };
}

function toVoting(state: MimicState, ctx: GameContext): MimicState {
  return { ...state, phase: "voting", votes: {}, deadline: ctx.now + state.config.votingMs };
}

/** Dépouille les votes de la manche, attribue les points, passe au scoreboard. */
function tally(state: MimicState, ctx: GameContext): MimicState {
  const roundVotes = rec0(state.players);
  for (const target of Object.values(state.votes)) {
    roundVotes[target] = (roundVotes[target] ?? 0) + 1;
  }
  const scores = { ...state.scores };
  const votesReceivedTotal = { ...state.votesReceivedTotal };
  for (const p of state.players) {
    const v = roundVotes[p.id] ?? 0;
    scores[p.id] = (scores[p.id] ?? 0) + v * POINTS_PER_VOTE;
    votesReceivedTotal[p.id] = (votesReceivedTotal[p.id] ?? 0) + v;
  }
  // Meilleure imitation de la manche (le plus de votes, >0) → bonus + stat.
  const bestCount = { ...state.bestCount };
  let maxV = 0;
  for (const p of state.players) maxV = Math.max(maxV, roundVotes[p.id] ?? 0);
  if (maxV > 0) {
    for (const p of state.players) {
      if ((roundVotes[p.id] ?? 0) === maxV) {
        scores[p.id] += BEST_BONUS;
        bestCount[p.id] = (bestCount[p.id] ?? 0) + 1;
      }
    }
  }
  return {
    ...state,
    phase: "scoreboard",
    roundVotes,
    scores,
    votesReceivedTotal,
    bestCount,
    deadline: ctx.now + state.config.scoreboardMs,
  };
}

function afterScoreboard(state: MimicState, ctx: GameContext): MimicState {
  if (state.round >= state.config.totalRounds) {
    // Fin de partie : le gagnant = meilleur score.
    let winner: PlayerId | null = null;
    let best = -1;
    for (const p of state.players) {
      const s = state.scores[p.id] ?? 0;
      if (s > best) { best = s; winner = p.id; }
    }
    return { ...state, phase: "gameover", deadline: null, winnerId: winner };
  }
  return startRound(state, state.round + 1, ctx);
}

export function mimicDeadline(state: MimicState): number | null {
  return state.phase === "prep" || state.phase === "gameover" ? null : state.deadline;
}

export function mimicIsOver(state: MimicState): boolean {
  return state.phase === "gameover";
}

function nameOf(state: MimicState, id: PlayerId | null): string | null {
  if (!id) return null;
  return state.players.find((p) => p.id === id)?.name ?? null;
}

export function projectMimic(state: MimicState, viewerId: PlayerId): MimicPublic {
  const maxRoundVotes = Math.max(0, ...state.players.map((p) => state.roundVotes[p.id] ?? 0));
  const ranking: MimicRankRow[] = [...state.players]
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      avatar: p.avatar,
      score: state.scores[p.id] ?? 0,
      roundVotes: state.roundVotes[p.id] ?? 0,
      isBest: maxRoundVotes > 0 && (state.roundVotes[p.id] ?? 0) === maxRoundVotes,
    }))
    .sort((a, b) => b.score - a.score);

  let stats: MimicPublic["stats"] = null;
  if (state.phase === "gameover") {
    let topId: PlayerId | null = null, topV = -1;
    let bestId: PlayerId | null = null, bestC = -1;
    for (const p of state.players) {
      const v = state.votesReceivedTotal[p.id] ?? 0;
      if (v > topV) { topV = v; topId = p.id; }
      const c = state.bestCount[p.id] ?? 0;
      if (c > bestC) { bestC = c; bestId = p.id; }
    }
    stats = {
      topVotes: topV > 0 ? nameOf(state, topId) : null,
      bestImitator: bestC > 0 ? nameOf(state, bestId) : null,
    };
  }

  return {
    phase: state.phase,
    players: state.players,
    round: state.round,
    totalRounds: state.config.totalRounds,
    sound: getMimicSound(state.soundId),
    ready: state.ready,
    allReady: state.players.length > 0 && state.players.every((p) => state.ready[p.id]),
    submittedIds: Object.keys(state.submitted).filter((id) => state.submitted[id]),
    youSubmitted: !!state.submitted[viewerId],
    recordMs: state.config.recordMs,
    playbackOrder: state.playbackOrder,
    playbackIndex: state.playbackIndex,
    currentTakeId: state.phase === "playback" ? state.playbackOrder[state.playbackIndex] ?? null : null,
    votedIds: Object.keys(state.votes),
    yourVote: state.votes[viewerId] ?? null,
    ranking,
    deadline: state.deadline,
    winnerId: state.winnerId,
    stats,
  };
}
