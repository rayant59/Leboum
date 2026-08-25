// ---------------------------------------------------------------------------
// Draw & Guess — pure engine. Authoritative rules, no I/O, no clock, no rng
// (both injected). Strokes and wrong-guess chat are NOT here: they are
// ephemeral and relayed by the server. The engine only owns the low-frequency
// truth: turns, the word, correct guesses, and scores.
// ---------------------------------------------------------------------------

import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameReduceResult } from "../../platform/types";
import { getDrawMode, resolveDrawConfig } from "./modes";
import type { DrawClientAction, DrawPublic, DrawState } from "./types";
import { pickWordEntries } from "./words";
import type { WordEntry } from "./words";
import type { DrawSettings } from "./types";

/** Normalise for guess comparison: lowercase, no accents, hyphens/apostrophes
 *  treated as spaces, single-spaced — so compound words match loosely
 *  ("Casse-Noisette" == "casse noisette"). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-'’]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function maskWord(word: string): string {
  return [...word].map((c) => (/[a-zA-ZÀ-ÿ]/.test(c) ? "_" : c)).join(" ");
}

const isLetter = (c: string) => /[a-zA-ZÀ-ÿ]/.test(c);

/** Fully masked word (no auto-reveal): letters → "_", separators kept. */
function patternMask(word: string): string {
  return [...word].map((c) => (isLetter(c) ? "_" : c)).join(" ");
}

/** Masked word split into per-sub-word segments (compound words read clearly,
 *  e.g. "feu de camp" → ["___","__","____"]) without revealing anything. */
/** The separator that sits between each pair of consecutive sub-words: "-" for
 *  a hyphen, " " for anything else (space). Length = segments − 1. Lets the
 *  client show a real hyphen but a wide gap for space-separated compounds. */
function wordSeparatorsOf(word: string): string[] {
  const seps: string[] = [];
  let sawLetter = false;
  let sep: string | null = null;
  for (const c of word) {
    if (isLetter(c)) {
      if (sawLetter && sep !== null) seps.push(sep === "-" ? "-" : " ");
      sep = null;
      sawLetter = true;
    } else if (sep === null) {
      sep = c;
    }
  }
  return seps;
}

function wordSegmentsOf(word: string): string[] {
  const segs: string[] = [];
  let cur = "";
  for (const c of word) {
    if (!isLetter(c)) {
      if (cur) segs.push(cur);
      cur = "";
    } else cur += "_";
  }
  if (cur) segs.push(cur);
  return segs;
}

const ok = (state: DrawState): GameReduceResult<DrawState> => ({ state });
const fail = (state: DrawState, code: string, message: string): GameReduceResult<DrawState> => ({
  state,
  error: { code, message },
});

export function createDrawGame(
  players: GamePlayer[],
  settings: DrawSettings,
  ctx: GameContext,
): DrawState {
  const config = resolveDrawConfig(settings);
  const order = shuffle(players.map((p) => p.id), ctx.rng);
  const scores: Record<PlayerId, number> = {};
  for (const p of players) scores[p.id] = 0;
  const entries = pickWordEntries(config.wordChoiceCount, ctx.rng, settings.themes);
  return {
    phase: "choosing",
    round: 1,
    totalRounds: config.totalRounds,
    order,
    turnInRound: 0,
    players,
    drawerId: order[0] ?? null,
    word: null,
    wordPattern: "",
    wordChoices: entries.map((e) => e.word),
    choicePool: entries,
    theme: null,
    themeRevealed: false,
    finished: false,
    constraint: null,
    constraintRule: null,
    guessedAt: {},
    scores,
    deadline: ctx.now + config.chooseMs,
    result: null,
    config,
    mode: getDrawMode(settings.mode).id,
    wordThemes: settings.themes ?? [],
    usedWords: entries.map((e) => e.word),
  };
}

export function reduceDraw(
  state: DrawState,
  action: GameAction<DrawClientAction>,
  ctx: GameContext,
): GameReduceResult<DrawState> {
  switch (action.type) {
    case "client":
      return reduceClient(state, action.playerId, action.msg, ctx);
    case "advance":
      return ok(advance(state, ctx));
    case "presence":
      return ok(applyPresence(state, action.connectedIds, ctx, action.players));
  }
}

function reduceClient(
  state: DrawState,
  playerId: PlayerId,
  msg: DrawClientAction,
  ctx: GameContext,
): GameReduceResult<DrawState> {
  if (!state.players.some((p) => p.id === playerId)) {
    return fail(state, "not_a_player", "Tu n'es pas dans la partie.");
  }

  if (msg.kind === "choose_word") {
    if (state.phase !== "choosing") return fail(state, "wrong_phase", "Ce n'est pas le moment.");
    if (playerId !== state.drawerId) return fail(state, "not_drawer", "Tu n'es pas le dessinateur.");
    const entry = state.choicePool.find((e) => e.word === msg.word);
    if (!entry) return fail(state, "bad_word", "Mot invalide.");
    return ok(startDrawing(state, entry, ctx));
  }

  if (msg.kind === "reveal_theme") {
    if (state.phase !== "drawing" || playerId !== state.drawerId || state.themeRevealed) return ok(state);
    return ok({ ...state, themeRevealed: true });
  }

  // The drawer decides their drawing is done → end the round early.
  if (msg.kind === "end_drawing") {
    if (state.phase !== "drawing" || playerId !== state.drawerId) return ok(state);
    return ok({ ...state, finished: true }); // informational only — round keeps going
  }

  // guess
  if (state.phase !== "drawing") return ok(state); // ignore stray guesses
  if (playerId === state.drawerId) return ok(state); // the drawer can't guess
  if (state.guessedAt[playerId] != null) return ok(state); // already found it

  const correct = state.word != null && normalize(msg.text) === normalize(state.word);
  if (!correct) return ok(state); // wrong guess → server relays it as chat

  const frac = state.deadline != null ? (state.deadline - ctx.now) / state.config.drawMs : 0;
  const mode = getDrawMode(state.mode);
  const next: DrawState = {
    ...state,
    guessedAt: { ...state.guessedAt, [playerId]: ctx.now },
    scores: {
      ...state.scores,
      [playerId]: (state.scores[playerId] ?? 0) + mode.scoreGuess(frac),
      ...(state.drawerId
        ? { [state.drawerId]: (state.scores[state.drawerId] ?? 0) + state.config.pointsDrawerPerGuess }
        : {}),
    },
  };
  // Everyone (but the drawer) has found it → end the turn early.
  if (Object.keys(next.guessedAt).length >= next.players.length - 1) return ok(toReveal(next, ctx));
  return ok(next);
}

function advance(state: DrawState, ctx: GameContext): DrawState {
  switch (state.phase) {
    case "choosing": {
      // Time's up without a choice → auto-pick the first offered word.
      const entry = state.choicePool[0];
      return entry ? startDrawing(state, entry, ctx) : toReveal(state, ctx);
    }
    case "drawing":
      return toReveal(state, ctx);
    case "reveal":
      return nextTurn(state, ctx);
    case "scoreboard":
      return state;
  }
}

function applyPresence(state: DrawState, connectedIds: PlayerId[], ctx: GameContext, roster?: GamePlayer[]): DrawState {
  // Fold any newly-connected players into the roster so mid-game joiners become
  // real players (their guesses count and show up), never "ghosts".
  if (roster && roster.length) {
    const known = new Set(state.players.map((p) => p.id));
    const toAdd = roster.filter((p) => !known.has(p.id));
    if (toAdd.length) {
      const scores = { ...state.scores };
      for (const p of toAdd) if (scores[p.id] == null) scores[p.id] = 0;
      state = {
        ...state,
        players: [...state.players, ...toAdd],
        order: [...state.order, ...toAdd.map((p) => p.id)],
        scores,
      };
    }
  }
  if (state.phase !== "choosing" && state.phase !== "drawing") return state;
  const connected = new Set(connectedIds);
  // The drawer left → end the turn.
  if (state.drawerId && !connected.has(state.drawerId)) return toReveal(state, ctx);
  if (state.phase !== "drawing") return state;
  // Every connected guesser has found it → end early.
  const pending = state.players.filter(
    (p) => p.id !== state.drawerId && connected.has(p.id) && state.guessedAt[p.id] == null,
  );
  return pending.length === 0 && connected.size > 1 ? toReveal(state, ctx) : state;
}

function startDrawing(state: DrawState, entry: WordEntry, ctx: GameContext): DrawState {
  const mode = getDrawMode(state.mode);
  const c = mode.constraint ? mode.constraint(ctx.rng) : null;
  return {
    ...state,
    phase: "drawing",
    word: entry.word,
    wordPattern: maskWord(entry.word),
    theme: entry.theme,
    themeRevealed: false,
    finished: false,
    wordChoices: [],
    choicePool: [],
    constraint: c ? c.label : null,
    constraintRule: c ? c.rule : null,
    guessedAt: {},
    deadline: ctx.now + state.config.drawMs,
  };
}

function toReveal(state: DrawState, ctx: GameContext): DrawState {
  return {
    ...state,
    phase: "reveal",
    deadline: ctx.now + state.config.revealMs,
    result: {
      word: state.word ?? "",
      drawerId: state.drawerId ?? "",
      guesserIds: Object.keys(state.guessedAt),
    },
  };
}

function nextTurn(state: DrawState, ctx: GameContext): DrawState {
  let round = state.round;
  let turnInRound = state.turnInRound + 1;
  if (turnInRound >= state.order.length) {
    turnInRound = 0;
    round += 1;
  }
  if (round > state.totalRounds) {
    return { ...state, phase: "scoreboard", drawerId: null, deadline: null, result: null, themeRevealed: false, finished: false };
  }
  const entries = pickWordEntries(state.config.wordChoiceCount, ctx.rng, state.wordThemes, state.usedWords);
  return {
    ...state,
    phase: "choosing",
    round,
    turnInRound,
    drawerId: state.order[turnInRound] ?? null,
    word: null,
    wordPattern: "",
    wordChoices: entries.map((e) => e.word),
    choicePool: entries,
    usedWords: [...state.usedWords, ...entries.map((e) => e.word)],
    theme: null,
    themeRevealed: false,
    finished: false,
    constraint: null,
    constraintRule: null,
    guessedAt: {},
    result: null,
    deadline: ctx.now + state.config.chooseMs,
  };
}

export function projectDraw(state: DrawState, viewerId: PlayerId): DrawPublic {
  const revealed = state.phase === "reveal" || state.phase === "scoreboard";
  const isDrawer = viewerId === state.drawerId;
  const guessed = state.guessedAt[viewerId] != null;
  const canSeeWord = revealed || isDrawer || guessed;
  const showTheme = state.themeRevealed || revealed;
  const foundOrder = Object.entries(state.guessedAt)
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);
  return {
    phase: state.phase,
    round: state.round,
    totalRounds: state.totalRounds,
    turnInRound: state.turnInRound,
    players: state.players,
    drawerId: state.drawerId,
    youAreDrawer: isDrawer,
    deadline: state.deadline,
    scores: state.scores,
    guessedIds: Object.keys(state.guessedAt),
    youGuessed: guessed,
    wordPattern: patternMask(state.word ?? ""),
    wordSegments: wordSegmentsOf(state.word ?? ""),
    wordSeparators: wordSeparatorsOf(state.word ?? ""),
    constraint: state.constraint,
    constraintRule: state.constraintRule,
    theme: showTheme ? state.theme : null,
    themeRevealed: state.themeRevealed,
    finished: state.finished,
    foundOrder,
    word: canSeeWord ? state.word : null,
    wordChoices: state.phase === "choosing" && isDrawer ? state.wordChoices : null,
    result: revealed ? state.result : null,
    config: state.config,
    mode: state.mode,
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
