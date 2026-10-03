// Moteur pur du « Top ».
// Manche : classement (chrono, modifiable jusqu'au bout) → révélation.
//
// Barème par élément, selon l'écart entre ta place et la bonne place :
//   0 → +100 · 1 → +50 · 2 → +20 · au-delà → 0 ; ordre parfait : +100 de bonus.
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { latePlayers, withZeros, zeroScores } from "../../platform/presence";
import { clampInt, shuffle } from "../../platform/util";
import { SAVOIR_PROMPTS, TABLE_PROMPTS } from "./prompts";
import type { RankingClientAction, RankingConfig, RankingMode, RankingPublic, RankingSettings, RankingState } from "./types";

export const RANKING_REVEAL_MS = 12_000;
export const RANKING_POINTS = [100, 50, 20];
export const RANKING_PERFECT_BONUS = 100;

export function resolveRankingConfig(s: RankingSettings | undefined): RankingConfig {
  const mode: RankingMode = s?.mode === "table" ? "table" : "savoir";
  return { totalRounds: clampInt(s?.totalRounds, 2, 10, 5), seconds: clampInt(s?.seconds, 20, 120, 45), mode };
}

/** Points d'un classement par rapport à l'ordre attendu. */
export function scoreOrder(order: number[], expected: number[]): number {
  let pts = 0;
  let perfect = true;
  expected.forEach((item, pos) => {
    const p = order.indexOf(item);
    const d = p < 0 ? Infinity : Math.abs(p - pos);
    if (d !== 0) perfect = false;
    pts += RANKING_POINTS[d] ?? 0;
  });
  return pts + (perfect ? RANKING_PERFECT_BONUS : 0);
}

/**
 * Classement « de la table » : éléments triés par place moyenne. Les
 * égalités se départagent par l'ordre d'origine (stable et déterministe).
 */
export function consensusOrder(orders: number[][], n: number): number[] {
  const sum = new Array(n).fill(0);
  for (const o of orders) o.forEach((item, pos) => (sum[item] += pos));
  return Array.from({ length: n }, (_, i) => i).sort((a, b) => sum[a] - sum[b] || a - b);
}

/** Un classement valide est une permutation des indices 0..n-1. */
export function isValidOrder(order: unknown, n: number): order is number[] {
  if (!Array.isArray(order) || order.length !== n) return false;
  const seen = new Set<number>();
  for (const v of order) {
    if (!Number.isInteger(v) || v < 0 || v >= n || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}


export function createRanking(players: GamePlayer[], settings: RankingSettings, ctx: GameContext): RankingState {
  const config = resolveRankingConfig(settings);
  const bank = config.mode === "table" ? TABLE_PROMPTS : SAVOIR_PROMPTS;
  const prompts = shuffle(bank, ctx.rng).slice(0, config.totalRounds);
  const base: RankingState = {
    phase: "order",
    players,
    connectedIds: players.map((p) => p.id),
    config: { ...config, totalRounds: prompts.length },
    prompts,
    index: 0,
    shuffled: [],
    orders: {},
    expected: null,
    deadline: null,
    phaseMs: 0,
    scores: zeroScores(players),
    gained: {},
    perfects: zeroScores(players),
  };
  return startRound(base, 0, ctx);
}

function startRound(s: RankingState, index: number, ctx: GameContext): RankingState {
  const n = s.prompts[index]?.items.length ?? 0;
  let shuffled = shuffle(Array.from({ length: n }, (_, i) => i), ctx.rng);
  // Jamais déjà dans le bon ordre au départ (mode savoir).
  if (s.config.mode === "savoir" && shuffled.every((v, i) => v === i)) shuffled = [...shuffled.slice(1), shuffled[0]];
  const ms = s.config.seconds * 1000;
  return { ...s, phase: "order", index, shuffled, orders: {}, expected: null, gained: {}, deadline: ctx.now + ms, phaseMs: ms };
}

function reveal(s: RankingState, ctx: GameContext): RankingState {
  const prompt = s.prompts[s.index];
  const n = prompt.items.length;
  const submitted = Object.values(s.orders);
  const expected = s.config.mode === "table" ? consensusOrder(submitted, n) : Array.from({ length: n }, (_, i) => i);
  const gained: Record<PlayerId, number> = {};
  const perfects = { ...s.perfects };
  // En mode table, il faut au moins deux avis pour qu'un « consensus » ait un sens.
  const scorable = s.config.mode === "savoir" || submitted.length >= 2;
  if (scorable) {
    for (const [id, order] of Object.entries(s.orders)) {
      const pts = scoreOrder(order, expected);
      gained[id] = pts;
      if (order.every((v, i) => v === expected[i])) perfects[id] = (perfects[id] ?? 0) + 1;
    }
  }
  const scores = { ...s.scores };
  for (const [id, v] of Object.entries(gained)) scores[id] = (scores[id] ?? 0) + v;
  return { ...s, phase: "reveal", expected, gained, scores, perfects, deadline: ctx.now + RANKING_REVEAL_MS, phaseMs: RANKING_REVEAL_MS };
}

const expectedPlayers = (s: RankingState) => s.players.map((p) => p.id).filter((id) => s.connectedIds.includes(id));

export function reduceRanking(s: RankingState, action: GameAction<RankingClientAction>, ctx: GameContext): GameReduceResult<RankingState> {
  switch (action.type) {
    case "presence": {
      const added = latePlayers(s.players, action.players);
      let next: RankingState = { ...s, connectedIds: action.connectedIds };
      if (added.length) next = { ...next, players: [...s.players, ...added], scores: withZeros(s.scores, added), perfects: withZeros(s.perfects, added) };
      if (next.phase === "order") {
        const need = expectedPlayers(next);
        if (need.length && need.every((id) => next.orders[id])) return { state: reveal(next, ctx) };
      }
      return { state: next };
    }
    case "advance": {
      if (s.phase === "order") return { state: reveal(s, ctx) };
      if (s.phase === "reveal") {
        const index = s.index + 1;
        if (index >= s.prompts.length) return { state: { ...s, phase: "final", deadline: null, phaseMs: 0 } };
        return { state: startRound(s, index, ctx) };
      }
      return { state: s };
    }
    case "client": {
      const { playerId, msg } = action;
      if (msg?.kind !== "order" || s.phase !== "order" || !s.players.some((p) => p.id === playerId)) return { state: s };
      const n = s.prompts[s.index].items.length;
      if (!isValidOrder(msg.order, n)) return { state: s, error: { code: "bad_order", message: "Classement invalide." } };
      // Le client parle en positions « affichées » (mélangées) : on traduit.
      const internal = msg.order.map((k) => s.shuffled[k]);
      const next = { ...s, orders: { ...s.orders, [playerId]: internal } };
      // Tout le monde a validé : révélation (on peut renvoyer tant qu'un joueur réfléchit).
      const need = expectedPlayers(next);
      if (need.length && need.every((id) => next.orders[id])) return { state: reveal(next, ctx) };
      return { state: next };
    }
  }
  return { state: s };
}

export function projectRanking(s: RankingState, viewerId: PlayerId): RankingPublic {
  const prompt = s.prompts[s.index];
  const revealed = s.phase === "reveal";
  const final = s.phase === "final";
  // L'ordre interne des éléments EST la bonne réponse : on ne l'expose jamais.
  // Le client reçoit les éléments mélangés et raisonne en positions affichées.
  const toPublic = (internal: number[]) => internal.map((i) => s.shuffled.indexOf(i));
  const items = s.shuffled.map((i) => {
    const it = prompt?.items[i];
    return it ? (revealed ? it : { label: it.label }) : { label: "" };
  });
  return {
    phase: s.phase,
    mode: s.config.mode,
    players: s.players,
    round: Math.min(s.index + 1, s.prompts.length),
    totalRounds: s.prompts.length,
    title: prompt?.title ?? "",
    top: prompt?.top ?? "",
    bottom: prompt?.bottom ?? "",
    items,
    shuffled: items.map((_, k) => k),
    yourOrder: s.orders[viewerId] ? toPublic(s.orders[viewerId]) : null,
    submittedIds: Object.keys(s.orders),
    deadline: s.deadline,
    phaseMs: s.phaseMs,
    scores: s.scores,
    expected: revealed && s.expected ? toPublic(s.expected) : null,
    orders: revealed ? Object.fromEntries(Object.entries(s.orders).map(([id, o]) => [id, toPublic(o)])) : null,
    gained: revealed ? s.gained : null,
    perfects: final ? s.perfects : null,
  };
}
