// Moteur pur de « Ni oui ni non ».
// Tour : prêt → chrono (questions) → [accusation → vote éclair] → résultat.
// Chaque joueur est la cible une fois par tour de table.
//
// Barème :
//   • cible : +5 par seconde tenue, +100 si elle tient jusqu'au bout
//   • piégeur (celui qui l'a fait craquer) : +150
//   • fausse accusation rejetée au vote : −50 pour l'accusateur
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { latePlayers, withZeros } from "../../platform/presence";
import { normalizeWord } from "../../platform/text";
import { clampInt, shuffle } from "../../platform/util";
import type { YesNoClientAction, YesNoConfig, YesNoMessage, YesNoMode, YesNoOutcome, YesNoPublic, YesNoSettings, YesNoState } from "./types";

export const YESNO_READY_MS = 6_000;
export const YESNO_VERDICT_MS = 10_000;
export const YESNO_RESULT_MS = 7_000;
export const YESNO_POINTS_PER_SEC = 5;
export const YESNO_SURVIVE_BONUS = 100;
export const YESNO_CATCH_POINTS = 150;
export const YESNO_FALSE_ACCUSE = 50;
export const YESNO_MSG_MAX = 100;
const LOG_MAX = 60;

/** Mots qui font perdre (après normalisation). */
const FATAL = new Set(["oui", "non", "ouais", "ouai", "ouaip", "ouep", "ouip", "nan", "nope", "nop", "yes", "no", "yep", "nein"]);

/** Le mot fatal contenu dans un message, s'il y en a un. */
export function findYesNo(text: string): string | null {
  for (const tok of normalizeWord(text).split(" ")) {
    // « ouiii », « nooon » : on écrase les lettres répétées.
    const t = tok.replace(/(.)\1+/g, "$1");
    if (FATAL.has(tok) || FATAL.has(t)) return tok;
  }
  return null;
}

export function resolveYesNoConfig(s: YesNoSettings | undefined): YesNoConfig {
  const mode: YesNoMode = s?.mode === "chat" ? "chat" : "voix";
  return { totalRounds: clampInt(s?.totalRounds, 1, 3, 1), seconds: clampInt(s?.seconds, 20, 120, 45), mode };
}

const zeros = (players: GamePlayer[]) => Object.fromEntries(players.map((p) => [p.id, 0]));
export const totalTurnsYN = (s: Pick<YesNoState, "order" | "config">) => s.order.length * s.config.totalRounds;
export const targetOf = (s: Pick<YesNoState, "order" | "turn">): PlayerId | null => (s.order.length ? s.order[s.turn % s.order.length] : null);
const isOn = (s: YesNoState, id: PlayerId | null) => !!id && s.connectedIds.includes(id);

export function createYesNo(players: GamePlayer[], settings: YesNoSettings, ctx: GameContext): YesNoState {
  const config = resolveYesNoConfig(settings);
  const base: YesNoState = {
    phase: "ready",
    players,
    connectedIds: players.map((p) => p.id),
    config,
    order: shuffle(players.map((p) => p.id), ctx.rng),
    turn: 0,
    deadline: null,
    phaseMs: 0,
    remainingMs: config.seconds * 1000,
    hotSince: null,
    accuserId: null,
    votes: {},
    log: [],
    nextMsgId: 1,
    result: null,
    scores: zeros(players),
    catches: zeros(players),
    survivals: zeros(players),
  };
  return startReady(base, 0, ctx);
}

function startReady(s: YesNoState, turn: number, ctx: GameContext): YesNoState {
  let t = turn;
  const total = totalTurnsYN(s);
  while (t < total && !isOn(s, targetOf({ ...s, turn: t }))) t++;
  if (t >= total) return { ...s, phase: "final", deadline: null, phaseMs: 0, turn: Math.max(0, Math.min(t, total - 1)) };
  return {
    ...s,
    phase: "ready",
    turn: t,
    remainingMs: s.config.seconds * 1000,
    hotSince: null,
    accuserId: null,
    votes: {},
    log: [],
    result: null,
    deadline: ctx.now + YESNO_READY_MS,
    phaseMs: YESNO_READY_MS,
  };
}

function goHot(s: YesNoState, ctx: GameContext): YesNoState {
  return { ...s, phase: "hot", accuserId: null, votes: {}, hotSince: ctx.now, deadline: ctx.now + s.remainingMs, phaseMs: s.config.seconds * 1000 };
}

/** Temps tenu par la cible jusqu'à maintenant. */
function survived(s: YesNoState, now: number): number {
  const used = s.config.seconds * 1000 - s.remainingMs;
  return Math.max(0, Math.min(s.config.seconds * 1000, used + (s.phase === "hot" && s.hotSince != null ? now - s.hotSince : 0)));
}

function finish(s: YesNoState, outcome: YesNoOutcome, ctx: GameContext, catcherId: PlayerId | null, word: string | null, survivedMs: number): YesNoState {
  const target = targetOf(s)!;
  const gained: Record<PlayerId, number> = {};
  const add = (id: PlayerId, v: number) => (gained[id] = (gained[id] ?? 0) + v);
  add(target, Math.floor(survivedMs / 1000) * YESNO_POINTS_PER_SEC + (outcome === "survived" ? YESNO_SURVIVE_BONUS : 0));
  if (outcome === "caught" && catcherId && catcherId !== target) add(catcherId, YESNO_CATCH_POINTS);
  const scores = { ...s.scores };
  for (const [id, v] of Object.entries(gained)) scores[id] = (scores[id] ?? 0) + v;
  return {
    ...s,
    phase: "result",
    scores,
    catches: outcome === "caught" && catcherId ? { ...s.catches, [catcherId]: (s.catches[catcherId] ?? 0) + 1 } : s.catches,
    survivals: outcome === "survived" ? { ...s.survivals, [target]: (s.survivals[target] ?? 0) + 1 } : s.survivals,
    result: { targetId: target, outcome, catcherId: outcome === "caught" ? catcherId : null, word, survivedMs, gained },
    hotSince: null,
    deadline: ctx.now + YESNO_RESULT_MS,
    phaseMs: YESNO_RESULT_MS,
  };
}

/** Votants du vote éclair : ni la cible, ni l'accusateur, présents. */
function verdictVoters(s: YesNoState): PlayerId[] {
  const target = targetOf(s);
  return s.order.filter((id) => id !== target && id !== s.accuserId && isOn(s, id));
}

function resolveVerdict(s: YesNoState, ctx: GameContext): YesNoState {
  const yes = Object.values(s.votes).filter(Boolean).length;
  const no = Object.values(s.votes).length - yes;
  // Personne pour voter : on croit l'accusateur. Égalité : le doute profite à la cible.
  const accepted = verdictVoters(s).length === 0 ? true : yes > no;
  if (accepted) return finish(s, "caught", ctx, s.accuserId, null, survived(s, ctx.now));
  const accuser = s.accuserId!;
  const back = { ...s, scores: { ...s.scores, [accuser]: (s.scores[accuser] ?? 0) - YESNO_FALSE_ACCUSE } };
  return goHot({ ...back, log: pushLog(back, { from: "", text: `Fausse alerte ! −${YESNO_FALSE_ACCUSE} pour ${nameOf(s, accuser)}.` }), nextMsgId: back.nextMsgId + 1 }, ctx);
}

const nameOf = (s: YesNoState, id: PlayerId) => s.players.find((p) => p.id === id)?.name ?? "?";

function pushLog(s: YesNoState, m: Omit<YesNoMessage, "id">): YesNoMessage[] {
  const log = [...s.log, { id: s.nextMsgId, ...m }];
  return log.length > LOG_MAX ? log.slice(log.length - LOG_MAX) : log;
}

export function reduceYesNo(s: YesNoState, action: GameAction<YesNoClientAction>, ctx: GameContext): GameReduceResult<YesNoState> {
  switch (action.type) {
    case "presence": {
      const added = latePlayers(s.players, action.players);
      let next: YesNoState = { ...s, connectedIds: action.connectedIds };
      if (added.length) {
        next = {
          ...next,
          players: [...s.players, ...added],
          order: s.phase === "final" ? s.order : [...s.order, ...added.map((p) => p.id)],
          scores: withZeros(s.scores, added),
          catches: withZeros(s.catches, added),
          survivals: withZeros(s.survivals, added),
        };
      }
      const live = next.phase === "ready" || next.phase === "hot" || next.phase === "verdict";
      if (live && !isOn(next, targetOf(next))) return { state: startReady(next, next.turn + 1, ctx) };
      if (next.phase === "verdict") {
        const voters = verdictVoters(next);
        if (voters.every((id) => next.votes[id] != null)) return { state: resolveVerdict(next, ctx) };
      }
      return { state: next };
    }
    case "advance": {
      switch (s.phase) {
        case "ready":
          return { state: goHot(s, ctx) };
        case "hot":
          return { state: finish(s, "survived", ctx, null, null, s.config.seconds * 1000) };
        case "verdict":
          return { state: resolveVerdict(s, ctx) };
        case "result":
          return { state: startReady(s, s.turn + 1, ctx) };
      }
      return { state: s };
    }
    case "client": {
      const { playerId, msg } = action;
      const target = targetOf(s);
      if (!s.players.some((p) => p.id === playerId)) return { state: s };
      switch (msg?.kind) {
        case "accuse": {
          if (s.phase !== "hot" || s.config.mode !== "voix" || playerId === target) return { state: s };
          const remainingMs = Math.max(0, (s.deadline ?? ctx.now) - ctx.now);
          const next: YesNoState = { ...s, phase: "verdict", accuserId: playerId, votes: {}, remainingMs, deadline: ctx.now + YESNO_VERDICT_MS, phaseMs: YESNO_VERDICT_MS };
          // Survie mesurée jusqu'à l'accusation (le chrono est gelé pendant le vote).
          const frozen = { ...next, hotSince: null };
          return { state: verdictVoters(frozen).length === 0 ? resolveVerdict(frozen, ctx) : frozen };
        }
        case "verdict": {
          if (s.phase !== "verdict" || !verdictVoters(s).includes(playerId) || s.votes[playerId] != null) return { state: s };
          const next = { ...s, votes: { ...s.votes, [playerId]: !!msg.said } };
          if (verdictVoters(next).every((id) => next.votes[id] != null)) return { state: resolveVerdict(next, ctx) };
          return { state: next };
        }
        case "say": {
          if (s.phase !== "hot" || s.config.mode !== "chat") return { state: s };
          const text = String(msg.text ?? "").replace(/\s+/g, " ").trim().slice(0, YESNO_MSG_MAX);
          if (!text) return { state: s };
          if (playerId === target) {
            const word = findYesNo(text);
            if (word) {
              // Le piégeur : l'auteur de la dernière question posée.
              const catcher = [...s.log].reverse().find((m) => m.from && m.from !== target)?.from ?? null;
              const logged = { ...s, log: pushLog(s, { from: playerId, text, fatal: true }), nextMsgId: s.nextMsgId + 1 };
              return { state: finish(logged, "caught", ctx, catcher, word, survived(s, ctx.now)) };
            }
          }
          return { state: { ...s, log: pushLog(s, { from: playerId, text }), nextMsgId: s.nextMsgId + 1 } };
        }
      }
      return { state: s };
    }
  }
  return { state: s };
}

export function projectYesNo(s: YesNoState, viewerId: PlayerId): YesNoPublic {
  const final = s.phase === "final";
  return {
    phase: s.phase,
    mode: s.config.mode,
    players: s.players,
    order: s.order,
    turn: Math.min(s.turn + 1, totalTurnsYN(s)),
    totalTurns: totalTurnsYN(s),
    targetId: final ? null : targetOf(s),
    deadline: s.deadline,
    phaseMs: s.phaseMs,
    remainingMs: s.remainingMs,
    seconds: s.config.seconds,
    accuserId: s.accuserId,
    votedIds: Object.keys(s.votes),
    yourVote: s.votes[viewerId] ?? null,
    log: s.phase === "hot" || s.phase === "verdict" || s.phase === "result" ? s.log : [],
    result: s.phase === "result" ? s.result : null,
    scores: s.scores,
    catches: final ? s.catches : null,
    survivals: final ? s.survivals : null,
  };
}
