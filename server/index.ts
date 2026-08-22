// ---------------------------------------------------------------------------
// Local room server — plain Node + ws. No workerd, no edge runtime, no native
// deps: runs anywhere Node runs (Windows included). It wraps the SAME pure
// engines as everything else, so the rules are identical to production.
//
// Responsibilities: presence, broadcast, driving the game clock, and computing
// the ANONYMISED public projection of the game (authors are hidden during
// voting behind opaque tokens; revealed only at results). The pure engines are
// never touched by any of this.
//
// Run:  npm run dev:server   (→ ws://localhost:1999)
// ---------------------------------------------------------------------------

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  // room
  createInitialState,
  reduce,
  connectedPlayers,
  // game
  createSubtitlesGame,
  reduceSubtitles,
  currentClip,
  clipSlots,
  staticClipProvider,
  resolveConfig,
  sanitizeSettings,
  pickTwists,
  DEFAULT_GAME_SETTINGS,
  // platform + draw game
  drawModule,
  fakeArtistModule,
  relayModule,
  doublageModule,
  quizModule,
  recoModule,
  swapActiveDrawer,
  type RelayState,

  type AnyGameModule,
  type GameAction,
  type GameContext,
  type DrawState,
  type DrawStroke,
  type DrawClientAction,
  type AnyPublicGame,
  // types
  type ClientMessage,
  type GameClientAction,
  type GamePlayer,
  type GameSettings,
  type PublicGameState,
  type RoomAction,
  type RoomErrorCode,
  type RoomState,
  type ServerMessage,
  type SubtitlesAction,
  type SubtitlesErrorCode,
  type SubtitlesState,
  type VotingCaption,
  setCustomWords,
  addCustomQuestions,
  parseCustomQuestions,
} from "@subtitles-party/shared";

const PORT = Number(process.env.PORT ?? 1999);

// Load custom drawing words from motdessin/mots.txt (one word per line; lines
// starting with # are ignored). If present & non-empty, they replace the
// built-in word bank for Draw & Guess. Looked up from a few likely locations
// so it works whether the server runs from the repo root or elsewhere.
(() => {
  const candidates = [
    resolve(process.cwd(), "motdessin", "mots.txt"),
    resolve(process.cwd(), "..", "motdessin", "mots.txt"),
    resolve(__dirname, "..", "motdessin", "mots.txt"),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        const words = readFileSync(p, "utf8").split(/\r?\n/);
        setCustomWords(words);
        const kept = words.map((w) => w.trim()).filter((w) => w && !w.startsWith("#")).length;
        if (kept > 0) console.log(`[motdessin] ${kept} mots personnalisés chargés depuis ${p}`);
        return;
      }
    } catch {
      /* ignore and try next */
    }
  }
})();

// Load custom quiz questions from questionquizz/questions.txt (added to the
// built-in bank, never replacing). Format: "Question ? = réponse | alias1 | alias2".
(() => {
  const candidates = [
    resolve(process.cwd(), "questionquizz", "questions.txt"),
    resolve(process.cwd(), "..", "questionquizz", "questions.txt"),
    resolve(__dirname, "..", "questionquizz", "questions.txt"),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        const parsed = parseCustomQuestions(readFileSync(p, "utf8"));
        addCustomQuestions(parsed);
        if (parsed.length > 0) console.log(`[questionquizz] ${parsed.length} questions personnalisées chargées depuis ${p}`);
        return;
      }
    } catch {
      /* ignore and try next */
    }
  }
})();
const GRACE_MS = 45_000;

/** The only emojis clients may broadcast as live reactions. */
const REACTION_EMOJIS = ["😂", "😮", "🔥", "❤️", "👏", "💀"];

interface RoundTokens {
  round: number;
  byAuthor: Map<string, string>;
  byToken: Map<string, string>;
}

interface Room {
  state: RoomState;
  game: SubtitlesState | null; // subtitles: internal (author-keyed) state
  tokens: RoundTokens | null; // anonymisation map for the current voting round
  twists: (string | null)[]; // per-round style constraints
  /** Any OTHER game, hosted generically via the platform contract. */
  mod: { module: AnyGameModule; state: unknown } | null;
  strokes: unknown[]; // ephemeral stroke buffer for the current draw turn
  pendingSettings: unknown; // settings for a generic game, from start_game
  relayTimers: NodeJS.Timeout[]; // active-drawer rotation timers (relay)
  settings: GameSettings; // host-chosen lobby settings, applied at start
  sockets: Map<string, WebSocket>;
  pruneTimers: Map<string, NodeJS.Timeout>;
  gameTimer: NodeJS.Timeout | null;
}

/** Registry of games hosted generically (subtitles keeps its bespoke path for
 *  now; it can be migrated to a module later without touching this table). */
const GAME_REGISTRY: Record<string, AnyGameModule> = {
  draw: drawModule,
  fakeartist: fakeArtistModule,
  relay: relayModule,
  doublage: doublageModule,
  quiz: quizModule,
  reco: recoModule,
};
const gameCtx = (): GameContext => ({ now: Date.now(), rng: Math.random });

const rooms = new Map<string, Room>();

function getRoom(code: string): Room {
  let room = rooms.get(code);
  if (!room) {
    room = {
      state: createInitialState(code, Date.now()),
      game: null,
      tokens: null,
      twists: [],
      mod: null,
      strokes: [],
      pendingSettings: null,
      relayTimers: [],
      settings: DEFAULT_GAME_SETTINGS,
      sockets: new Map(),
      pruneTimers: new Map(),
      gameTimer: null,
    };
    rooms.set(code, room);
  }
  return room;
}

// --- anonymisation ----------------------------------------------------------

function newToken(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Build a stable author<->token map for the current voting round. Regenerated
 *  only when a new round reaches voting, so the UI never reshuffles. */
function syncTokens(room: Room) {
  const g = room.game;
  if (!g) {
    room.tokens = null;
    return;
  }
  if (
    (g.phase === "screening" || g.phase === "voting") &&
    (!room.tokens || room.tokens.round !== g.round)
  ) {
    const byAuthor = new Map<string, string>();
    const byToken = new Map<string, string>();
    for (const authorId of Object.keys(g.submissions)) {
      let t = newToken();
      while (byToken.has(t)) t = newToken();
      byAuthor.set(authorId, t);
      byToken.set(t, authorId);
    }
    room.tokens = { round: g.round, byAuthor, byToken };
  }
}

/** Project the internal game state into what `you` are allowed to see. */
function projectGame(room: Room, you: string): PublicGameState | null {
  const g = room.game;
  if (!g) return null;

  const showCaptions = (g.phase === "screening" || g.phase === "voting") && room.tokens;
  let captions: VotingCaption[] = [];
  let yourToken: string | null = null;
  let yourVote: string | null = null;

  if (showCaptions && room.tokens) {
    captions = Object.entries(g.submissions)
      .map(([authorId, lines]) => ({ token: room.tokens!.byAuthor.get(authorId)!, lines }))
      .sort((a, b) => (a.token < b.token ? -1 : 1)); // stable, author-independent
    yourToken = room.tokens.byAuthor.get(you) ?? null;
    const votedAuthor = g.votes[you];
    yourVote = votedAuthor ? room.tokens.byAuthor.get(votedAuthor) ?? null : null;
  }

  const revealed = g.phase === "results" || g.phase === "scoreboard";

  return {
    phase: g.phase,
    round: g.round,
    totalRounds: g.config.totalRounds,
    clip: currentClip(g),
    twist: room.twists[g.round - 1] ?? null,
    config: g.config,
    deadline: g.deadline,
    players: g.players,
    scores: g.scores,
    submittedIds: Object.keys(g.submissions),
    youSubmitted: Array.isArray(g.submissions[you]),
    captions,
    screenIndex: g.screenIndex,
    yourToken,
    yourVote,
    votedCount: Object.keys(g.votes).length,
    roundResults: revealed ? g.roundResults : null,
  };
}

/** Who may emit ephemeral draw ops right now: the drawer (draw game) or any
 *  player during the drawing phase (fake-artist — everyone draws at once). */
function canDrawNow(room: Room, playerId: string): boolean {
  if (!room.mod) return false;
  const st = room.mod.state as { phase: string; drawerId?: string | null };
  if (room.mod.module.id === "draw") return st.phase === "drawing" && playerId === st.drawerId;
  if (room.mod.module.id === "fakeartist") return st.phase === "drawing";
  if (room.mod.module.id === "relay") {
    const r = room.mod.state as RelayState;
    return r.phase === "drawing" && playerId === r.drawerIds[r.activeIdx];
  }
  return false;
}

function projectAny(room: Room, pid: string): { gameId: string | null; game: AnyPublicGame | null } {
  if (room.game) return { gameId: room.state.gameId ?? "subtitles", game: projectGame(room, pid) };
  if (room.mod) return { gameId: room.mod.module.id, game: room.mod.module.project(room.mod.state, pid) as AnyPublicGame };
  return { gameId: null, game: null };
}

function gameDeadline(room: Room): number | null {
  if (room.game) return room.game.deadline ?? null;
  if (room.mod) return room.mod.module.deadline(room.mod.state);
  return null;
}

/** Reduce a generic game action, then reschedule + broadcast. Clears the stroke
 *  buffer at the start of each new draw turn. */
function applyMod(room: Room, action: GameAction<DrawClientAction>, sender?: WebSocket) {
  if (!room.mod) return;
  const before = (room.mod.state as DrawState).phase;
  const { state, error } = room.mod.module.reduce(room.mod.state, action, gameCtx());
  room.mod.state = state;
  if (error && sender) sendError(sender, error.code, error.message);
  const after = (room.mod.state as DrawState).phase;
  if (after !== before) {
    if (after === "choosing" || after === "drawing") {
      room.strokes = [];
      relay(room, { type: "draw_clear", from: "*" });
    }
    if (after === "drawing") {
      scheduleSwaps(room);
    } else {
      clearSwaps(room);
    }
  }
  scheduleGameTick(room);
  broadcast(room);
}

// Relay: rotate the active drawer on a repeating timer during the drawing phase.
function clearSwaps(room: Room) {
  for (const t of room.relayTimers) clearTimeout(t);
  room.relayTimers = [];
}
function scheduleSwaps(room: Room) {
  clearSwaps(room);
  if (!room.mod || room.mod.module.id !== "relay") return;
  const s = room.mod.state as RelayState;
  if (s.phase !== "drawing") return;
  room.relayTimers.push(setTimeout(() => applySwapTick(room), Math.max(500, s.config.swapMs)));
}
function applySwapTick(room: Room) {
  if (!room.mod || room.mod.module.id !== "relay") return;
  const s = room.mod.state as RelayState;
  if (s.phase !== "drawing") return;
  room.mod.state = swapActiveDrawer(s, gameCtx());
  broadcast(room);
  scheduleSwaps(room); // arm the next rotation
}

/** Send an ephemeral message to everyone in the room (strokes, chat, clear). */
function relay(room: Room, msg: ServerMessage) {
  const data = JSON.stringify(msg);
  for (const sock of room.sockets.values()) {
    if (sock.readyState === WebSocket.OPEN) sock.send(data);
  }
}

/** A guess: the engine scores correct ones; the server relays chat. Correct →
 *  "a trouvé !" to all (never the word); wrong → the guess text as chat. */
function handleDrawGuess(room: Room, playerId: string, text: string, ws: WebSocket) {
  if (!room.mod) return;
  const s = room.mod.state as DrawState;
  const wasGuessed = s.guessedAt[playerId] != null;
  const wasDrawing = s.phase === "drawing";
  const isDrawer = playerId === s.drawerId;
  applyMod(room, { type: "client", playerId, msg: { kind: "guess", text } }, ws);
  const after = room.mod.state as DrawState;
  const name = room.state.players[playerId]?.name ?? "?";
  if (!wasGuessed && after.guessedAt[playerId] != null) {
    relay(room, { type: "chat", from: playerId, name, text: "a trouvé le mot !", kind: "correct" });
  } else if (wasDrawing && !isDrawer && !wasGuessed) {
    relay(room, { type: "chat", from: playerId, name, text, kind: "guess" });
  }
}

function handleRelayGuess(room: Room, playerId: string, text: string, ws: WebSocket) {
  if (!room.mod) return;
  const s = room.mod.state as RelayState;
  const wasGuessed = s.guessedAt[playerId] != null;
  const wasDrawing = s.phase === "drawing";
  const isDrawer = s.drawerIds.includes(playerId);
  applyMod(room, { type: "client", playerId, msg: { kind: "guess", text } }, ws);
  const after = room.mod.state as RelayState;
  const name = room.state.players[playerId]?.name ?? "?";
  if (!wasGuessed && after.guessedAt[playerId] != null) {
    relay(room, { type: "chat", from: playerId, name, text: "a trouvé le mot !", kind: "correct" });
  } else if (wasDrawing && !isDrawer && !wasGuessed) {
    relay(room, { type: "chat", from: playerId, name, text, kind: "guess" });
  }
}

// --- transport --------------------------------------------------------------

function stateMessageFor(room: Room, pid: string): ServerMessage {
  const { gameId, game } = projectAny(room, pid);
  return {
    type: "state",
    state: room.state,
    gameId,
    game,
    settings: room.settings,
    serverTime: Date.now(),
    you: pid,
  };
}

function broadcast(room: Room) {
  for (const [pid, sock] of room.sockets) {
    if (sock.readyState !== WebSocket.OPEN) continue;
    sock.send(JSON.stringify(stateMessageFor(room, pid)));
  }
}

function sendError(sock: WebSocket, code: RoomErrorCode | SubtitlesErrorCode | string, message: string) {
  if (sock.readyState !== WebSocket.OPEN) return;
  const msg: ServerMessage = { type: "error", code, message };
  sock.send(JSON.stringify(msg));
}

// --- room engine plumbing ---------------------------------------------------

function applyRoom(room: Room, action: RoomAction, sender?: WebSocket) {
  const { state, error } = reduce(room.state, action);
  room.state = state;
  if (error && sender) sendError(sender, error.code, error.message);
  if (room.state.phase === "in_game" && !room.game && !room.mod) startGame(room);
  broadcast(room);
}

// --- game engine plumbing ---------------------------------------------------

function startGame(room: Room) {
  clearSwaps(room);
  const players: GamePlayer[] = connectedPlayers(room.state).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    avatar: p.avatar ?? null,
  }));

  // Generic games (draw, …) are hosted through the platform contract.
  const gameId = room.state.gameId;
  const mod = gameId ? GAME_REGISTRY[gameId] : undefined;
  if (mod) {
    room.game = null;
    room.tokens = null;
    room.strokes = [];
    const settings = mod.sanitizeSettings(room.pendingSettings ?? undefined);
    room.mod = { module: mod, state: mod.createState(players, settings, gameCtx()) };
    scheduleGameTick(room);
    return;
  }

  // Subtitles keeps its bespoke path (tokens/twists/safety captions).
  room.mod = null;
  const config = resolveConfig(room.settings);
  const clips = staticClipProvider().pick(config.totalRounds);
  room.twists = pickTwists(config.totalRounds);
  room.game = createSubtitlesGame(players, clips, Date.now(), config);
  syncTokens(room);
  scheduleGameTick(room);
}

function applyGame(room: Room, action: SubtitlesAction, sender?: WebSocket) {
  if (!room.game) return;
  const { state, error } = reduceSubtitles(room.game, action);
  room.game = state;
  if (error && sender) sendError(sender, error.code, error.message);
  syncTokens(room);
  scheduleGameTick(room);
  broadcast(room);
}

/** Don't make everyone wait on a player who left: once every *connected*
 *  in-game player has acted for the current phase, advance immediately.
 *  The pure engine only auto-advances when ALL players (incl. absent ones)
 *  have acted, so presence is handled here in the adapter. */
function maybeAdvanceForPresence(room: Room) {
  const g = room.game;
  if (!g) return;
  const connected = g.players.filter((p) => room.state.players[p.id]?.isConnected);
  if (connected.length === 0) return; // nobody left; timer/cleanup handles it

  if (g.phase === "writing") {
    const allWrote = connected.every((p) => Array.isArray(g.submissions[p.id]));
    if (allWrote) advanceGame(room, Date.now());
  } else if (g.phase === "voting") {
    // Only players who submitted a caption are expected to vote.
    const voters = connected.filter((p) => Array.isArray(g.submissions[p.id]));
    if (voters.length > 0 && voters.every((p) => typeof g.votes[p.id] === "string")) {
      applyGame(room, { type: "advance", now: Date.now() });
    }
  }
}

/** Playful fallbacks so a round is never empty when someone doesn't write. */
const SAFETY_CAPTIONS = [
  "…",
  "(a séché sur ce coup)",
  "j'ai un blanc 🥲",
  "euh… non rien",
  "🦗 🦗 🦗",
  "pas d'inspi, désolé",
  "*bruit de criquet*",
];
const randomSafety = () => SAFETY_CAPTIONS[Math.floor(Math.random() * SAFETY_CAPTIONS.length)];

/** Fill a caption for every connected player who hasn't written yet. */
function fillSafetyCaptions(room: Room, now: number) {
  const g = room.game;
  if (!g) return;
  const slots = clipSlots(currentClip(g));
  for (const p of g.players) {
    if (room.state.players[p.id]?.isConnected && !Array.isArray(g.submissions[p.id])) {
      applyGame(room, { type: "submit", playerId: p.id, lines: slots.map(() => randomSafety()), now });
    }
  }
}

/** Advance the game a phase. When leaving writing, first give any connected
 *  player who didn't write a safety caption — so nobody is dropped and the
 *  round always has something to screen. */
function advanceGame(room: Room, now: number) {
  if (room.mod) {
    applyMod(room, { type: "advance" });
    return;
  }
  const g = room.game;
  if (g && g.phase === "writing") {
    fillSafetyCaptions(room, now);
    // Filling the last one may have auto-advanced to screening already.
    if (room.game && room.game.phase !== "writing") return;
  }
  applyGame(room, { type: "advance", now });
}

function scheduleGameTick(room: Room) {
  if (room.gameTimer) {
    clearTimeout(room.gameTimer);
    room.gameTimer = null;
  }
  const deadline = gameDeadline(room);
  if (deadline == null) return;
  const delay = Math.max(0, deadline - Date.now());
  room.gameTimer = setTimeout(() => {
    room.gameTimer = null;
    advanceGame(room, Date.now());
  }, delay);
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const params = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
  const code = (params.get("room") ?? "").toUpperCase();
  const playerId = params.get("id") ?? "";
  if (!code || !playerId) {
    ws.close(1008, "room et id requis");
    return;
  }

  const room = getRoom(code);

  const timer = room.pruneTimers.get(playerId);
  if (timer) {
    clearTimeout(timer);
    room.pruneTimers.delete(playerId);
  }

  const previous = room.sockets.get(playerId);
  if (previous && previous !== ws) previous.close(4000, "remplacé");
  room.sockets.set(playerId, ws);

  const now = Date.now();
  if (room.state.players[playerId]) {
    applyRoom(room, { type: "reconnect", playerId, now });
  } else {
    ws.send(JSON.stringify(stateMessageFor(room, playerId)));
  }
  // Replay the current turn's strokes so a (re)connecting client catches up.
  if (room.mod && (room.mod.module.id === "draw" || room.mod.module.id === "fakeartist" || room.mod.module.id === "relay")) {
    for (const op of room.strokes as Array<
      { kind: "stroke"; stroke: DrawStroke; from?: string } | { kind: "fill"; x: number; y: number; color: string; from?: string }
    >) {
      const from = op.from ?? playerId;
      const m: ServerMessage =
        op.kind === "stroke"
          ? { type: "stroke", stroke: op.stroke, from }
          : { type: "fill", x: op.x, y: op.y, color: op.color, from };
      ws.send(JSON.stringify(m));
    }
  }

  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return;
    }
    const t = Date.now();
    switch (msg.type) {
      case "join":
        return applyRoom(room, { type: "join", playerId, name: msg.name, now: t }, ws);
      case "leave":
        return applyRoom(room, { type: "leave", playerId, now: t }, ws);
      case "set_ready":
        return applyRoom(room, { type: "set_ready", playerId, ready: msg.ready, now: t }, ws);
      case "set_name":
        return applyRoom(room, { type: "set_name", playerId, name: msg.name, now: t }, ws);

      case "set_avatar": {
        // Cap the payload (~150 KB of base64) to protect the room broadcast.
        const av = typeof msg.avatar === "string" && msg.avatar.startsWith("data:image/") && msg.avatar.length <= 150_000 ? msg.avatar : null;
        return applyRoom(room, { type: "set_avatar", playerId, avatar: av, now: t }, ws);
      }
      case "set_settings": {
        // Host only, and only before the game starts.
        if (playerId !== room.state.hostId || room.state.phase !== "lobby") return;
        room.settings = sanitizeSettings(msg.settings);
        return broadcast(room);
      }
      case "start_game":
        room.pendingSettings = msg.settings ?? null;
        return applyRoom(room, { type: "start_game", playerId, gameId: msg.gameId, now: t }, ws);

      case "game": {
        if (room.mod) {
          const action = msg.action as DrawClientAction;
          if (room.mod.module.id === "draw" && action.kind === "guess") {
            handleDrawGuess(room, playerId, action.text, ws);
          } else if (room.mod.module.id === "relay" && action.kind === "guess") {
            handleRelayGuess(room, playerId, action.text, ws);
          } else {
            applyMod(room, { type: "client", playerId, msg: action }, ws);
          }
          return;
        }
        if (!room.game) return;
        const sub = msg.action as GameClientAction;
        if (sub.kind === "submit") {
          applyGame(room, { type: "submit", playerId, lines: sub.lines, now: t }, ws);
          maybeAdvanceForPresence(room);
          return;
        }
        if (sub.kind === "vote") {
          // Map the opaque token back to the real author, server-side only.
          const authorId = room.tokens?.byToken.get(sub.token);
          if (!authorId) return;
          applyGame(room, { type: "vote", playerId, authorId, now: t }, ws);
          maybeAdvanceForPresence(room);
          return;
        }
        return;
      }
      case "skip": {
        if (playerId !== room.state.hostId || (!room.game && !room.mod)) return;
        return advanceGame(room, t);
      }

      case "debug_fill": {
        // Host-only test helper: auto-write a caption for every player who
        // hasn't submitted yet, so a solo host can move a test game forward.
        if (playerId !== room.state.hostId || !room.game || room.game.phase !== "writing") return;
        const slots = clipSlots(currentClip(room.game));
        for (const p of room.game.players) {
          if (!Array.isArray(room.game.submissions[p.id])) {
            const lines = slots.map((_, i) => `${p.name} — réplique ${i + 1}`);
            applyGame(room, { type: "submit", playerId: p.id, lines, now: Date.now() });
          }
        }
        return;
      }

      case "return_lobby": {
        // Host-only: end the current game and send everyone back to the lobby.
        if (playerId !== room.state.hostId) return;
        if (room.gameTimer) {
          clearTimeout(room.gameTimer);
          room.gameTimer = null;
        }
        room.game = null;
        room.tokens = null;
        room.mod = null;
        room.strokes = [];
        clearSwaps(room);
        const players = Object.fromEntries(
          Object.entries(room.state.players).map(([id, p]) => [id, { ...p, isReady: false }]),
        );
        room.state = { ...room.state, phase: "lobby", gameId: null, players };
        return broadcast(room);
      }

      case "play_again": {
        // Host-only: immediately start a fresh game with the players currently
        // connected and the current settings — no trip back to the lobby.
        if (playerId !== room.state.hostId || room.state.phase !== "in_game") return;
        startGame(room);
        return broadcast(room);
      }

      case "react": {
        // Ephemeral live reaction — broadcast to everyone, never stored in state.
        if ((!room.game && !room.mod) || !REACTION_EMOJIS.includes(msg.emoji)) return;
        const out: ServerMessage = { type: "reaction", emoji: msg.emoji, from: playerId };
        const data = JSON.stringify(out);
        for (const sock of room.sockets.values()) {
          if (sock.readyState === WebSocket.OPEN) sock.send(data);
        }
        return;
      }

      case "speaking": {
        // Ephemeral "who is talking" indicator (doublage) — relay to everyone.
        if (!room.mod) return;
        relay(room, { type: "speaking", from: playerId, speaking: !!msg.speaking });
        return;
      }

      case "chat": {
        // Ephemeral discussion message (distinct from guesses), relayed to all.
        if (!room.game && !room.mod) return;
        const text = msg.text.trim().slice(0, 140);
        if (!text) return;
        const name = room.state.players[playerId]?.name ?? "?";
        relay(room, { type: "chat", from: playerId, name, text, kind: "talk" });
        return;
      }

      case "draw_stroke": {
        if (!canDrawNow(room, playerId)) return;
        room.strokes.push({ kind: "stroke", stroke: msg.stroke, from: playerId });
        if (room.strokes.length > 6000) room.strokes.shift();
        relay(room, { type: "stroke", stroke: msg.stroke, from: playerId });
        return;
      }

      case "draw_fill": {
        if (!canDrawNow(room, playerId)) return;
        room.strokes.push({ kind: "fill", x: msg.x, y: msg.y, color: msg.color, from: playerId });
        if (room.strokes.length > 6000) room.strokes.shift();
        relay(room, { type: "fill", x: msg.x, y: msg.y, color: msg.color, from: playerId });
        return;
      }

      case "draw_clear": {
        if (!canDrawNow(room, playerId)) return;
        // Impostor mode = one canvas per player → only clear the author's canvas.
        if (room.mod && room.mod.module.id === "fakeartist") {
          room.strokes = (room.strokes as Array<{ from?: string }>).filter((s) => s.from !== playerId);
        } else {
          room.strokes = [];
        }
        relay(room, { type: "draw_clear", from: playerId });
        return;
      }
    }
  });

  ws.on("close", () => {
    if (room.sockets.get(playerId) !== ws) return;
    room.sockets.delete(playerId);
    applyRoom(room, { type: "disconnect", playerId, now: Date.now() });
    // If the game was only waiting on the player who just left, move on.
    maybeAdvanceForPresence(room);
    if (room.mod) {
      applyMod(room, { type: "presence", connectedIds: connectedPlayers(room.state).map((p) => p.id) });
    }

    const t = setTimeout(() => {
      applyRoom(room, { type: "leave", playerId, now: Date.now() });
      room.pruneTimers.delete(playerId);
      if (room.sockets.size === 0 && room.state.playerOrder.length === 0) {
        if (room.gameTimer) clearTimeout(room.gameTimer);
        rooms.delete(code);
      }
    }, GRACE_MS);
    room.pruneTimers.set(playerId, t);
  });
});

wss.on("listening", () => {
  console.log(`\n  \u001b[32m✓\u001b[0m Serveur de room prêt sur \u001b[1mws://localhost:${PORT}\u001b[0m`);
  console.log(`    (laisse cette fenêtre ouverte, puis lance le site avec: npm run dev:web)\n`);
});
