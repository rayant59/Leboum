// ---------------------------------------------------------------------------
// Bombe (BombParty) — moteur pur & autoritatif.
//
// Règles : à chaque tour, une syllabe jouable est tirée. Le joueur courant doit
// écrire un mot français qui la contient. Bon mot → la bombe passe aussitôt au
// suivant avec une NOUVELLE syllabe et un NOUVEAU minuteur aléatoire. Si la
// bombe explose (échéance atteinte) avant un mot valide, le joueur perd une vie.
// À 0 vie il est éliminé. Dernier debout = gagnant.
//
// Le serveur est seul maître du temps : `deadline(state)` donne l'instant exact
// d'explosion ; quand il est atteint, le serveur envoie `advance`. Le client ne
// connaît jamais cet instant (voir project()).
// ---------------------------------------------------------------------------

import type { GamePlayer } from "../../game/types";
import type { PlayerId } from "../../room/types";
import type { GameAction, GameContext, GameError, GameReduceResult } from "../../platform/types";
import { bombeNormalize, bombeWordMatches, isBombeWord, pickBombeSyllable } from "./dictionary";
import type { BombeConfig, BombePublic, BombeRankRow, BombeSettings, BombeState } from "./types";

export const BOMBE_LIVES_MIN = 1;
export const BOMBE_LIVES_MAX = 10;
export const BOMBE_SEC_MIN = 2;
export const BOMBE_SEC_MAX = 30;
const RECENT_SYLLABLES = 12;

/** Lettres qui comptent pour la collecte (A-V). W, X, Y, Z sont ignorées. */
export const BOMBE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUV".split("");
const AV_SET = new Set(BOMBE_ALPHABET);

/** Lettres A-V uniques d'un mot déjà normalisé (accents retirés, minuscules). */
export function bombeWordLetters(normalized: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const ch of normalized.toUpperCase()) {
    if (AV_SET.has(ch) && !seen.has(ch)) { seen.add(ch); out.push(ch); }
  }
  return out;
}

export function resolveBombeConfig(settings: BombeSettings): BombeConfig {
  const lives = clamp(settings.lives ?? 3, BOMBE_LIVES_MIN, BOMBE_LIVES_MAX);
  let minS = clamp(settings.minSeconds ?? 5, BOMBE_SEC_MIN, BOMBE_SEC_MAX);
  let maxS = clamp(settings.maxSeconds ?? 12, BOMBE_SEC_MIN, BOMBE_SEC_MAX);
  if (maxS < minS) [minS, maxS] = [maxS, minS];
  const minLetters = clamp(settings.minLetters ?? 2, 2, 3);
  const maxLetters = clamp(Math.max(settings.maxLetters ?? 3, minLetters), 2, 3);
  return { lives, minMs: minS * 1000, maxMs: maxS * 1000, minLetters, maxLetters };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rec0(players: GamePlayer[]): Record<PlayerId, number> {
  const r: Record<PlayerId, number> = {};
  for (const p of players) r[p.id] = 0;
  return r;
}

/** Durée aléatoire de la bombe pour ce tour, en millisecondes. */
function randomFuse(cfg: BombeConfig, rng: () => number): number {
  return Math.round(cfg.minMs + rng() * (cfg.maxMs - cfg.minMs));
}

/** Prépare un nouveau tour : syllabe fraîche + minuteur aléatoire. */
function armTurn(state: BombeState, currentId: PlayerId, ctx: GameContext): BombeState {
  const syllable = pickBombeSyllable(ctx.rng, {
    minLetters: state.config.minLetters,
    maxLetters: state.config.maxLetters,
    exclude: state.recentSyllables,
  });
  return {
    ...state,
    currentId,
    syllable,
    turnStartedAt: ctx.now,
    deadline: ctx.now + randomFuse(state.config, ctx.rng),
    recentSyllables: [syllable, ...state.recentSyllables].slice(0, RECENT_SYLLABLES),
  };
}

export function createBombe(players: GamePlayer[], settings: BombeSettings, ctx: GameContext): BombeState {
  const config = resolveBombeConfig(settings);
  const order = shuffle(players.map((p) => p.id), ctx.rng);
  const lives: Record<PlayerId, number> = {};
  for (const p of players) lives[p.id] = config.lives;
  const base: BombeState = {
    phase: "playing",
    players,
    connectedIds: players.map((p) => p.id),
    order,
    lives,
    eliminated: [],
    currentId: order[0] ?? null,
    syllable: "",
    turnStartedAt: ctx.now,
    deadline: null,
    usedWords: [],
    usedLetters: [],
    letterEvent: null,
    recentSyllables: [],
    wordsFound: rec0(players),
    turnsSurvived: rec0(players),
    lastWord: null,
    lastWordBy: null,
    justExploded: null,
    winnerId: null,
    config,
  };
  return armTurn(base, order[0] ?? "", ctx);
}

const ok = (state: BombeState): GameReduceResult<BombeState> => ({ state });
const fail = (state: BombeState, error: GameError): GameReduceResult<BombeState> => ({ state, error });

function aliveIds(state: BombeState): PlayerId[] {
  return state.order.filter((id) => (state.lives[id] ?? 0) > 0);
}

/** Prochain joueur en vie après `fromId` (privilégie les connectés). */
function nextPlayer(state: BombeState, fromId: PlayerId): PlayerId | null {
  const n = state.order.length;
  if (n === 0) return null;
  const start = Math.max(0, state.order.indexOf(fromId));
  const connected = new Set(state.connectedIds);
  for (let step = 1; step <= n; step++) {
    const cand = state.order[(start + step) % n];
    if ((state.lives[cand] ?? 0) > 0 && connected.has(cand)) return cand;
  }
  // Repli : personne de connecté → on prend le prochain en vie quand même.
  for (let step = 1; step <= n; step++) {
    const cand = state.order[(start + step) % n];
    if ((state.lives[cand] ?? 0) > 0) return cand;
  }
  return null;
}

/** Fin de partie si 1 (ou 0) joueur encore en vie. */
function checkOver(state: BombeState): BombeState {
  const alive = aliveIds(state);
  if (alive.length <= 1) {
    return { ...state, phase: "gameover", deadline: null, currentId: null, winnerId: alive[0] ?? null };
  }
  return state;
}

export function reduceBombe(
  state: BombeState,
  action: GameAction<{ kind: "submit"; text: string }>,
  ctx: GameContext,
): GameReduceResult<BombeState> {
  switch (action.type) {
    case "client": {
      const { playerId, msg } = action;
      if (state.phase !== "playing") return ok(state);
      if (msg.kind !== "submit") return ok(state);
      if (playerId !== state.currentId) return ok(state); // seul le joueur courant joue
      // Garde-fou : si le minuteur est déjà écoulé, on ignore (l'explosion va suivre).
      if (state.deadline != null && ctx.now > state.deadline) return ok(state);
      const w = bombeNormalize(msg.text);
      const match = bombeWordMatches(msg.text, state.syllable);
      if (!match.ok) {
        if (match.reason === "syllable")
          return fail(state, { code: "bombe_syllable", message: `Le mot doit contenir « ${state.syllable.toUpperCase()} ».` });
        if (match.reason === "unknown")
          return fail(state, { code: "bombe_unknown", message: "Ce mot n'est pas dans le dictionnaire." });
        return fail(state, { code: "bombe_empty", message: "Écris un mot." });
      }
      if (state.usedWords.includes(w)) {
        return fail(state, { code: "bombe_used", message: "Ce mot a déjà été utilisé." });
      }
      // Bon mot ! On regarde les nouvelles lettres A-V découvertes.
      const maxLives = state.config.lives;
      const curLives = state.lives[playerId] ?? 0;
      const wordLetters = bombeWordLetters(w);
      const newLetters = wordLetters.filter((l) => !state.usedLetters.includes(l));
      const gainedLife = newLetters.length > 0 && curLives < maxLives; // +1 vie max par mot
      const atMax = newLetters.length > 0 && curLives >= maxLives;
      const lives = gainedLife ? { ...state.lives, [playerId]: Math.min(maxLives, curLives + 1) } : state.lives;
      const usedLetters = newLetters.length ? [...state.usedLetters, ...newLetters] : state.usedLetters;
      const letterEvent = newLetters.length
        ? { playerId, newLetters, gainedLife, atMax, at: ctx.now }
        : null;

      // La bombe passe aussitôt au joueur suivant.
      const next = nextPlayer(state, playerId);
      const advanced: BombeState = {
        ...state,
        lives,
        usedWords: [...state.usedWords, w],
        usedLetters,
        letterEvent,
        wordsFound: { ...state.wordsFound, [playerId]: (state.wordsFound[playerId] ?? 0) + 1 },
        turnsSurvived: { ...state.turnsSurvived, [playerId]: (state.turnsSurvived[playerId] ?? 0) + 1 },
        lastWord: w,
        lastWordBy: playerId,
        justExploded: null,
      };
      if (next == null) return ok(checkOver(advanced));
      return ok(armTurn(advanced, next, ctx));
    }

    case "advance": {
      // L'échéance a été atteinte → EXPLOSION sur le joueur courant.
      if (state.phase !== "playing" || state.currentId == null) return ok(state);
      const victim = state.currentId;
      const remaining = Math.max(0, (state.lives[victim] ?? 0) - 1);
      const lives = { ...state.lives, [victim]: remaining };
      const eliminated = remaining === 0 ? [...state.eliminated, victim] : state.eliminated;
      const exploded: BombeState = {
        ...state,
        lives,
        eliminated,
        justExploded: victim,
        letterEvent: null,
        lastWord: null,
        lastWordBy: null,
      };
      const over = checkOver(exploded);
      if (over.phase === "gameover") return ok(over);
      const next = nextPlayer(exploded, victim);
      if (next == null) return ok(checkOver(exploded));
      return ok(armTurn(exploded, next, ctx));
    }

    case "presence": {
      const connectedIds = action.connectedIds;
      let next: BombeState = { ...state, connectedIds };
      if (state.phase !== "playing") return ok(next);
      // Si le joueur courant s'est déconnecté, on passe la main SANS pénalité.
      if (state.currentId != null && !connectedIds.includes(state.currentId)) {
        const heir = nextPlayer(next, state.currentId);
        if (heir != null && heir !== state.currentId) {
          next = armTurn({ ...next, justExploded: null, letterEvent: null }, heir, ctx);
        }
      }
      return ok(next);
    }
  }
}

/** Deadline exposée au serveur pour planifier l'explosion (jamais au client tel quel). */
export function bombeDeadline(state: BombeState): number | null {
  return state.phase === "playing" ? state.deadline : null;
}

export function bombeIsOver(state: BombeState): boolean {
  return state.phase === "gameover";
}

function nameOf(state: BombeState, id: PlayerId | null): string | null {
  if (!id) return null;
  return state.players.find((p) => p.id === id)?.name ?? null;
}

export function projectBombe(state: BombeState, viewerId: PlayerId): BombePublic {
  const alive = aliveIds(state);
  const ranking: BombeRankRow[] = [...state.players]
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      avatar: p.avatar,
      lives: state.lives[p.id] ?? 0,
      eliminated: (state.lives[p.id] ?? 0) <= 0,
      wordsFound: state.wordsFound[p.id] ?? 0,
      isCurrent: p.id === state.currentId,
    }))
    // vivants d'abord (par vies décroissantes), puis éliminés (dans l'ordre inverse d'élimination)
    .sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (b.lives !== a.lives) return b.lives - a.lives;
      return b.wordsFound - a.wordsFound;
    });

  // Stats de fin
  let stats: BombePublic["stats"] = null;
  if (state.phase === "gameover") {
    let bestWordsId: PlayerId | null = null;
    let bestWords = -1;
    for (const p of state.players) {
      const w = state.wordsFound[p.id] ?? 0;
      if (w > bestWords) { bestWords = w; bestWordsId = p.id; }
    }
    stats = {
      words: bestWords > 0 ? nameOf(state, bestWordsId) : null,
      survivor: nameOf(state, state.winnerId),
    };
  }

  return {
    phase: state.phase,
    players: state.players,
    syllable: state.syllable,
    currentId: state.currentId,
    youAreCurrent: viewerId === state.currentId,
    turnStartedAt: state.turnStartedAt,
    minMs: state.config.minMs,
    maxMs: state.config.maxMs,
    deadline: state.deadline,
    maxDeadline: state.turnStartedAt + state.config.maxMs,
    lives: state.lives,
    maxLives: state.config.lives,
    eliminatedIds: state.eliminated,
    ranking,
    lastWord: state.lastWord,
    lastWordBy: state.lastWordBy,
    justExploded: state.justExploded,
    usedCount: state.usedWords.length,
    aliveCount: alive.length,
    usedLetters: state.usedLetters,
    letterEvent: state.letterEvent,
    winnerId: state.winnerId,
    stats,
  };
}

// Ré-export utilitaire (pratique pour les tests / le serveur).
export { isBombeWord };
