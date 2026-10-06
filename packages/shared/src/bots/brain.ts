// ---------------------------------------------------------------------------
// Bots de test — le « cerveau » d'un faux joueur.
//
// Utilisés seulement en local (panneau Admin de l'éditeur) pour tester les
// mini-jeux sans avoir besoin de 4 amis. Un bot regarde exactement ce qu'un
// vrai joueur verrait (la projection publique) et renvoie les MÊMES messages
// qu'un navigateur (`ClientMessage`) : le serveur les traite comme ceux d'un
// humain. Il a aussi le droit de « tricher » en lisant l'état interne (le mot
// à deviner, la bonne réponse…) pour trouver parfois — selon son niveau.
//
// Pur : pas d'horloge ni de hasard implicites (tout arrive par `BotView`).
// Les médias (dessin PNG, prise de voix) sont fournis par le serveur.
// ---------------------------------------------------------------------------

import type { ClientMessage } from "../protocol";
import type { PlayerId, RoomState } from "../room/types";
import type { PublicGameState } from "../game/types";
import { clipSlots } from "../game/types";
import type { DrawPublic, DrawState, DrawStroke } from "../games/draw/types";
import type { RelayPublic, RelayState } from "../games/relay/types";
import type { FakeArtistPublic } from "../games/fakeartist/types";
import type { QuizPublic, QuizState } from "../games/quiz/types";
import type { RecoPublic, RecoState } from "../games/reconnaissance/types";
import type { BombePublic, BombeState } from "../games/bombe/types";
import { bombeExampleWords } from "../games/bombe/dictionary";
import type { MimicPublic } from "../games/mimic/types";
import type { WhoisPublic } from "../games/whois/types";
import type { FunnyPublic } from "../games/funny/types";
import type { ImposterPublic, ImposterState } from "../games/imposter/types";
import type { PhonePublic } from "../games/phone/types";
import type { TabooPublic, TabooState } from "../games/taboo/types";
import type { YesNoPublic } from "../games/yesno/types";
import type { GuessWhoPublic, GuessWhoState } from "../games/guesswho/types";
import type { RankingPublic } from "../games/ranking/types";
import type { DoublagePublic } from "../games/doublage/types";
import { findForbidden } from "../platform/text";

/** Niveaux proposés dans le panneau Admin (probabilité de « bien jouer »). */
export const BOT_LEVELS = { facile: 0.25, normal: 0.55, fort: 0.85 } as const;
export type BotLevel = keyof typeof BOT_LEVELS;

export const BOT_NAMES = [
  "Momo", "Zazie", "Lulu", "Titi", "Gégé", "Kiki", "Riri", "Fifi", "Loulou", "Bibi", "Nono", "Pépette",
] as const;

/** Mémoire d'un bot : ses minuteries « je ferai ça dans X ms ». */
export interface BotMemory {
  timers: Map<string, number>;
  counts: Map<string, number>;
}
export function newBotMemory(): BotMemory {
  return { timers: new Map(), counts: new Map() };
}

/** Médias qu'un bot peut produire (fournis par le serveur : PNG, WAV…). */
export interface BotMedia {
  /** Un dessin `data:image/png;base64,…` (Téléphone cassé). */
  drawing(rng: () => number): string;
  /** Une prise de voix `data:audio/wav;base64,…` (Mimic). */
  voice(rng: () => number): string;
}

export interface BotView {
  botId: PlayerId;
  room: RoomState;
  /** null au salon. */
  gameId: string | null;
  /** Projection publique vue par le bot (comme un navigateur). */
  pub: unknown;
  /** État interne du jeu (le bot « triche » un peu selon son niveau). */
  internal: unknown;
  now: number;
  rng: () => number;
  /** 0..1 : probabilité de bien jouer. */
  skill: number;
  media: BotMedia;
}

// --- petites banques de textes ----------------------------------------------

const WRONG_WORDS = ["chat", "maison", "voiture", "soleil", "pizza", "arbre", "bateau", "chapeau", "banane", "robot", "fleur", "lune", "dragon", "guitare", "vélo", "ballon"];
const FUNNY = [
  "mon voisin en pyjama", "un pigeon très motivé", "la belle-mère de Batman", "une raclette à 3h du matin",
  "un hamster en crise existentielle", "le wifi du camping", "une chaussette orpheline", "Jean-Michel Apéro",
  "un canard qui fait du yoga", "la touche Entrée", "un croissant au jambon", "mon ex en trottinette",
];
const LINES = [
  "Tu as vu mes clés ?", "Je t'avais dit de pas toucher au gâteau !", "Ça sent le complot.", "On se calme, on respire.",
  "C'est pas moi, c'est le chat.", "Je reviens, je vais chercher du pain.", "Attends… t'es sérieux ?", "Plus jamais de karaoké.",
];
const PHRASES = [
  "Un chat qui fait du ski", "Une pizza qui s'envole", "Un robot amoureux d'un grille-pain", "Mamie au skatepark",
  "Un pirate qui a peur de l'eau", "Une licorne en retard au bureau", "Un dinosaure qui fait les courses", "La lune qui mange une glace",
];
const DESCRIPTIONS = [
  "Un truc rond avec des pattes", "On dirait un bonhomme qui court", "Une maison… ou un chapeau ?", "Je crois que c'est un animal",
  "Quelqu'un qui danse sous la pluie", "Un gribouillis très artistique", "Un soleil qui a l'air fâché", "Un vélo à trois roues",
];
const CLUES = ["rond", "quotidien", "pratique", "coloré", "grand", "petit", "dehors", "cuisine", "vacances", "enfance", "doux", "bruyant", "léger", "ancien"];
const YESNO_QUESTIONS = [
  "Tu aimes les frites ?", "T'as dormi cette nuit ?", "C'est ton vrai prénom ?", "Tu es d'accord avec moi ?",
  "Tu as faim là ?", "Tu sais nager ?", "T'es sûr ?", "Tu préfères le chocolat ?",
];
const YESNO_SAFE = ["Peut-être bien.", "Je ne dirai rien.", "Bonne question !", "Absolument pas d'avis.", "Ça dépend des jours.", "Mystère…"];
const YESNO_FATAL = ["Oui", "Non", "Ouais", "Bah non"];
const GUESSWHO_QUESTIONS = [
  "C'est un personnage de fiction ?", "C'est une femme ?", "Il ou elle est français ?", "C'est un sportif ?",
  "Il ou elle chante ?", "C'est un personnage de jeu vidéo ?", "Il ou elle est encore vivant ?", "C'est un super-héros ?",
  "On le voit à la télé ?", "Il ou elle est connu dans le monde entier ?",
];
const GUESSWHO_WRONG = ["Mario", "Zinédine Zidane", "Harry Potter", "Beyoncé", "Napoléon", "Shrek", "Batman"];
const STROKE_COLORS = ["#1B1B1F", "#E63946", "#2A9D8F", "#457B9D", "#F4A261", "#8E44AD"];

// --- outils -------------------------------------------------------------------

const pick = <T,>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];

/**
 * Minuterie : la 1re fois qu'on voit `key`, on programme une action dans
 * [min, max] ms. Renvoie vrai quand c'est l'heure, puis se ré-arme (nouvel
 * essai plus tard si la situation n'a pas changé — ex. vote refusé).
 */
function due(v: BotView, mem: BotMemory, key: string, min: number, max: number): boolean {
  const at = mem.timers.get(key);
  if (at == null) {
    mem.timers.set(key, v.now + min + v.rng() * Math.max(0, max - min));
    if (mem.timers.size > 400) {
      // On ne garde pas l'historique de toute la soirée.
      const keys = [...mem.timers.keys()].slice(0, 200);
      for (const k of keys) mem.timers.delete(k);
    }
    return false;
  }
  if (v.now < at) return false;
  mem.timers.set(key, v.now + Math.max(1200, min));
  return true;
}
function count(mem: BotMemory, key: string): number {
  const n = (mem.counts.get(key) ?? 0) + 1;
  mem.counts.set(key, n);
  if (mem.counts.size > 400) mem.counts.clear();
  return n;
}

const game = (action: unknown): ClientMessage => ({ type: "game", action } as ClientMessage);

/** Un trait de dessin aléatoire (ligne, boucle ou zigzag), coordonnées 0..1. */
export function botStroke(rng: () => number): DrawStroke {
  const cx = 0.15 + rng() * 0.7;
  const cy = 0.15 + rng() * 0.7;
  const r = 0.05 + rng() * 0.18;
  const shape = Math.floor(rng() * 3);
  const points: { x: number; y: number }[] = [];
  const clamp = (n: number) => Math.min(0.99, Math.max(0.01, n));
  if (shape === 0) {
    const a = rng() * Math.PI * 2;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10 - 0.5;
      points.push({ x: clamp(cx + Math.cos(a) * r * 2 * t), y: clamp(cy + Math.sin(a) * r * 2 * t + Math.sin(i) * 0.005) });
    }
  } else if (shape === 1) {
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      points.push({ x: clamp(cx + Math.cos(a) * r), y: clamp(cy + Math.sin(a) * r * 0.8) });
    }
  } else {
    for (let i = 0; i <= 8; i++) points.push({ x: clamp(cx - r + (i / 8) * r * 2), y: clamp(cy + (i % 2 ? r : -r) * 0.5) });
  }
  return { points, color: pick(rng, STROKE_COLORS), width: 6 + Math.floor(rng() * 10) };
}

// --- décision ---------------------------------------------------------------------

/** Ce que le bot veut faire maintenant (souvent rien : il « réfléchit »). */
export function botDecide(v: BotView, mem: BotMemory): ClientMessage[] {
  const me = v.room.players[v.botId];
  if (!me || !me.isConnected) return [];
  if (v.room.phase === "lobby" || !v.gameId || v.pub == null) {
    if (!me.isReady && due(v, mem, "lobby-ready", 400, 1400)) return [{ type: "set_ready", ready: true }];
    return [];
  }
  switch (v.gameId) {
    case "subtitles": return subtitles(v, mem);
    case "draw": return draw(v, mem);
    case "relay": return relay(v, mem);
    case "fakeartist": return fakeArtist(v, mem);
    case "quiz": return quiz(v, mem);
    case "reco":
    case "pixel": return reco(v, mem);
    case "bombe": return bombe(v, mem);
    case "mimic": return mimic(v, mem);
    case "whois": return whois(v, mem);
    case "funny": return funny(v, mem);
    case "imposter": return imposter(v, mem);
    case "phone": return phone(v, mem);
    case "taboo": return taboo(v, mem);
    case "yesno": return yesno(v, mem);
    case "guesswho": return guesswho(v, mem);
    case "ranking": return ranking(v, mem);
    case "doublage": return doublage(v, mem);
  }
  return [];
}

function others(v: BotView, ids: readonly PlayerId[]): PlayerId[] {
  return ids.filter((id) => id !== v.botId && v.room.players[id]);
}

function subtitles(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as PublicGameState;
  if (p.phase === "writing" && !p.youSubmitted && due(v, mem, `sub-w:${p.round}`, 3000, 9000)) {
    return [game({ kind: "submit", lines: clipSlots(p.clip).map(() => pick(v.rng, LINES)) })];
  }
  if (p.phase === "voting" && !p.yourVote && p.captions.length && due(v, mem, `sub-v:${p.round}`, 2000, 6000)) {
    const choices = p.captions.filter((c) => c.token !== p.yourToken);
    if (choices.length) return [game({ kind: "vote", token: pick(v.rng, choices).token })];
  }
  return [];
}

/** Devineur : propositions régulières, parfois le bon mot. */
function guessWord(v: BotView, mem: BotMemory, key: string, word: string | null | undefined): ClientMessage[] {
  if (!due(v, mem, key, 2500, 6000)) return [];
  const right = !!word && v.rng() < v.skill * 0.35;
  return [game({ kind: "guess", text: right ? word! : pick(v.rng, WRONG_WORDS) })];
}

function drawStrokes(v: BotView, mem: BotMemory, key: string, max: number): ClientMessage[] {
  if ((mem.counts.get(key) ?? 0) >= max || !due(v, mem, `${key}:t`, 700, 1800)) return [];
  count(mem, key);
  return [{ type: "draw_stroke", stroke: botStroke(v.rng) }];
}

function draw(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as DrawPublic;
  const s = v.internal as DrawState;
  const turn = `${p.round}:${p.turnInRound}`;
  if (p.phase === "choosing" && p.youAreDrawer && p.wordChoices?.length && due(v, mem, `dr-c:${turn}`, 1200, 3000)) {
    return [game({ kind: "choose_word", word: pick(v.rng, p.wordChoices) })];
  }
  if (p.phase !== "drawing") return [];
  if (p.youAreDrawer) return drawStrokes(v, mem, `dr-s:${turn}`, 18);
  if (!p.youGuessed) return guessWord(v, mem, `dr-g:${turn}`, s?.word);
  return [];
}

function relay(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as RelayPublic;
  const s = v.internal as RelayState;
  if (p.phase !== "drawing") return [];
  if (p.youAreActive) return drawStrokes(v, mem, `rl-s:${p.round}:${s?.pairStart}:${p.activeDrawerId}:${p.swapDeadline}`, 12);
  if (!p.youAreDrawer && !p.youGuessed) return guessWord(v, mem, `rl-g:${p.round}:${s?.pairStart}`, s?.word);
  return [];
}

function fakeArtist(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as FakeArtistPublic;
  if (p.phase === "drawing") return drawStrokes(v, mem, `fa-s:${p.round}`, 14);
  if (p.phase === "voting" && !p.yourVote && due(v, mem, `fa-v:${p.round}`, 1500, 5000)) {
    const targets = others(v, p.players.map((x) => x.id));
    if (targets.length) return [game({ kind: "vote", targetId: pick(v.rng, targets) })];
  }
  return [];
}

function quiz(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as QuizPublic;
  const s = v.internal as QuizState;
  if (p.phase !== "question" || p.yourAnswer != null || p.yourEliminated || !p.question) return [];
  const maxMs = Math.max(2000, p.secondsPerQuestion * 1000 * 0.6);
  if (!due(v, mem, `qz:${p.index}`, 1200, maxMs)) return [];
  const q = s?.questions?.[s.index];
  const right = v.rng() < v.skill;
  if (!q) return [game({ kind: "answer", value: 0 })];
  if (q.type === "mcq") {
    const wrong = q.choices.map((_, i) => i).filter((i) => i !== q.answer);
    return [game({ kind: "answer", value: right || !wrong.length ? q.answer : pick(v.rng, wrong) })];
  }
  if (q.type === "truefalse") return [game({ kind: "answer", value: right ? q.answer : !q.answer })];
  return [game({ kind: "answer", value: right ? q.answer : pick(v.rng, WRONG_WORDS) })];
}

function reco(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as RecoPublic;
  const s = v.internal as RecoState;
  if (p.phase !== "question" || p.yourAnswer != null || !p.item) return [];
  if (!due(v, mem, `rc:${p.index}`, 2000, Math.max(3000, p.secondsPerQuestion * 1000 * 0.6))) return [];
  const answer = s?.items?.[s.index]?.answer;
  return [game({ kind: "answer", value: answer && v.rng() < v.skill ? answer : pick(v.rng, WRONG_WORDS) })];
}

function bombe(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as BombePublic;
  const s = v.internal as BombeState;
  if (p.phase !== "playing" || !p.youAreCurrent) return [];
  const key = `bb:${p.turnStartedAt}:${p.syllable}`;
  if (!due(v, mem, key, 1500, 4500)) return [];
  // Assez souvent juste pour faire durer la partie, parfois à sec (explosion).
  if (v.rng() > Math.min(0.95, v.skill + 0.15)) {
    return count(mem, key) === 1 ? [{ type: "bombe_typing", text: "euh…" }] : [];
  }
  const word = bombeExampleWords(p.syllable, 1, v.rng, s?.usedWords ?? [])[0];
  if (!word) return [];
  return [{ type: "bombe_typing", text: word }, game({ kind: "submit", text: word })];
}

function mimic(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as MimicPublic;
  if (p.phase === "prep" && !p.ready[v.botId] && due(v, mem, "mm-ready", 500, 1500)) return [game({ kind: "ready", ready: true })];
  // Bot devenu hôte (plus aucun humain) : il lance la 1re manche.
  if (p.phase === "prep" && p.allReady && v.room.hostId === v.botId && due(v, mem, "mm-start", 1500, 3000)) return [game({ kind: "start" })];
  if (p.phase === "recording" && p.youActive && !p.youSubmitted && due(v, mem, `mm-r:${p.round}:${p.chainPos}:${p.duelNo}`, 1500, 3500)) {
    const closeness = Math.round(Math.min(97, Math.max(5, 20 + v.skill * 55 + (v.rng() - 0.5) * 40)));
    return [
      { type: "voice_take", round: p.round, audio: v.media.voice(v.rng) },
      game({ kind: "take_done", closeness }),
    ];
  }
  if (p.phase === "voting" && !p.yourVote && !p.autoOnly && due(v, mem, `mm-v:${p.round}:${p.duelNo}`, 1500, 4500)) {
    const pool = p.mode === "duel" ? p.activeIds : p.playbackOrder.length ? p.playbackOrder : p.players.map((x) => x.id);
    const targets = others(v, pool);
    if (targets.length) return [game({ kind: "vote", targetId: pick(v.rng, targets) })];
  }
  return [];
}

function whois(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as WhoisPublic;
  if (p.phase !== "question" || p.yourVote || !due(v, mem, `wh:${p.round}`, 1500, 5000)) return [];
  const targets = others(v, p.players.map((x) => x.id));
  return targets.length ? [game({ kind: "vote", targetId: pick(v.rng, targets) })] : [];
}

function funny(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as FunnyPublic;
  if (p.phase === "write" && p.yourAnswer == null && due(v, mem, `fn-w:${p.round}`, 3000, 9000)) {
    return [game({ kind: "answer", text: pick(v.rng, FUNNY).slice(0, p.maxChars || 80) })];
  }
  if (p.phase === "vote" && !p.yourVote && p.answers?.length && due(v, mem, `fn-v:${p.round}`, 2000, 6000)) {
    const choices = p.answers.filter((a) => a.token !== p.yourToken);
    if (choices.length) return [game({ kind: "vote", token: pick(v.rng, choices).token })];
  }
  return [];
}

function imposter(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as ImposterPublic;
  const s = v.internal as ImposterState;
  if (!p.roster.includes(v.botId)) return [];
  const r = p.round;
  if (p.phase === "secret" && !p.seenIds.includes(v.botId) && due(v, mem, `im-s:${r}`, 800, 2500)) return [game({ kind: "seen" })];
  if (p.phase === "clues" && p.currentId === v.botId && due(v, mem, `im-c:${r}:${p.pass}`, 2000, 5000)) {
    const own = (p.yourWord ?? "").toLowerCase();
    const options = CLUES.filter((c) => !own || !c.includes(own));
    return [game({ kind: "clue", text: pick(v.rng, options) })];
  }
  if (p.phase === "vote" && !p.yourVote && due(v, mem, `im-v:${r}`, 1500, 5000)) {
    const targets = others(v, p.roster);
    if (targets.length) return [game({ kind: "vote", targetId: pick(v.rng, targets) })];
  }
  if (p.phase === "guess" && s?.imposterId === v.botId && due(v, mem, `im-g:${r}`, 2000, 5000)) {
    const word = s.pairs?.[s.index]?.word;
    return [game({ kind: "guess", text: word && v.rng() < v.skill * 0.6 ? word : pick(v.rng, WRONG_WORDS) })];
  }
  return [];
}

function phone(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as PhonePublic;
  if (p.phase !== "play" || !p.task || p.yourContent != null) return [];
  if (!due(v, mem, `ph:${p.step}`, p.task.kind === "drawing" ? 4000 : 2500, p.task.kind === "drawing" ? 9000 : 7000)) return [];
  if (p.task.kind === "drawing") return [game({ kind: "submit", content: v.media.drawing(v.rng) })];
  return [game({ kind: "submit", content: pick(v.rng, p.task.first ? PHRASES : DESCRIPTIONS) })];
}

function taboo(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as TabooPublic;
  const s = v.internal as TabooState;
  const giver = p.giverId === v.botId;
  if (p.phase === "ready" && giver && due(v, mem, `tb-st:${p.turn}`, 1000, 2500)) return [game({ kind: "start" })];
  if (p.phase !== "turn") return [];
  const card = s?.current;
  const cardKey = `${p.turn}:${p.playedCount}`;
  if (p.mode === "ecrit") {
    if (giver && card && due(v, mem, `tb-c:${cardKey}`, 2500, 5000)) {
      const n = count(mem, `tb-cn:${cardKey}`);
      const hints = [
        `ça commence par « ${card.word[0]?.toUpperCase() ?? "?"} »`,
        `${card.word.replace(/\s+/g, "").length} lettres`,
        ...CLUES.filter((c) => !findForbidden(c, [card.word, ...card.forbidden])),
      ];
      const text = n <= 2 ? hints[n - 1] : pick(v.rng, hints.slice(2));
      if (findForbidden(text, [card.word, ...card.forbidden])) return [];
      return [game({ kind: "clue", text })];
    }
    if (!giver && card && due(v, mem, `tb-g:${cardKey}`, 3000, 7000)) {
      return [game({ kind: "guess", text: v.rng() < v.skill * 0.3 ? card.word : pick(v.rng, WRONG_WORDS) })];
    }
    return [];
  }
  // Oral : le donneur valide (ou passe) ; le censeur buzze de temps en temps.
  if (giver && due(v, mem, `tb-o:${cardKey}`, 4000, 9000)) {
    const finders = others(v, p.order).filter((id) => id !== p.censorId);
    if (finders.length && v.rng() < 0.7) return [game({ kind: "found", finderId: pick(v.rng, finders) })];
    return [game({ kind: "pass" })];
  }
  if (p.censorId === v.botId && due(v, mem, `tb-b:${cardKey}`, 5000, 9000) && v.rng() < 0.08) return [game({ kind: "buzz" })];
  return [];
}

function yesno(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as YesNoPublic;
  const target = p.targetId === v.botId;
  if (p.phase === "verdict" && !target && p.accuserId !== v.botId && p.yourVote == null && due(v, mem, `yn-v:${p.turn}:${p.accuserId}`, 1000, 3000)) {
    return [game({ kind: "verdict", said: v.rng() < 0.5 })];
  }
  if (p.phase !== "hot") return [];
  if (p.mode === "chat") {
    if (target) {
      const last = p.log[p.log.length - 1];
      if (last && last.from !== v.botId && due(v, mem, `yn-a:${p.turn}:${last.id}`, 1500, 4000)) {
        const slip = v.rng() < (1 - v.skill) * 0.35;
        return [game({ kind: "say", text: pick(v.rng, slip ? YESNO_FATAL : YESNO_SAFE) })];
      }
      return [];
    }
    if (due(v, mem, `yn-q:${p.turn}`, 3000, 7000)) return [game({ kind: "say", text: pick(v.rng, YESNO_QUESTIONS) })];
    return [];
  }
  // Mode voix : rarement « il l'a dit ! » (pour tester le vote éclair).
  if (!target && due(v, mem, `yn-acc:${p.turn}`, 6000, 12000) && v.rng() < 0.15) return [game({ kind: "accuse" })];
  return [];
}

function guesswho(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as GuessWhoPublic;
  const s = v.internal as GuessWhoState;
  const master = p.masterId === v.botId;
  if (p.phase === "secret" && master && due(v, mem, `gw-r:${p.round}`, 1500, 3500)) return [game({ kind: "ready" })];
  if (p.phase !== "ask") return [];
  if (master) {
    const q = p.questions.find((x) => x.answer == null);
    if (q && due(v, mem, `gw-a:${q.id}`, 1500, 3500)) {
      const r = v.rng();
      return [game({ kind: "answer", questionId: q.id, answer: r < 0.45 ? "oui" : r < 0.9 ? "non" : "nsp" })];
    }
    return [];
  }
  const answered = p.questions.filter((q) => q.answer === "oui" || q.answer === "non").length;
  const celeb = s?.celebrity?.name;
  if (celeb && answered >= 3 && due(v, mem, `gw-g:${p.round}`, 6000, 12000) && v.rng() < v.skill * 0.4) {
    return [game({ kind: "guess", text: celeb })];
  }
  const pending = p.questions.some((q) => q.askerId === v.botId && q.answer == null);
  if (!pending && p.left > 1 && due(v, mem, `gw-q:${p.round}`, 3500, 8000)) {
    if (v.rng() < 0.08) return [game({ kind: "guess", text: pick(v.rng, GUESSWHO_WRONG) })];
    return [game({ kind: "ask", text: pick(v.rng, GUESSWHO_QUESTIONS) })];
  }
  return [];
}

function ranking(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as RankingPublic;
  if (p.phase !== "order" || p.yourOrder || !due(v, mem, `rk:${p.round}`, 3000, 9000)) return [];
  const idx = p.items.map((_, i) => i);
  // Mode « savoir » : les éléments sont stockés dans le bon ordre.
  if (p.mode === "savoir" && v.rng() < v.skill * 0.6) return [game({ kind: "order", order: idx })];
  const order = [...(p.shuffled.length ? p.shuffled : idx)];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(v.rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return [game({ kind: "order", order })];
}

function doublage(v: BotView, mem: BotMemory): ClientMessage[] {
  const p = v.pub as DoublagePublic;
  if (p.phase === "prep" && !p.ready[v.botId] && due(v, mem, "db-ready", 600, 1800)) return [game({ kind: "ready", ready: true })];
  return [];
}
