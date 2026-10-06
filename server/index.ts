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
import { createServer, type IncomingMessage } from "node:http";
import { Stats } from "./stats";
import { passConfigFromEnv, isAllowedOrigin, PassRegistry } from "./pass";
import { ThemeStore, designAllowed } from "./theme";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  // room
  createInitialState,
  reduce,
  connectedPlayers,
  passActive,
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
  GAME_REGISTRY,
  isCloseGuess,
  BOMBE_COUNTDOWN_MS,
  setBombeDictionary,
  bombeDictSize,
  setMimicSounds,
  parseMimicSounds,
  mimicSoundCount,
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
  type SoireeItem,
  type SoireeState,
  createSoiree,
  recordGame,
  nextGame,
  skipGame,
  isRecorded,
  withPlayers,
  voteRematch,
  gameInfo,
  parseWhoisQuestions,
  addCustomWhoisQuestions,
  whoisBankSize,
  funnyPromptBank,
  addCustomFunnyPrompts,
  parseImposterPairs,
  addCustomImposterPairs,
  imposterBankSize,
  addCustomPhonePhrases,
  parseTabooCards,
  addCustomTabooCards,
  tabooBank,
  phonePhraseBank,
  setCustomWords,
  addCustomQuestions,
  parseCustomQuestions,
  addCustomRecoItems,
  parseCustomRecoItems,
  setCustomDoublageVideos,
  parseDoublageScenes,
} from "@subtitles-party/shared";

const PORT = Number(process.env.PORT ?? 1999);

// Load custom drawing words from motdessin/mots.txt (one word per line; lines
// starting with # are ignored). If present & non-empty, they replace the
// built-in word bank for Draw & Guess. Looked up from a few likely locations
// so it works whether the server runs from the repo root or elsewhere.
(() => {
  const dirs = [
    resolve(process.cwd(), "motdessin"),
    resolve(process.cwd(), "..", "motdessin"),
    resolve(__dirname, "..", "motdessin"),
  ];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      // Read EVERY .txt in the folder, whatever it's named.
      const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".txt"));
      if (!files.length) continue;
      const words: string[] = [];
      for (const f of files) words.push(...readFileSync(resolve(dir, f), "utf8").split(/\r?\n/));
      setCustomWords(words);
      const kept = words.map((w) => w.trim()).filter((w) => w && !w.startsWith("#")).length;
      if (kept > 0) console.log(`[motdessin] ${kept} mots personnalisés chargés (${files.join(", ")})`);
      return;
    } catch {
      /* ignore and try next */
    }
  }
})();

// Load custom quiz questions from questionquizz/questions.txt (added to the
// built-in bank, never replacing). Format: "Question ? = réponse | alias1 | alias2".
(() => {
  const dirs = [
    resolve(process.cwd(), "questionquizz"),
    resolve(process.cwd(), "..", "questionquizz"),
    resolve(__dirname, "..", "questionquizz"),
  ];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".txt"));
      if (!files.length) continue;
      const text = files.map((f) => readFileSync(resolve(dir, f), "utf8")).join("\n");
      const parsed = parseCustomQuestions(text);
      if (!parsed.length) continue; // fichier vide → on n'écrase rien
      addCustomQuestions(parsed);
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).length;
      console.log(`[questionquizz] ${parsed.length} questions chargées sur ${lines} lignes (${files.join(", ")})`);
      if (parsed.length < lines) {
        console.log(`[questionquizz] ⚠ ${lines - parsed.length} ligne(s) ignorée(s) : il manque le « = réponse ». Format attendu : Question ? = réponse | alias`);
      }
      return;
    } catch {
      /* ignore and try next */
    }
  }
})();

// Load custom picture subjects: the host drops images in apps/web/public/reco/
// and describes each one in a .txt of that same folder. ADDITIVE.
(() => {
  const dirs = [
    resolve(process.cwd(), "apps", "web", "public", "reco"),
    resolve(process.cwd(), "..", "apps", "web", "public", "reco"),
    resolve(__dirname, "..", "apps", "web", "public", "reco"),
  ];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      // Only the manifest is read (README.txt holds examples, not real entries).
      const txts = readdirSync(dir).filter(
        (f) => f.toLowerCase().endsWith(".txt") && f.toLowerCase() !== "readme.txt",
      );
      if (!txts.length) continue;
      const text = txts.map((f) => readFileSync(resolve(dir, f), "utf8")).join("\n");
      const items = parseCustomRecoItems(text);
      if (!items.length) continue; // manifeste vide → on n'écrase rien
      addCustomRecoItems(items);
      // Warn about lines pointing at a file that isn't there (typo in the name).
      const present = new Set(readdirSync(dir).map((f) => f.toLowerCase()));
      const missing = items
        .map((i) => (i.img ?? "").split("/").pop() ?? "")
        .filter((f) => f && !present.has(f.toLowerCase()));
      if (items.length) console.log(`[reco-images] ${items.length} sujet(s) perso chargé(s) (${txts.join(", ")})`);
      if (missing.length) console.log(`[reco-images] ⚠ fichier(s) introuvable(s) dans public/reco/ : ${missing.join(", ")}`);
      return;
    } catch {
      /* ignore and try next */
    }
  }
})();

// Load dubbing scenes from apps/web/public/doublage/scenes.txt (videos live in
// that same folder). No built-in test scenes any more.
(() => {
  const dirs = [
    resolve(process.cwd(), "apps", "web", "public", "doublage"),
    resolve(process.cwd(), "..", "apps", "web", "public", "doublage"),
    resolve(__dirname, "..", "apps", "web", "public", "doublage"),
  ];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      const txts = readdirSync(dir).filter(
        (f) => f.toLowerCase().endsWith(".txt") && f.toLowerCase() !== "readme.txt",
      );
      if (!txts.length) continue;
      const text = txts.map((f) => readFileSync(resolve(dir, f), "utf8")).join("\n");
      const scenes = parseDoublageScenes(text);
      if (!scenes.length) continue; // manifeste vide → on n'écrase rien
      setCustomDoublageVideos(scenes);
      const present = new Set(readdirSync(dir).map((f) => f.toLowerCase()));
      const missing = scenes
        .map((v) => (v.src ?? "").split("/").pop() ?? "")
        .filter((f) => f && !present.has(f.toLowerCase()));
      if (scenes.length) console.log(`[doublage] ${scenes.length} scène(s) chargée(s) (${txts.join(", ")})`);
      if (missing.length) console.log(`[doublage] ⚠ vidéo(s) introuvable(s) dans public/doublage/ : ${missing.join(", ")}`);
      return;
    } catch {
      /* ignore and try next */
    }
  }
})();
// Load the French dictionary for the Bombe game from motbombe/*.txt (one word
// per line; lines starting with # are ignored). Looked up from a few likely
// locations so it works whether the server runs from the repo root or elsewhere.
(() => {
  const dirs = [
    resolve(process.cwd(), "motbombe"),
    resolve(process.cwd(), "..", "motbombe"),
    resolve(__dirname, "..", "motbombe"),
  ];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".txt") && f.toLowerCase() !== "readme.txt");
      if (!files.length) continue;
      // NB : on évite `push(...bigArray)` — étaler 300k+ éléments dépasse la
      // limite d'arguments de JS. `concat` n'a pas ce problème.
      let words: string[] = [];
      for (const f of files) words = words.concat(readFileSync(resolve(dir, f), "utf8").split(/\r?\n/));
      setBombeDictionary(words);
      console.log(`[motbombe] dictionnaire chargé : ${bombeDictSize()} mots (${files.join(", ")})`);
      return;
    } catch {
      /* ignore and try next */
    }
  }
  console.log(`[motbombe] aucun fichier motbombe/*.txt — dictionnaire de secours utilisé (${bombeDictSize()} mots)`);
})();

// Load the reference sounds for the Mimic game from apps/web/public/sounds/sounds.txt
// (manifest: "fichier.mp3 | Nom | catégorie"). Additive on top of the starter pack.
(() => {
  const dirs = [
    resolve(process.cwd(), "apps", "web", "public", "sounds"),
    resolve(process.cwd(), "..", "apps", "web", "public", "sounds"),
    resolve(__dirname, "..", "apps", "web", "public", "sounds"),
  ];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      const txts = readdirSync(dir).filter(
        (f) => f.toLowerCase().endsWith(".txt") && f.toLowerCase() !== "readme.txt",
      );
      if (!txts.length) continue;
      const text = txts.map((f) => readFileSync(resolve(dir, f), "utf8")).join("\n");
      const sounds = parseMimicSounds(text);
      if (!sounds.length) continue; // manifeste vide → on garde le pack de démarrage
      setMimicSounds(sounds);
      console.log(`[mimic-sounds] ${sounds.length} son(s) perso chargé(s) (${txts.join(", ")}) — total jouable: ${mimicSoundCount()}`);
      return;
    } catch {
      /* ignore and try next */
    }
  }
  console.log(`[mimic-sounds] aucun manifeste — pack de démarrage utilisé (${mimicSoundCount()} sons)`);
})();

// Questions perso de « Qui de nous ? » : quidenous/*.txt, une par ligne,
// au format « catégorie | question ». Ajoutées à la banque intégrée.
(() => {
  const dirs = [resolve(process.cwd(), "quidenous"), resolve(process.cwd(), "..", "quidenous"), resolve(__dirname, "..", "quidenous")];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".txt") && f.toLowerCase() !== "readme.txt");
      if (!files.length) continue;
      const qs = parseWhoisQuestions(files.map((f) => readFileSync(resolve(dir, f), "utf8")).join("\n"));
      if (!qs.length) continue;
      addCustomWhoisQuestions(qs);
      console.log(`[quidenous] ${qs.length} question(s) perso chargée(s) (${files.join(", ")}) — total : ${whoisBankSize()}`);
      return;
    } catch {
      /* ignore and try next */
    }
  }
})();

// Phrases perso de « La Plus Drôle » : plusdrole/*.txt, une par ligne
// (« ___ » marque le trou ; sans trou, il est ajouté à la fin).
(() => {
  const dirs = [resolve(process.cwd(), "plusdrole"), resolve(process.cwd(), "..", "plusdrole"), resolve(__dirname, "..", "plusdrole")];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".txt") && f.toLowerCase() !== "readme.txt");
      if (!files.length) continue;
      const before = funnyPromptBank().length;
      addCustomFunnyPrompts(files.map((f) => readFileSync(resolve(dir, f), "utf8")).join("\n").split(/\r?\n/));
      const added = funnyPromptBank().length - before;
      if (added > 0) console.log(`[plusdrole] ${added} phrase(s) perso chargée(s) (${files.join(", ")})`);
      return;
    } catch {
      /* ignore and try next */
    }
  }
})();

// Mots perso de l'« Imposteur » : imposteur/*.txt, une paire par ligne,
// au format « catégorie | mot | mot proche ».
(() => {
  const dirs = [resolve(process.cwd(), "imposteur"), resolve(process.cwd(), "..", "imposteur"), resolve(__dirname, "..", "imposteur")];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".txt") && f.toLowerCase() !== "readme.txt");
      if (!files.length) continue;
      const pairs = parseImposterPairs(files.map((f) => readFileSync(resolve(dir, f), "utf8")).join("\n"));
      if (!pairs.length) continue;
      addCustomImposterPairs(pairs);
      console.log(`[imposteur] ${pairs.length} paire(s) perso chargée(s) (${files.join(", ")}) — total : ${imposterBankSize()}`);
      return;
    } catch {
      /* ignore and try next */
    }
  }
})();

// Phrases de départ perso du « Téléphone cassé » : telephone/*.txt, une par ligne.
(() => {
  const dirs = [resolve(process.cwd(), "telephone"), resolve(process.cwd(), "..", "telephone"), resolve(__dirname, "..", "telephone")];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".txt") && f.toLowerCase() !== "readme.txt");
      if (!files.length) continue;
      const before = phonePhraseBank().length;
      addCustomPhonePhrases(files.map((f) => readFileSync(resolve(dir, f), "utf8")).join("\n").split(/\r?\n/));
      const added = phonePhraseBank().length - before;
      if (added > 0) console.log(`[telephone] ${added} phrase(s) perso chargée(s) (${files.join(", ")})`);
      return;
    } catch {
      /* ignore and try next */
    }
  }
})();

// Cartes perso du « Mot interdit » : motinterdit/*.txt, « mot | interdit, interdit… ».
(() => {
  const dirs = [resolve(process.cwd(), "motinterdit"), resolve(process.cwd(), "..", "motinterdit"), resolve(__dirname, "..", "motinterdit")];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".txt") && f.toLowerCase() !== "readme.txt");
      if (!files.length) continue;
      const cards = parseTabooCards(files.map((f) => readFileSync(resolve(dir, f), "utf8")).join("\n"));
      if (!cards.length) continue;
      addCustomTabooCards(cards);
      console.log(`[motinterdit] ${cards.length} carte(s) perso chargée(s) (${files.join(", ")}) — total : ${tabooBank().length}`);
      return;
    } catch {
      /* ignore and try next */
    }
  }
})();

const GRACE_MS = 45_000;
/** Taille max d'une prise vocale (base64) relayée dans le mode Mimic. */
const MAX_TAKE_BYTES = 260_000;

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
  mimicTakes: Map<string, string>; // mimic: `${round}:${playerId}` -> base64 audio (for playback + reconnection)
  pendingSettings: unknown; // settings for a generic game, from start_game
  relayTimers: NodeJS.Timeout[]; // active-drawer rotation timers (relay)
  settings: GameSettings; // host-chosen lobby settings, applied at start
  pendingGame: string | null; // selection previewed to guests
  pendingSoiree: string[]; // soirée programme previewed to guests
  sockets: Map<string, WebSocket>;
  pruneTimers: Map<string, NodeJS.Timeout>;
  gameTimer: NodeJS.Timeout | null;
  /** Compteur de parties lancées dans ce salon (une revanche = nouvelle partie). */
  gameRun: number;
  /** Soirée LeBoum en cours (enchaînement de jeux + score global). */
  soiree: SoireeState | null;
  /** Partie (`gameRun`) lancée par la soirée : seule celle-ci compte au score. */
  soireeRun: number;
}

/** Registre des jeux hébergés génériquement : source unique dans
 *  packages/shared/src/platform/registry.ts (Sous-titres garde son chemin dédié). */
const gameCtx = (): GameContext => ({ now: Date.now(), rng: Math.random });
/** Durée de l'écran d'annonce « prochain jeu » côté client (GameIntro, 4,2 s).
 *  Le premier chrono de chaque jeu démarre APRÈS cette annonce : sinon la
 *  1re question / le 1er tour perdait ~4 s caché sous l'overlay. */
const INTRO_MS = 4200;
/** Boum Rush a déjà son propre décompte 3-2-1 : on le cale pour qu'il se
 *  termine pile à la fin de l'annonce, sans enchaîner deux décomptes. */
const introOffsetFor = (id: string) => (id === "bombe" ? Math.max(0, INTRO_MS - BOMBE_COUNTDOWN_MS) : INTRO_MS);

const rooms = new Map<string, Room>();

// Statistiques anonymes (voir server/stats.ts). Fichier optionnel : STATS_FILE.
const stats = new Stats(process.env.STATS_FILE ?? resolve(process.cwd(), "data/stats.json"));
setInterval(() => stats.flush(), 60_000).unref();

// Thème du site, réglé depuis /design (voir server/theme.ts).
const themeStore = new ThemeStore(process.env.THEME_FILE ?? resolve(process.cwd(), "data/theme.json"));

// Pass Soirée (voir server/pass.ts). Désactivé tant que Stripe n'est pas configuré.
const pass = passConfigFromEnv(process.env);
const passRegistry = new PassRegistry(process.env.PASS_FILE ?? resolve(process.cwd(), "data/passes.json"));
if (pass.config.mode === "fake") console.log("  [pass] ⚠ paiement SIMULÉ (PASS_DEV_FAKE=1) — jamais en production");

/** Look up a room. Creation only happens when `allowCreate` is true, i.e. when
 *  the client came from the "Créer un salon" flow on the home page. Typing a
 *  random code in the URL must NOT conjure a new room out of thin air. */
function getRoom(code: string, allowCreate = false): Room | null {
  let room = rooms.get(code);
  if (!room) {
    if (!allowCreate) return null;
    room = {
      state: createInitialState(code, Date.now()),
      game: null,
      tokens: null,
      twists: [],
      mod: null,
      strokes: [],
      mimicTakes: new Map(),
      pendingSettings: null,
      relayTimers: [],
      settings: DEFAULT_GAME_SETTINGS,
      pendingGame: null,
      pendingSoiree: [],
      sockets: new Map(),
      pruneTimers: new Map(),
      gameTimer: null,
      gameRun: 0,
      soiree: null,
      soireeRun: -1,
    };
    rooms.set(code, room);
    stats.roomCreated();
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

/** La partie en cours est-elle terminée (écran de résultats final) ? */
function gameIsOver(room: Room): boolean {
  if (room.game) return room.game.phase === "scoreboard";
  if (room.mod) return room.mod.module.isOver(room.mod.state);
  return false;
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

/** Boum Dessin — ne fais jamais attendre le chrono pour rien : dès que TOUS les
 *  devineurs *connectés* ont trouvé le mot, on révèle immédiatement. Le moteur
 *  pur ne connaît pas la présence (il compterait un joueur déconnecté en fenêtre
 *  de grâce et laisserait tourner le chrono), donc on le vérifie ici, côté
 *  adaptateur — même logique que `maybeAdvanceForPresence` pour les sous-titres. */
function maybeAdvanceDrawForPresence(room: Room) {
  if (!room.mod || room.mod.module.id !== "draw") return;
  const s = room.mod.state as DrawState;
  if (s.phase !== "drawing") return;
  const connected = new Set(connectedPlayers(room.state).map((p) => p.id));
  if (connected.size <= 1) return; // le dessinateur seul : le chrono/quitte s'en charge
  const pending = s.players.filter(
    (p) => p.id !== s.drawerId && connected.has(p.id) && s.guessedAt[p.id] == null,
  );
  if (pending.length === 0) advanceGame(room, Date.now());
}

/** Mauvaise proposition au dessin : diffusée en chat… sauf si elle est presque
 *  juste (« rugbi » pour « rugby ») — elle donnerait alors le mot aux autres.
 *  Dans ce cas, seul l'auteur voit son texte + « tu chauffes » ; les autres
 *  voient juste que ce joueur chauffe. */
function relayWrongGuess(room: Room, playerId: string, name: string, text: string, word: string | null | undefined, ws: WebSocket) {
  if (!word || !isCloseGuess(text, word)) {
    relay(room, { type: "chat", from: playerId, name, text, kind: "guess" });
    return;
  }
  const others = JSON.stringify({ type: "chat", from: playerId, name, text: `🔥 ${name} chauffe…`, kind: "system" } satisfies ServerMessage);
  for (const [pid, sock] of room.sockets) {
    if (sock.readyState !== WebSocket.OPEN) continue;
    if (pid === playerId) {
      sock.send(JSON.stringify({ type: "chat", from: playerId, name, text, kind: "guess" } satisfies ServerMessage));
      sock.send(JSON.stringify({ type: "chat", from: playerId, name, text: `🔥 « ${text} » : tu chauffes !`, kind: "system" } satisfies ServerMessage));
    } else sock.send(others);
  }
  void ws;
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
    relayWrongGuess(room, playerId, name, text, after.word, ws);
  }
  // Dernier devineur connecté à trouver → on révèle sans attendre le chrono.
  if (!wasGuessed && after.guessedAt[playerId] != null) maybeAdvanceDrawForPresence(room);
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
    relayWrongGuess(room, playerId, name, text, after.word, ws);
  }
}

// --- transport --------------------------------------------------------------

// --- Soirée LeBoum -------------------------------------------------------------

/** Vue publique de la soirée : sans les réglages de lancement (inutiles aux clients). */
function publicSoiree(room: Room): SoireeState | null {
  const s = room.soiree;
  return s ? { ...s, items: s.items.map((i) => ({ gameId: i.gameId })) } : null;
}

/** Tient la soirée à jour : nouveaux joueurs, et résultat du jeu dès qu'il se termine. */
function syncSoiree(room: Room) {
  if (!room.soiree) return;
  room.soiree = withPlayers(room.soiree, gameRoster(room));
  const s = room.soiree;
  if (s.finished || !room.mod || room.gameRun !== room.soireeRun) return;
  if (!room.mod.module.isOver(room.mod.state) || isRecorded(s, s.current, room.gameRun)) return;
  const result = room.mod.module.results(room.mod.state);
  if (!result) return;
  const players = (room.mod.state as { players?: GamePlayer[] }).players ?? gameRoster(room);
  room.soiree = recordGame(s, s.current, room.gameRun, room.mod.module.id, result, players);
}

/** Arrête la partie en cours et ramène tout le monde au salon. */
function stopGameToLobby(room: Room) {
  if (room.gameTimer) {
    clearTimeout(room.gameTimer);
    room.gameTimer = null;
  }
  room.game = null;
  room.tokens = null;
  room.mod = null;
  room.strokes = [];
  room.mimicTakes.clear();
  clearSwaps(room);
  // On revient de jouer ensemble : les joueurs connectés restent « prêts »
  // (pas besoin de re-cliquer entre deux parties). Changer de jeu dans le
  // salon les dé-prête côté client (SPEC §4).
  const players = Object.fromEntries(
    Object.entries(room.state.players).map(([id, p]) => [id, { ...p, isReady: p.isConnected }]),
  );
  room.state = { ...room.state, phase: "lobby", gameId: null, players };
}

/** Lance le jeu courant du programme. Un jeu injouable (trop ou pas assez de
 *  joueurs) est sauté avec un message ; après le dernier, retour au salon
 *  pour le classement final. */
function launchSoireeItem(room: Room, sender?: WebSocket, skipReady = false) {
  let s = room.soiree;
  if (!s) return;
  const count = connectedPlayers(room.state).length;
  while (!s.finished) {
    const item = s.items[s.current];
    const mod = item ? GAME_REGISTRY[item.gameId] : undefined;
    if (mod && count >= mod.meta.minPlayers && count <= mod.meta.maxPlayers) break;
    if (item) {
      const info = gameInfo(item.gameId);
      relay(room, { type: "chat", from: "*", name: "LeBoum", text: `${info.name} passé : il faut ${info.minPlayers} à ${info.maxPlayers} joueurs.`, kind: "system" });
    }
    s = skipGame(s);
  }
  room.soiree = s;
  if (s.finished) {
    if (room.state.phase !== "lobby") stopGameToLobby(room);
    broadcast(room);
    return;
  }
  const item = s.items[s.current];
  room.pendingSettings = item.settings ?? null;
  if (room.state.phase === "lobby") {
    const hostId = room.state.hostId;
    if (!hostId) return;
    // Soirée déjà commencée (reprise, revanche) : la tablée est là, on ne
    // redemande pas « prêt » à chacun entre deux jeux.
    if (skipReady) {
      const players = Object.fromEntries(
        Object.entries(room.state.players).map(([id, p]) => [id, p.isConnected ? { ...p, isReady: true } : p]),
      );
      room.state = { ...room.state, players };
    }
    applyRoom(room, { type: "start_game", playerId: hostId, gameId: item.gameId, now: Date.now() }, sender);
    if ((room.state.phase as string) === "in_game") room.soireeRun = room.gameRun;
    broadcast(room);
    return;
  }
  // Déjà en jeu : on enchaîne directement, sans repasser par le salon.
  room.game = null;
  room.tokens = null;
  room.state = { ...room.state, gameId: item.gameId };
  startGame(room);
  room.soireeRun = room.gameRun;
  broadcast(room);
}

/** Valide un programme de soirée envoyé par un client. */
function sanitizeSoireeItems(input: unknown): SoireeItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((i): i is SoireeItem => !!i && typeof (i as SoireeItem).gameId === "string" && !!GAME_REGISTRY[(i as SoireeItem).gameId])
    .slice(0, 12)
    .map((i) => ({ gameId: i.gameId, settings: i.settings ?? null }));
}

function stateMessageFor(room: Room, pid: string): ServerMessage {
  const { gameId, game } = projectAny(room, pid);
  return {
    type: "state",
    state: room.state,
    gameId,
    game,
    settings: room.settings,
    pendingGame: room.pendingGame,
    pendingSoiree: room.pendingSoiree,
    gameOver: gameIsOver(room),
    gameRun: room.gameRun,
    soiree: publicSoiree(room),
    serverTime: Date.now(),
    you: pid,
  };
}

function broadcast(room: Room) {
  syncSoiree(room);
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

function gameRoster(room: Room): GamePlayer[] {
  return connectedPlayers(room.state).map((p) => ({ id: p.id, name: p.name, color: p.color, avatar: p.avatar ?? null }));
}

function startGame(room: Room) {
  clearSwaps(room);
  room.gameRun++;
  const players: GamePlayer[] = connectedPlayers(room.state).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    avatar: p.avatar ?? null,
  }));

  // Generic games (draw, …) are hosted through the platform contract.
  const gameId = room.state.gameId;
  stats.gameStarted(gameId ?? "subtitles", players.length);
  const mod = gameId ? GAME_REGISTRY[gameId] : undefined;
  if (mod) {
    room.game = null;
    room.tokens = null;
    room.strokes = [];
    room.mimicTakes.clear();
    const settings = mod.sanitizeSettings(room.pendingSettings ?? undefined);
    // Bonus réservés au Pass Soirée : retirés si le salon n'a pas de pass actif.
    if (!passActive(room.state, Date.now()) && settings && typeof settings === "object") {
      delete (settings as { roomQuestions?: string }).roomQuestions;
    }
    room.mod = { module: mod, state: mod.createState(players, settings, { now: Date.now() + introOffsetFor(mod.id), rng: Math.random }) };
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
    try {
      advanceGame(room, Date.now());
    } catch (err) {
      console.error(`[room ${room.state.code}] minuteur :`, (err as Error)?.message ?? err);
    }
  }, delay);
}

async function readBody(req: IncomingMessage, max = 4096): Promise<string> {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > max) throw new Error("trop gros");
  }
  return data;
}

async function handleCheckout(req: IncomingMessage, res: import("node:http").ServerResponse) {
  const fail = (status: number, error: string) => res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error }));
  if (req.method !== "POST") return fail(405, "POST attendu");
  if (!pass.provider) return fail(503, "Le Pass Soirée n'est pas encore disponible.");
  try {
    const { room, origin } = JSON.parse(await readBody(req)) as { room?: string; origin?: string };
    const code = String(room ?? "").toUpperCase();
    if (!rooms.has(code)) return fail(404, "Salon introuvable.");
    const back = String(origin ?? "");
    if (!isAllowedOrigin(back, process.env.PUBLIC_SITE_URL)) return fail(400, "Origine non autorisée.");
    const { url } = await pass.provider.createCheckout(code, back);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ url }));
  } catch (e) {
    console.warn("[pass] checkout :", (e as Error).message);
    fail(502, "Impossible d'ouvrir le paiement pour le moment.");
  }
}

/** Active un paiement vérifié sur le salon. */
async function redeemPass(room: Room, playerId: string, sessionId: string, ws: WebSocket) {
  if (!pass.provider || typeof sessionId !== "string" || sessionId.length > 300) return;
  const code = room.state.code;
  try {
    const v = await pass.provider.verify(sessionId);
    if (!v.paid) return sendError(ws, "pass_unpaid", "Paiement non confirmé. Si tu as été débité, écris-nous.");
    if (v.room && v.room !== code && rooms.has(v.room)) return sendError(ws, "pass_other_room", "Ce Pass Soirée appartient à un autre salon.");
    const r = passRegistry.redeem(sessionId, code, Date.now(), (c) => rooms.has(c));
    if ("refused" in r) return sendError(ws, "pass_refused", r.refused);
    const name = room.state.players[playerId]?.name ?? null;
    applyRoom(room, { type: "activate_pass", until: r.until, offeredBy: name, now: Date.now() });
    if (r.fresh) stats.passActivated();
  } catch (e) {
    console.warn("[pass] vérification :", (e as Error).message);
    sendError(ws, "pass_error", "Vérification du paiement impossible pour le moment, réessaie dans un instant.");
  }
}

/** Éditeur de design : connexion et publication du thème. */
async function handleTheme(req: IncomingMessage, res: import("node:http").ServerResponse, login: boolean) {
  const send = (status: number, body: unknown) => res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(body));
  if (req.method !== "POST") return send(405, { error: "POST attendu" });
  try {
    const body = JSON.parse(await readBody(req, 64_000)) as { token?: unknown; theme?: unknown };
    const configured = process.env.DESIGN_TOKEN || process.env.STATS_TOKEN || undefined;
    if (!designAllowed(body.token, configured, req.socket.remoteAddress)) {
      return send(403, { error: configured ? "Code incorrect." : "Aucun code configuré : ajoute DESIGN_TOKEN sur le serveur de jeu." });
    }
    if (login) return send(200, { ok: true });
    const saved = themeStore.set(body.theme, Date.now());
    if (!saved) return send(400, { error: "Thème invalide." });
    console.log("[theme] nouveau thème publié");
    return send(200, saved);
  } catch {
    return send(400, { error: "Requête invalide." });
  }
}

// Serveur HTTP : santé + statistiques ; la même porte accueille le WebSocket.
const httpServer = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
    return;
  }
  if (url.pathname === "/pass/config") {
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ enabled: pass.config.enabled, priceLabel: pass.config.priceLabel }));
    return;
  }
  if (url.pathname === "/pass/checkout") {
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" }).end();
      return;
    }
    void handleCheckout(req, res);
    return;
  }
  if (url.pathname === "/theme" || url.pathname === "/theme/login") {
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" }).end();
      return;
    }
    if (url.pathname === "/theme" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" }).end(JSON.stringify(themeStore.get()));
      return;
    }
    void handleTheme(req, res, url.pathname === "/theme/login");
    return;
  }
  if (url.pathname === "/stats") {
    const token = process.env.STATS_TOKEN;
    if (!token || url.searchParams.get("token") !== token) {
      res.writeHead(token ? 403 : 404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: token ? "mauvais code" : "STATS_TOKEN non configuré" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(stats.snapshot(rooms.size)));
    return;
  }
  res.writeHead(426, { "Content-Type": "text/plain" }).end("Serveur de jeu LeBoum — connexion WebSocket attendue.");
});
const wss = new WebSocketServer({ server: httpServer });
httpServer.listen(PORT);
const flushAndExit = () => { stats.flush(); process.exit(0); };
process.on("SIGTERM", flushAndExit);
// Filet de sécurité : une erreur imprévue (minuteur, jeu…) est journalisée sans
// faire tomber le serveur — sinon tous les salons en cours seraient perdus.
process.on("uncaughtException", (err) => console.error("[serveur] erreur non gérée :", err));
process.on("unhandledRejection", (err) => console.error("[serveur] promesse rejetée :", err));
process.on("SIGINT", flushAndExit);

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const params = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
  const code = (params.get("room") ?? "").toUpperCase();
  const playerId = params.get("id") ?? "";
  if (!code || !playerId) {
    ws.close(1008, "room et id requis");
    return;
  }

  // Only the "create a room" flow (home page) may bring a room into existence.
  const allowCreate = params.get("create") === "1";
  const room = getRoom(code, allowCreate);
  if (!room) {
    ws.send(JSON.stringify({ type: "error", code: "room_not_found", message: "Ce salon n'existe pas. Crée un salon depuis l'accueil." }));
    ws.close(4004, "salon introuvable");
    return;
  }

  const timer = room.pruneTimers.get(playerId);
  if (timer) {
    clearTimeout(timer);
    room.pruneTimers.delete(playerId);
  }

  const previous = room.sockets.get(playerId);
  if (previous && previous !== ws) previous.close(4000, "remplacé");
  room.sockets.set(playerId, ws);
  stats.connected();
  ws.once("close", () => stats.disconnected());

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
  // Replay buffered voice takes (Mimic) so a (re)connecting client can play them.
  if (room.mod && room.mod.module.id === "mimic") {
    for (const [key, audio] of room.mimicTakes) {
      const sep = key.indexOf(":");
      const round = Number(key.slice(0, sep)) || 0;
      const from = key.slice(sep + 1);
      const m: ServerMessage = { type: "voice_take", round, from, audio };
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
    try {
    switch (msg.type) {
      case "join": {
        applyRoom(room, { type: "join", playerId, name: msg.name, now: t }, ws);
        stats.playerSeen(playerId);
        // A game is already running → fold the newcomer into its roster so they
        // can play immediately (no more "ghost player" whose guesses don't count).
        if (room.mod && room.state.phase !== "lobby") {
          applyMod(room, { type: "presence", connectedIds: connectedPlayers(room.state).map((p) => p.id), players: gameRoster(room) });
        }
        return;
      }
      case "redeem_pass":
        void redeemPass(room, playerId, msg.sessionId, ws);
        return;
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
      case "set_pending_game": {
        if (playerId !== room.state.hostId || room.state.phase !== "lobby") return;
        room.pendingGame = typeof msg.gameId === "string" ? msg.gameId : null;
        room.pendingSoiree = Array.isArray(msg.soiree) ? msg.soiree.filter((g): g is string => typeof g === "string" && !!GAME_REGISTRY[g]).slice(0, 12) : [];
        return broadcast(room);
      }
      case "start_game": {
        // Limite propre à un jeu (Mimic : 8 voix max), même avec le Pass Soirée.
        const gameMax = GAME_REGISTRY[msg.gameId]?.meta.maxPlayers;
        if (gameMax && connectedPlayers(room.state).length > gameMax) {
          return sendError(ws, "too_many_players", `Ce jeu se joue à ${gameMax} joueurs maximum.`);
        }
        room.pendingSettings = msg.settings ?? null;
        return applyRoom(room, { type: "start_game", playerId, gameId: msg.gameId, now: t }, ws);
      }

      case "game": {
        // Message de jeu : toujours un objet avec un `kind` texte, sinon ignoré.
        const raw = (msg as { action?: unknown }).action;
        if (!raw || typeof raw !== "object" || Array.isArray(raw) || typeof (raw as { kind?: unknown }).kind !== "string") return;
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
        // En soirée, le résultat d'un jeu terminé est déjà compté (syncSoiree).
        if (playerId !== room.state.hostId) return;
        syncSoiree(room);
        stopGameToLobby(room);
        return broadcast(room);
      }

      case "soiree_start": {
        // Hôte, depuis le salon : lance une soirée (plusieurs jeux enchaînés).
        if (playerId !== room.state.hostId || room.state.phase !== "lobby") return;
        const items = sanitizeSoireeItems(msg.items);
        if (items.length === 0) return sendError(ws, "soiree_empty", "Ajoute au moins un jeu à ta soirée.");
        room.soiree = withPlayers(createSoiree(items, t), gameRoster(room));
        return launchSoireeItem(room, ws);
      }

      case "soiree_next": {
        // Hôte : jeu suivant (depuis l'écran de fin d'un jeu ou depuis le salon).
        if (playerId !== room.state.hostId || !room.soiree || room.soiree.finished) return;
        syncSoiree(room);
        const s = room.soiree;
        // Un jeu abandonné en cours de route (non terminé) est rejoué depuis le salon,
        // mais sauté si l'hôte demande la suite pendant la partie.
        if (room.state.phase === "in_game" || isRecorded(s, s.current)) room.soiree = nextGame(s);
        return launchSoireeItem(room, ws, true);
      }

      case "soiree_rematch": {
        // Hôte : revanche — même programme, scores remis à zéro.
        if (playerId !== room.state.hostId || !room.soiree || room.state.phase !== "lobby") return;
        room.soiree = withPlayers(createSoiree(room.soiree.items, t), gameRoster(room));
        return launchSoireeItem(room, ws, true);
      }

      case "soiree_vote_rematch": {
        // N'importe quel joueur : « je veux la revanche ! » (l'hôte voit le compte et lance).
        if (!room.soiree?.finished || room.state.phase !== "lobby") return;
        room.soiree = voteRematch(room.soiree, playerId, msg.want !== false);
        return broadcast(room);
      }

      case "soiree_end": {
        // Hôte : termine / abandonne la soirée.
        if (playerId !== room.state.hostId) return;
        room.soiree = null;
        room.soireeRun = -1;
        if (room.state.phase !== "lobby") stopGameToLobby(room);
        return broadcast(room);
      }

      case "play_again": {
        // Host-only: immediately start a fresh game with the players currently
        // connected and the current settings — no trip back to the lobby.
        if (playerId !== room.state.hostId || room.state.phase !== "in_game") return;
        // En soirée, « Rejouer » est une revanche du jeu courant : son nouveau
        // résultat remplacera l'ancien (jamais de double comptage).
        const soireeGame = room.soiree && !room.soiree.finished && room.gameRun === room.soireeRun;
        startGame(room);
        if (soireeGame) room.soireeRun = room.gameRun;
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

      case "voice_take": {
        // Mimic: a player's recorded take. Buffered (for playback + reconnection)
        // and relayed to everyone. Heavy audio never enters the game state.
        if (!room.mod || room.mod.module.id !== "mimic") return;
        const audio = typeof msg.audio === "string" ? msg.audio : "";
        if (!audio || audio.length > MAX_TAKE_BYTES) return;
        const round = Number.isFinite(msg.round) ? Math.max(0, Math.floor(msg.round)) : 0;
        room.mimicTakes.set(`${round}:${playerId}`, audio);
        relay(room, { type: "voice_take", round, from: playerId, audio });
        return;
      }

      case "bombe_typing": {
        // Bombe: live preview of the active player's typing. Only relayed when it
        // comes from the current player; the text is a preview, never validated.
        if (!room.mod || room.mod.module.id !== "bombe") return;
        const st = room.mod.state as { currentId?: string | null };
        if (playerId !== st.currentId) return;
        const text = typeof msg.text === "string" ? msg.text.slice(0, 48) : "";
        relay(room, { type: "bombe_typing", from: playerId, text });
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
    } catch (err) {
      // Un message mal formé (ou un bug d'un jeu) ne doit JAMAIS faire tomber
      // le serveur entier : on l'ignore et on le journalise.
      console.error(`[room ${room.state.code}] message ignoré (${(msg as { type?: string }).type}) :`, (err as Error)?.message ?? err);
    }
  });

  ws.on("close", () => {
    if (room.sockets.get(playerId) !== ws) return;
    room.sockets.delete(playerId);
    applyRoom(room, { type: "disconnect", playerId, now: Date.now() });
    // If the game was only waiting on the player who just left, move on.
    maybeAdvanceForPresence(room);
    if (room.mod) {
      applyMod(room, { type: "presence", connectedIds: connectedPlayers(room.state).map((p) => p.id), players: gameRoster(room) });
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
