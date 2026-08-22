// Reconnaissance — pure engine. Server-authoritative loop:
// image+question → answers → reveal → score (accuracy + speed) → ranking → next → final.
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { pickItems, recoAccepts, type RecoItem } from "./bank";
import type { PublicRecoItem, RecoClientAction, RecoPublic, RecoRankRow, RecoSettings, RecoState } from "./types";

const REVEAL_MS = 4500;
const BASE_POINTS = 500;
const SPEED_POINTS = 500;

const ok = (s: RecoState): GameReduceResult<RecoState> => ({ state: s });
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
function rec0(players: GamePlayer[]) { const r: Record<PlayerId, number> = {}; for (const p of players) r[p.id] = 0; return r; }

export function createReco(players: GamePlayer[], settings: RecoSettings, ctx: GameContext): RecoState {
  const total = clamp(settings.totalQuestions ?? 10, 3, 20);
  const secs = clamp(settings.secondsPerQuestion ?? 15, 5, 60);
  const items = pickItems(total, ctx.rng, settings.category);
  return {
    phase: "question", players, connectedIds: players.map((p) => p.id),
    config: { totalQuestions: items.length, secondsPerQuestion: secs, category: settings.category ?? "all" },
    items, index: 0, startedAt: ctx.now, deadline: ctx.now + secs * 1000,
    answers: {}, scores: rec0(players), gained: rec0(players), correct: {},
    streak: rec0(players), bestStreak: rec0(players), fastMs: {}, goodCount: rec0(players),
  };
}

const current = (s: RecoState): RecoItem | null => s.items[s.index] ?? null;

export function reduceReco(state: RecoState, action: GameAction<RecoClientAction>, ctx: GameContext): GameReduceResult<RecoState> {
  switch (action.type) {
    case "presence":
      return ok({ ...state, connectedIds: action.connectedIds });
    case "client": {
      const { playerId, msg } = action;
      if (msg.kind !== "answer") return ok(state);
      if (state.phase !== "question") return ok(state);
      if (!state.players.some((p) => p.id === playerId)) return ok(state);
      if (state.answers[playerId]) return ok(state);
      if (state.deadline != null && ctx.now > state.deadline) return ok(state);
      const answers = { ...state.answers, [playerId]: { value: String(msg.value), at: ctx.now } };
      let next: RecoState = { ...state, answers };
      const connected = state.connectedIds.filter((id) => state.players.some((p) => p.id === id));
      if (connected.length > 0 && connected.every((id) => answers[id])) next = reveal(next, ctx);
      return ok(next);
    }
    case "advance": {
      if (state.phase === "question" && state.deadline != null && ctx.now >= state.deadline) return ok(reveal(state, ctx));
      if (state.phase === "reveal" && state.deadline != null && ctx.now >= state.deadline) return ok(nextItem(state, ctx));
      return ok(state);
    }
  }
}

function reveal(state: RecoState, ctx: GameContext): RecoState {
  const item = current(state);
  const gained: Record<PlayerId, number> = {}, correct: Record<PlayerId, boolean> = {};
  const scores = { ...state.scores }, streak = { ...state.streak }, bestStreak = { ...state.bestStreak };
  const fastMs = { ...state.fastMs }, goodCount = { ...state.goodCount };
  const total = state.config.secondsPerQuestion * 1000;
  for (const p of state.players) {
    const a = state.answers[p.id];
    const good = !!a && !!item && recoAccepts(a.value, item);
    correct[p.id] = good;
    if (good && a) {
      const timeLeft = Math.max(0, (state.deadline ?? ctx.now) - a.at);
      const frac = total > 0 ? Math.max(0, Math.min(1, timeLeft / total)) : 0;
      const pts = Math.round(BASE_POINTS + SPEED_POINTS * frac);
      gained[p.id] = pts;
      scores[p.id] = (scores[p.id] ?? 0) + pts;
      streak[p.id] = (streak[p.id] ?? 0) + 1;
      bestStreak[p.id] = Math.max(bestStreak[p.id] ?? 0, streak[p.id]);
      goodCount[p.id] = (goodCount[p.id] ?? 0) + 1;
      fastMs[p.id] = Math.min(fastMs[p.id] ?? Infinity, total - timeLeft);
    } else { gained[p.id] = 0; streak[p.id] = 0; }
  }
  return { ...state, phase: "reveal", gained, correct, scores, streak, bestStreak, fastMs, goodCount, deadline: ctx.now + REVEAL_MS };
}

function nextItem(state: RecoState, ctx: GameContext): RecoState {
  const ni = state.index + 1;
  if (ni >= state.items.length) return { ...state, phase: "final", deadline: null };
  return { ...state, phase: "question", index: ni, startedAt: ctx.now, deadline: ctx.now + state.config.secondsPerQuestion * 1000, answers: {}, gained: rec0(state.players), correct: {} };
}

const publicItem = (it: RecoItem | null): PublicRecoItem | null => it ? { id: it.id, wiki: it.wiki, wikiEn: it.wikiEn, question: it.question, category: it.category, img: it.img } : null;

function bestBy(state: RecoState, metric: (id: PlayerId) => number): string | null {
  let best: { id: PlayerId; v: number } | null = null;
  for (const p of state.players) { const v = metric(p.id); if (!isFinite(v)) continue; if (!best || v > best.v) best = { id: p.id, v }; }
  if (!best || best.v === 0) return null;
  return state.players.find((p) => p.id === best!.id)?.name ?? null;
}

export function projectReco(state: RecoState, viewerId: PlayerId): RecoPublic {
  const item = current(state);
  const revealing = state.phase === "reveal";
  const next = revealing ? state.items[state.index + 1] : null;
  const your = state.answers[viewerId];
  const ranking: RecoRankRow[] = [...state.players]
    .map((p) => ({ id: p.id, name: p.name, color: p.color, avatar: p.avatar, score: state.scores[p.id] ?? 0, gained: state.gained[p.id] ?? 0, correct: !!state.correct[p.id], answered: !!state.answers[p.id] }))
    .sort((a, b) => b.score - a.score);
  const stats = state.phase === "final" ? {
    fastest: bestBy(state, (id) => -(state.fastMs[id] ?? Infinity)),
    brain: bestBy(state, (id) => state.goodCount[id] ?? 0),
    streak: bestBy(state, (id) => state.bestStreak[id] ?? 0),
  } : null;
  return {
    phase: state.phase, players: state.players, index: state.index, total: state.items.length,
    item: state.phase === "final" ? null : publicItem(item),
    deadline: state.deadline, secondsPerQuestion: state.config.secondsPerQuestion,
    answeredIds: Object.keys(state.answers), yourAnswer: your ? your.value : null, ranking,
    correctText: revealing && item ? item.answer : null,
    yourCorrect: revealing ? !!state.correct[viewerId] : null,
    yourGained: revealing ? state.gained[viewerId] ?? 0 : null,
    nextWiki: next ? next.wiki : null,
    nextWikiEn: next ? next.wikiEn ?? null : null,
    stats,
  };
}
