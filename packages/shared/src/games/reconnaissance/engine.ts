// Reconnaissance — pure engine. Server-authoritative loop:
// image+question → answers → reveal → score (accuracy + speed) → ranking → next → final.
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { pickItems, recoAccepts, recoCategories, type RecoItem } from "./bank";
import type { PublicRecoItem, RecoClientAction, RecoMode, RecoPublic, RecoRankRow, RecoSettings, RecoState } from "./types";

const REVEAL_MS = 4500;
const BASE_POINTS = 500;
const SPEED_POINTS = 500;
const COOP_PENALTY_MS = 3000; // mode coop : une erreur retire 3 s au chrono global

const ok = (s: RecoState): GameReduceResult<RecoState> => ({ state: s });
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
function rec0(players: GamePlayer[]) { const r: Record<PlayerId, number> = {}; for (const p of players) r[p.id] = 0; return r; }

const RECO_MODES: RecoMode[] = ["classic", "zoom", "theme", "rush", "coop"];
export function resolveRecoMode(mode: string | undefined): RecoMode {
  return RECO_MODES.includes(mode as RecoMode) ? (mode as RecoMode) : "classic";
}

export function createReco(players: GamePlayer[], settings: RecoSettings, ctx: GameContext): RecoState {
  const total = clamp(settings.totalQuestions ?? 10, 3, 20);
  const mode = resolveRecoMode(settings.mode);
  // Rush : révélation deux fois plus rapide → durée effective = temps / 2.
  const rawSecs = clamp(settings.secondsPerQuestion ?? 15, 5, 90);
  const secs = mode === "rush" ? Math.max(5, Math.round(rawSecs / 2)) : rawSecs;
  // Thème imposé : si l'hôte laisse « toutes », on tire une catégorie au sort
  // et on s'y tient toute la partie.
  let category = settings.category ?? "all";
  if (mode === "theme" && (category === "all" || !category)) {
    const cats = recoCategories();
    if (cats.length) category = cats[Math.floor(ctx.rng() * cats.length)];
  }
  const items = pickItems(total, ctx.rng, category);
  // Coop : un seul chrono GLOBAL = manches × temps par image ; on enchaîne les
  // images sans écran de révélation. `deadline` porte le chrono global,
  // `revealAt` la fin de révélation (pixel) de l'image courante.
  const isCoop = mode === "coop";
  const globalMs = items.length * secs * 1000;
  return {
    phase: "question", players, connectedIds: players.map((p) => p.id),
    config: { totalQuestions: items.length, secondsPerQuestion: secs, category, mode },
    items, index: 0, startedAt: ctx.now,
    deadline: ctx.now + (isCoop ? globalMs : secs * 1000),
    answers: {}, scores: rec0(players), gained: rec0(players), correct: {},
    streak: rec0(players), bestStreak: rec0(players), fastMs: {}, goodCount: rec0(players),
    coopScore: 0,
    revealAt: isCoop ? ctx.now + secs * 1000 : null,
    lastFoundBy: null,
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
      if (state.config.mode === "coop") return ok(coopGuess(state, playerId, String(msg.value), ctx));
      if (state.answers[playerId]) return ok(state);
      if (state.deadline != null && ctx.now > state.deadline) return ok(state);
      const answers = { ...state.answers, [playerId]: { value: String(msg.value), at: ctx.now } };
      let next: RecoState = { ...state, answers };
      const connected = state.connectedIds.filter((id) => state.players.some((p) => p.id === id));
      if (connected.length > 0 && connected.every((id) => answers[id])) next = reveal(next, ctx);
      return ok(next);
    }
    case "advance": {
      // Coop : un seul chrono global ; quand il expire → fin de partie.
      if (state.config.mode === "coop") {
        if (state.phase === "question" && state.deadline != null && ctx.now >= state.deadline)
          return ok({ ...state, phase: "final", deadline: null, revealAt: null });
        return ok(state);
      }
      if (state.phase === "question" && state.deadline != null && ctx.now >= state.deadline) return ok(reveal(state, ctx));
      if (state.phase === "reveal" && state.deadline != null && ctx.now >= state.deadline) return ok(nextItem(state, ctx));
      return ok(state);
    }
  }
}

/** Mode coop : une proposition. Bonne → +1 collectif et image suivante ;
 *  mauvaise → −3 s au chrono global partagé. Pas de verrou par joueur. */
function coopGuess(state: RecoState, playerId: PlayerId, value: string, ctx: GameContext): RecoState {
  if (state.deadline != null && ctx.now >= state.deadline) return { ...state, phase: "final", deadline: null, revealAt: null };
  const item = current(state);
  const good = !!item && recoAccepts(value, item);
  if (!good) {
    // Erreur : le chrono commun perd 3 s (jamais en dessous de « maintenant »).
    const nd = Math.max(ctx.now, (state.deadline ?? ctx.now) - COOP_PENALTY_MS);
    return { ...state, deadline: nd, lastFoundBy: null };
  }
  const coopScore = state.coopScore + 1;
  const scores = { ...state.scores, [playerId]: (state.scores[playerId] ?? 0) + 1 };
  const goodCount = { ...state.goodCount, [playerId]: (state.goodCount[playerId] ?? 0) + 1 };
  const ni = state.index + 1;
  // Plus d'images → on s'arrête même s'il reste du temps.
  if (ni >= state.items.length) {
    return { ...state, coopScore, scores, goodCount, lastFoundBy: playerId, phase: "final", deadline: null, revealAt: null };
  }
  return {
    ...state, coopScore, scores, goodCount, lastFoundBy: playerId,
    index: ni, startedAt: ctx.now, revealAt: ctx.now + state.config.secondsPerQuestion * 1000,
    answers: {}, gained: rec0(state.players), correct: {},
  };
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
      // Zoom : points = 1 + floor(zoom restant × 4), plafond 4 (le zoom restant
      // suit le temps restant). Rush : points classiques ×2. Sinon : classique.
      const pts =
        state.config.mode === "zoom"
          ? Math.min(4, 1 + Math.floor(frac * 4))
          : state.config.mode === "rush"
            ? 2 * Math.round(BASE_POINTS + SPEED_POINTS * frac)
            : Math.round(BASE_POINTS + SPEED_POINTS * frac);
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
    phase: state.phase, players: state.players, mode: state.config.mode, index: state.index, total: state.items.length,
    item: state.phase === "final" ? null : publicItem(item),
    deadline: state.deadline, secondsPerQuestion: state.config.secondsPerQuestion,
    answeredIds: Object.keys(state.answers), yourAnswer: your ? your.value : null, ranking,
    correctText: revealing && item ? item.answer : null,
    yourCorrect: revealing ? !!state.correct[viewerId] : null,
    yourGained: revealing ? state.gained[viewerId] ?? 0 : null,
    nextWiki: next ? next.wiki : null,
    nextWikiEn: next ? next.wikiEn ?? null : null,
    stats,
    coopScore: state.config.mode === "coop" ? state.coopScore : null,
    revealDeadline: state.config.mode === "coop" ? state.revealAt : state.deadline,
    lastFoundBy: state.lastFoundBy,
  };
}
