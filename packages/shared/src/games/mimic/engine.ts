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
import type { MimicClientAction, MimicConfig, MimicMode, MimicPublic, MimicRankRow, MimicSettings, MimicState } from "./types";

export const MIMIC_ROUNDS_MIN = 2;
export const MIMIC_ROUNDS_MAX = 8;
const RECENT_SOUNDS = 12;
const POINTS_PER_VOTE = 100;
const BEST_BONUS = 50;
// Points de participation : récompense pour avoir réellement imité (prise non vide),
// pour que le mode donne des points en autonomie même sans recevoir de vote.
const PARTICIPATION_POINTS = 25;

export function resolveMimicMode(mode: string | undefined): MimicMode {
  return mode === "chain" || mode === "duel" ? mode : "classic";
}

export function resolveMimicConfig(settings: MimicSettings): MimicConfig {
  const totalRounds = clamp(settings.totalRounds ?? 4, MIMIC_ROUNDS_MIN, MIMIC_ROUNDS_MAX);
  const recordSec = clamp(settings.recordSeconds ?? 10, 5, 25);
  return {
    totalRounds,
    mode: resolveMimicMode(settings.mode),
    referenceMs: 9000,
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
  let config = resolveMimicConfig(settings);
  // Chaîne / Duel exigent 3 joueurs : sinon on retombe sur classique.
  if ((config.mode === "chain" || config.mode === "duel") && players.length < 3) {
    config = { ...config, mode: "classic" };
  }
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
    activeIds: [],
    duelPairs: [],
    duelIndex: 0,
    duelChampion: null,
    chainOrder: [],
    chainPos: 0,
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Duel : construit les paires de la manche à partir des joueurs connectés
 *  (mélangés). Nombre impair → le dernier affrontera le champion du duel
 *  précédent (paire à un seul élément, complétée à la volée dans startDuel). */
function buildDuelPairs(ids: PlayerId[]): PlayerId[][] {
  const pairs: PlayerId[][] = [];
  for (let i = 0; i < ids.length; i += 2) {
    pairs.push(ids.slice(i, i + 2));
  }
  return pairs;
}

function connected(state: MimicState): PlayerId[] {
  const set = new Set(state.connectedIds);
  return state.players.filter((p) => set.has(p.id)).map((p) => p.id);
}

function freshSound(state: MimicState, ctx: GameContext): Pick<MimicState, "soundId" | "usedSoundIds"> {
  const sound = pickMimicSound(ctx.rng, state.usedSoundIds);
  return {
    soundId: sound?.id ?? null,
    usedSoundIds: sound ? [sound.id, ...state.usedSoundIds].slice(0, RECENT_SOUNDS) : state.usedSoundIds,
  };
}

/** Démarre une manche selon le mode. classic : tout le monde imite le son.
 *  chain : ordre fixe, on commence par le 1er joueur (il écoute le son source).
 *  duel : on construit les paires et on lance le 1er duel. */
function startRound(state: MimicState, round: number, ctx: GameContext): MimicState {
  const conn = connected(state);
  const base: MimicState = {
    ...state,
    round,
    submitted: recFalse(state.players),
    emptyTake: recFalse(state.players),
    playbackOrder: [],
    playbackIndex: 0,
    votes: {},
  };
  if (state.config.mode === "duel") {
    const pairs = buildDuelPairs(shuffle(conn, ctx.rng));
    return startDuel({ ...base, duelPairs: pairs, duelIndex: 0, duelChampion: null }, ctx);
  }
  if (state.config.mode === "chain") {
    const chainOrder = shuffle(conn, ctx.rng);
    return {
      ...base, ...freshSound(state, ctx),
      chainOrder, chainPos: 0,
      activeIds: chainOrder.length ? [chainOrder[0]] : [],
      phase: "reference", deadline: ctx.now + state.config.referenceMs,
    };
  }
  // classic
  return {
    ...base, ...freshSound(state, ctx),
    activeIds: conn, phase: "reference", deadline: ctx.now + state.config.referenceMs,
  };
}

/** Duel : démarre le duel `duelIndex`. Paire impaire (1 joueur) → complétée par
 *  le champion du duel précédent. Son frais pour chaque duel. */
function startDuel(state: MimicState, ctx: GameContext): MimicState {
  let pair = state.duelPairs[state.duelIndex] ?? [];
  if (pair.length === 1) {
    if (state.duelChampion && state.duelChampion !== pair[0]) pair = [pair[0], state.duelChampion];
  }
  return {
    ...state, ...freshSound(state, ctx),
    submitted: recFalse(state.players),
    emptyTake: recFalse(state.players),
    playbackOrder: [], playbackIndex: 0, votes: {},
    activeIds: pair,
    phase: "reference",
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
          if (!state.activeIds.includes(playerId)) return ok(state); // seuls les actifs enregistrent
          if (state.submitted[playerId]) return ok(state); // une seule prise — verrou
          const next: MimicState = {
            ...state,
            submitted: { ...state.submitted, [playerId]: true },
            emptyTake: { ...state.emptyTake, [playerId]: !!msg.empty },
          };
          // Tous les ACTIFS connectés ont rendu → on avance (mode-aware).
          const activeConn = next.activeIds.filter((id) => next.connectedIds.includes(id));
          if (activeConn.length > 0 && activeConn.every((id) => next.submitted[id])) {
            return ok(afterRecording(next, ctx));
          }
          return ok(next);
        }

        case "vote": {
          if (state.phase !== "voting") return ok(state);
          if (msg.targetId === playerId) return ok(state); // pas de vote pour soi
          if (!state.players.some((p) => p.id === msg.targetId)) return ok(state);
          if (!canVoteFor(state, playerId, msg.targetId)) return ok(state);
          if (state.votes[playerId]) return ok(state); // un seul vote
          const votes = { ...state.votes, [playerId]: msg.targetId };
          const next: MimicState = { ...state, votes };
          // Tous les votants attendus ont voté → dépouillement immédiat.
          const voters = expectedVoters(next);
          if (voters.length > 0 && voters.every((id) => votes[id])) {
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
      // Fin du temps : les ACTIFS qui n'ont rien rendu → prise vide.
      const submitted = { ...state.submitted };
      const emptyTake = { ...state.emptyTake };
      for (const id of state.activeIds) {
        if (state.connectedIds.includes(id) && !submitted[id]) { submitted[id] = true; emptyTake[id] = true; }
      }
      return afterRecording({ ...state, submitted, emptyTake }, ctx);
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

/** Après un enregistrement : en Chaîne, on passe au joueur suivant (qui écoutera
 *  la prise du précédent) tant qu'il en reste ; sinon on part en lecture. */
function afterRecording(state: MimicState, ctx: GameContext): MimicState {
  if (state.config.mode === "chain" && state.chainPos + 1 < state.chainOrder.length) {
    const nextPos = state.chainPos + 1;
    return { ...state, chainPos: nextPos, activeIds: [state.chainOrder[nextPos]], phase: "reference", deadline: ctx.now + state.config.referenceMs };
  }
  return toProcessing(state, ctx);
}

function toProcessing(state: MimicState, ctx: GameContext): MimicState {
  return { ...state, phase: "processing", deadline: ctx.now + state.config.processingMs };
}

function toPlayback(state: MimicState, ctx: GameContext): MimicState {
  // Ordre de lecture selon le mode. duel : les 2 duellistes ; chain : toute la
  // chaîne (le client joue le son source en tête) ; classic : tout le monde.
  const order =
    state.config.mode === "duel" ? state.activeIds.filter((id) => state.connectedIds.includes(id))
    : state.config.mode === "chain" ? state.chainOrder
    : connected(state);
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

/** Votants attendus pour la sous-manche : duel → tous sauf les 2 duellistes ;
 *  classic/chain → tout le monde. */
function expectedVoters(state: MimicState): PlayerId[] {
  const conn = connected(state).filter((id) => state.players.some((p) => p.id === id));
  if (state.config.mode === "duel") return conn.filter((id) => !state.activeIds.includes(id));
  return conn;
}

/** Cibles de vote valides : duel → uniquement les 2 duellistes. */
function canVoteFor(state: MimicState, voterId: PlayerId, targetId: PlayerId): boolean {
  if (state.config.mode === "duel") return state.activeIds.includes(targetId) && !state.activeIds.includes(voterId);
  return true;
}

/** Dépouille les votes, attribue les points selon le mode, puis enchaîne :
 *  duel → duel suivant tant qu'il en reste, sinon scoreboard ; chain/classic →
 *  scoreboard. */
function tally(state: MimicState, ctx: GameContext): MimicState {
  const roundVotes = rec0(state.players);
  for (const target of Object.values(state.votes)) {
    roundVotes[target] = (roundVotes[target] ?? 0) + 1;
  }
  const scores = { ...state.scores };
  const votesReceivedTotal = { ...state.votesReceivedTotal };
  const bestCount = { ...state.bestCount };

  if (state.config.mode === "duel") {
    const [a, b] = state.activeIds;
    const va = roundVotes[a] ?? 0, vb = roundVotes[b] ?? 0;
    votesReceivedTotal[a] = (votesReceivedTotal[a] ?? 0) + va;
    votesReceivedTotal[b] = (votesReceivedTotal[b] ?? 0) + vb;
    // +3 au vainqueur, +1 au perdant ; égalité → +3 aux deux.
    let champion: PlayerId;
    if (va === vb) { scores[a] += 3; scores[b] += 3; champion = a; }
    else if (va > vb) { scores[a] += 3; scores[b] += 1; champion = a; }
    else { scores[b] += 3; scores[a] += 1; champion = b; }
    bestCount[champion] = (bestCount[champion] ?? 0) + 1;
    const next: MimicState = { ...state, roundVotes, scores, votesReceivedTotal, bestCount, duelChampion: champion };
    if (state.duelIndex + 1 < state.duelPairs.length) {
      return startDuel({ ...next, duelIndex: state.duelIndex + 1 }, ctx);
    }
    return { ...next, phase: "scoreboard", deadline: ctx.now + state.config.scoreboardMs };
  }

  if (state.config.mode === "chain") {
    for (const p of state.players) votesReceivedTotal[p.id] = (votesReceivedTotal[p.id] ?? 0) + (roundVotes[p.id] ?? 0);
    const voterCount = Object.keys(state.votes).length;
    let topId: PlayerId | null = null, maxV = 0;
    for (const p of state.players) { const v = roundVotes[p.id] ?? 0; if (v > maxV) { maxV = v; topId = p.id; } }
    // Le salon « reconnaît » l'origine si une majorité converge → +2 à tous.
    if (maxV > 0 && maxV * 2 > voterCount) {
      for (const p of state.players) scores[p.id] += 2;
    } else if (topId) {
      scores[topId] += 1; // sinon +1 au dernier « fidèle »
      bestCount[topId] = (bestCount[topId] ?? 0) + 1;
    }
    return { ...state, phase: "scoreboard", roundVotes, scores, votesReceivedTotal, bestCount, deadline: ctx.now + state.config.scoreboardMs };
  }

  // classic
  for (const p of state.players) {
    const v = roundVotes[p.id] ?? 0;
    // A réellement joué sa prise (enregistrement non vide) → points de participation.
    const performed = !!state.submitted[p.id] && !state.emptyTake[p.id];
    scores[p.id] = (scores[p.id] ?? 0) + (performed ? PARTICIPATION_POINTS : 0) + v * POINTS_PER_VOTE;
    votesReceivedTotal[p.id] = (votesReceivedTotal[p.id] ?? 0) + v;
  }
  let maxV = 0;
  for (const p of state.players) maxV = Math.max(maxV, roundVotes[p.id] ?? 0);
  if (maxV > 0) {
    for (const p of state.players) {
      if ((roundVotes[p.id] ?? 0) === maxV) { scores[p.id] += BEST_BONUS; bestCount[p.id] = (bestCount[p.id] ?? 0) + 1; }
    }
  }
  return { ...state, phase: "scoreboard", roundVotes, scores, votesReceivedTotal, bestCount, deadline: ctx.now + state.config.scoreboardMs };
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

  const mode = state.config.mode;
  const chainRecorderId = mode === "chain" ? state.chainOrder[state.chainPos] ?? null : null;
  const chainHearsId = mode === "chain" && state.chainPos > 0 ? state.chainOrder[state.chainPos - 1] ?? null : null;
  return {
    phase: state.phase,
    mode,
    players: state.players,
    round: state.round,
    totalRounds: state.config.totalRounds,
    sound: getMimicSound(state.soundId),
    activeIds: state.activeIds,
    youActive: state.activeIds.includes(viewerId),
    duelChampionId: state.duelChampion,
    duelNo: mode === "duel" ? state.duelIndex + 1 : 0,
    duelTotal: mode === "duel" ? state.duelPairs.length : 0,
    chainRecorderId,
    chainHearsId,
    chainPos: state.chainPos,
    chainLen: state.chainOrder.length,
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
