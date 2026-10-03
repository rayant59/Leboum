// Moteur pur du « Mot interdit ».
// Passage : prêt (le donneur lance) → chrono : cartes à la chaîne → récap.
// Chaque joueur fait deviner une fois par tour de table.
//
// Barème :
//   • carte trouvée ............ +100 pour celui qui fait deviner, +100 pour celui qui trouve
//   • mot interdit utilisé ..... −50 pour celui qui fait deviner, la carte est perdue
//   • carte passée ............. 0 (on enchaîne)
import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { latePlayers, withZeros, zeroScores } from "../../platform/presence";
import { findForbidden, isWordGuess } from "../../platform/text";
import { clampInt, shuffle } from "../../platform/util";
import { tabooBank } from "./cards";
import type {
  TabooClientAction,
  TabooConfig,
  TabooMessage,
  TabooMode,
  TabooOutcome,
  TabooPublic,
  TabooSettings,
  TabooState,
} from "./types";

export const TABOO_READY_MS = 12_000;
export const TABOO_RECAP_MS = 8_000;
export const TABOO_FOUND_POINTS = 100;
export const TABOO_SLIP_PENALTY = 50;
export const TABOO_MSG_MAX = 80;
/** Garde-fou : on ne garde que les derniers messages du fil. */
const LOG_MAX = 60;

export function resolveTabooConfig(s: TabooSettings | undefined): TabooConfig {
  const mode: TabooMode = s?.mode === "oral" ? "oral" : "ecrit";
  return {
    totalRounds: clampInt(s?.totalRounds, 1, 4, 1),
    turnSeconds: clampInt(s?.seconds, 30, 180, 60),
    mode,
  };
}


export function createTaboo(players: GamePlayer[], settings: TabooSettings, ctx: GameContext): TabooState {
  const config = resolveTabooConfig(settings);
  const base: TabooState = {
    phase: "ready",
    players,
    connectedIds: players.map((p) => p.id),
    config,
    order: shuffle(players.map((p) => p.id), ctx.rng),
    turn: 0,
    deck: shuffle(tabooBank(), ctx.rng),
    cursor: 0,
    current: null,
    played: [],
    log: [],
    nextMsgId: 1,
    deadline: null,
    phaseMs: 0,
    scores: zeroScores(players),
    gained: {},
    cardsGiven: zeroScores(players),
    cardsFound: zeroScores(players),
    slips: zeroScores(players),
  };
  return startReady(base, 0, ctx);
}

export function totalTurns(s: Pick<TabooState, "order" | "config">): number {
  return s.order.length * s.config.totalRounds;
}

export function giverOf(s: Pick<TabooState, "order" | "turn">): PlayerId | null {
  return s.order.length ? s.order[s.turn % s.order.length] : null;
}

/** Censeur du mode oral : le prochain joueur présent après le donneur. */
export function censorOf(s: TabooState): PlayerId | null {
  if (s.config.mode !== "oral" || s.order.length < 3) return null;
  const n = s.order.length;
  const g = s.turn % n;
  for (let k = 1; k < n; k++) {
    const id = s.order[(g + k) % n];
    if (s.connectedIds.includes(id)) return id;
  }
  return null;
}

const isOn = (s: TabooState, id: PlayerId | null) => !!id && s.connectedIds.includes(id);

/** Prépare le passage `turn` ; saute les donneurs absents. */
function startReady(s: TabooState, turn: number, ctx: GameContext): TabooState {
  let t = turn;
  const total = totalTurns(s);
  while (t < total && !isOn(s, giverOf({ ...s, turn: t }))) t++;
  if (t >= total || !s.order.some((id) => isOn(s, id))) return { ...s, phase: "final", turn: Math.min(t, Math.max(0, total - 1)), current: null, deadline: null, phaseMs: 0 };
  return { ...s, phase: "ready", turn: t, current: null, played: [], log: [], gained: {}, deadline: ctx.now + TABOO_READY_MS, phaseMs: TABOO_READY_MS };
}

/** Tire la carte suivante (on remélange quand le paquet est épuisé). */
function draw(s: TabooState, ctx: GameContext): TabooState {
  let deck = s.deck;
  let cursor = s.cursor;
  if (cursor >= deck.length) {
    deck = shuffle(tabooBank(), ctx.rng);
    cursor = 0;
  }
  return { ...s, deck, cursor: cursor + 1, current: deck[cursor] ?? null };
}

function startTurn(s: TabooState, ctx: GameContext): TabooState {
  const ms = s.config.turnSeconds * 1000;
  return draw({ ...s, phase: "turn", played: [], log: [], gained: {}, deadline: ctx.now + ms, phaseMs: ms }, ctx);
}

function addPoints(s: TabooState, id: PlayerId, pts: number): Pick<TabooState, "scores" | "gained"> {
  return {
    scores: { ...s.scores, [id]: (s.scores[id] ?? 0) + pts },
    gained: { ...s.gained, [id]: (s.gained[id] ?? 0) + pts },
  };
}

function sys(s: TabooState, text: string, from: PlayerId = ""): TabooMessage[] {
  return trimLog([...s.log, { id: s.nextMsgId, from, kind: "system", text }]);
}

const trimLog = (log: TabooMessage[]) => (log.length > LOG_MAX ? log.slice(log.length - LOG_MAX) : log);

/** Clôt la carte en cours et en tire une nouvelle (le chrono continue). */
function closeCard(s: TabooState, outcome: TabooOutcome, ctx: GameContext, extra: { finderId?: PlayerId; culprit?: string } = {}): TabooState {
  if (!s.current) return s;
  const giver = giverOf(s)!;
  let next: TabooState = { ...s, played: [...s.played, { card: s.current, outcome, ...extra }] };
  if (outcome === "found" && extra.finderId) {
    next = { ...next, ...addPoints(next, giver, TABOO_FOUND_POINTS) };
    next = { ...next, ...addPoints(next, extra.finderId, TABOO_FOUND_POINTS) };
    next = {
      ...next,
      cardsGiven: { ...next.cardsGiven, [giver]: (next.cardsGiven[giver] ?? 0) + 1 },
      cardsFound: { ...next.cardsFound, [extra.finderId]: (next.cardsFound[extra.finderId] ?? 0) + 1 },
    };
  }
  if (outcome === "forbidden") {
    next = { ...next, ...addPoints(next, giver, -TABOO_SLIP_PENALTY), slips: { ...next.slips, [giver]: (next.slips[giver] ?? 0) + 1 } };
  }
  return draw(next, ctx);
}

function endTurn(s: TabooState, ctx: GameContext): TabooState {
  // La carte en cours n'est pas jouée : elle ne compte pas.
  return { ...s, phase: "recap", current: null, deadline: ctx.now + TABOO_RECAP_MS, phaseMs: TABOO_RECAP_MS };
}

export function reduceTaboo(s: TabooState, action: GameAction<TabooClientAction>, ctx: GameContext): GameReduceResult<TabooState> {
  switch (action.type) {
    case "presence": {
      const added = latePlayers(s.players, action.players);
      let next: TabooState = { ...s, connectedIds: action.connectedIds };
      if (added.length) {
        next = {
          ...next,
          players: [...s.players, ...added],
          // Les arrivants passeront à leur tour, en fin de tour de table.
          order: s.phase === "final" ? s.order : [...s.order, ...added.map((p) => p.id)],
          scores: withZeros(s.scores, added),
          cardsGiven: withZeros(s.cardsGiven, added),
          cardsFound: withZeros(s.cardsFound, added),
          slips: withZeros(s.slips, added),
        };
      }
      // Le donneur est parti : on passe au suivant.
      if ((next.phase === "ready" || next.phase === "turn") && !isOn(next, giverOf(next))) {
        return { state: next.phase === "turn" ? endTurn(next, ctx) : startReady(next, next.turn + 1, ctx) };
      }
      return { state: next };
    }
    case "advance": {
      if (s.phase === "ready") return { state: startTurn(s, ctx) };
      if (s.phase === "turn") return { state: endTurn(s, ctx) };
      if (s.phase === "recap") return { state: startReady(s, s.turn + 1, ctx) };
      return { state: s };
    }
    case "client": {
      const { playerId, msg } = action;
      const giver = giverOf(s);
      const isGiver = playerId === giver;
      switch (msg?.kind) {
        case "start":
          return { state: s.phase === "ready" && isGiver ? startTurn(s, ctx) : s };
        case "pass":
          return { state: s.phase === "turn" && isGiver ? closeCard(s, "passed", ctx) : s };
        case "clue": {
          if (s.phase !== "turn" || !isGiver || s.config.mode !== "ecrit" || !s.current) return { state: s };
          const text = String(msg.text ?? "").replace(/\s+/g, " ").trim().slice(0, TABOO_MSG_MAX);
          if (!text) return { state: s };
          const culprit = findForbidden(text, [s.current.word, ...s.current.forbidden]);
          if (culprit) {
            // L'indice n'est jamais diffusé : il trahirait le mot.
            const burnt = closeCard(s, "forbidden", ctx, { culprit });
            return {
              state: { ...burnt, log: sys(burnt, `Mot interdit (« ${culprit} ») ! Carte perdue, −${TABOO_SLIP_PENALTY}.`), nextMsgId: burnt.nextMsgId + 1 },
              error: { code: "forbidden_word", message: `« ${culprit} » est interdit ! Carte perdue.` },
            };
          }
          return { state: { ...s, log: trimLog([...s.log, { id: s.nextMsgId, from: playerId, kind: "clue", text }]), nextMsgId: s.nextMsgId + 1 } };
        }
        case "guess": {
          if (s.phase !== "turn" || isGiver || s.config.mode !== "ecrit" || !s.current) return { state: s };
          if (!s.players.some((p) => p.id === playerId)) return { state: s };
          const text = String(msg.text ?? "").replace(/\s+/g, " ").trim().slice(0, TABOO_MSG_MAX);
          if (!text) return { state: s };
          if (isWordGuess(text, s.current.word)) {
            const name = s.players.find((p) => p.id === playerId)?.name ?? "?";
            const word = s.current.word;
            const won = closeCard(s, "found", ctx, { finderId: playerId });
            return { state: { ...won, log: sys(won, `${name} a trouvé « ${word} » !`, playerId), nextMsgId: won.nextMsgId + 1 } };
          }
          return { state: { ...s, log: trimLog([...s.log, { id: s.nextMsgId, from: playerId, kind: "guess", text }]), nextMsgId: s.nextMsgId + 1 } };
        }
        case "found": {
          if (s.phase !== "turn" || !isGiver || s.config.mode !== "oral") return { state: s };
          if (msg.finderId === playerId || msg.finderId === censorOf(s) || !s.players.some((p) => p.id === msg.finderId)) return { state: s };
          return { state: closeCard(s, "found", ctx, { finderId: msg.finderId }) };
        }
        case "buzz": {
          if (s.phase !== "turn" || s.config.mode !== "oral" || playerId !== censorOf(s)) return { state: s };
          const name = s.players.find((p) => p.id === playerId)?.name ?? "?";
          const burnt = closeCard(s, "forbidden", ctx);
          return { state: { ...burnt, log: sys(burnt, `${name} a buzzé : mot interdit !`, playerId), nextMsgId: burnt.nextMsgId + 1 } };
        }
      }
      return { state: s };
    }
  }
  return { state: s };
}

export function projectTaboo(s: TabooState, viewerId: PlayerId): TabooPublic {
  const giver = s.phase === "final" ? null : giverOf(s);
  const censor = s.phase === "final" ? null : censorOf(s);
  const seesCard = s.phase === "turn" && (viewerId === giver || viewerId === censor);
  const showRecap = s.phase === "recap" || s.phase === "final";
  return {
    phase: s.phase,
    mode: s.config.mode,
    players: s.players,
    order: s.order,
    turn: Math.min(s.turn + 1, totalTurns(s)),
    totalTurns: totalTurns(s),
    giverId: giver,
    censorId: censor,
    card: seesCard ? s.current : null,
    playedCount: s.played.length,
    foundCount: s.played.filter((p) => p.outcome === "found").length,
    log: s.phase === "turn" || s.phase === "recap" ? s.log : [],
    deadline: s.deadline,
    phaseMs: s.phaseMs,
    scores: s.scores,
    recap: showRecap && s.phase !== "final" ? { giverId: giverOf(s)!, played: s.played, gained: s.gained } : null,
    cardsFound: s.phase === "final" ? s.cardsFound : null,
    cardsGiven: s.phase === "final" ? s.cardsGiven : null,
  };
}
