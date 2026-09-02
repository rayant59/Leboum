// Run: npx tsx engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameAction, GameContext } from "../../platform/types";
import { createBombe, reduceBombe, projectBombe, bombeDeadline, bombeIsOver, bombeWordLetters, resolveBombeConfig } from "./engine";
import { setBombeDictionary, bombeNormalize, bombeSyllableCount } from "./dictionary";
import type { BombeClientAction, BombeState } from "./types";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  [32m✓[0m ${name}`);
  } catch (e) {
    failed++;
    console.log(`  [31m✗ ${name}[0m\n      ${(e as Error).message}`);
  }
}
function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}
function eq<T>(a: T, b: T, m: string) {
  if (a !== b) throw new Error(`${m} — attendu ${String(b)}, obtenu ${String(a)}`);
}
function rngFrom(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dictionnaire de test contrôlé (assez de mots pour remplir les bassins de syllabes).
const WORDS = [
  "arbre", "arbres", "arme", "armes", "part", "parti", "depart", "gare", "guitare",
  "renard", "canard", "phare", "art", "carte", "tarte", "barque", "marche", "charge",
  "maison", "raison", "saison", "poison", "boisson", "chanson", "salon", "ballon", "melon",
  "table", "sable", "cable", "fable", "diable", "capable", "notable", "minable", "durable",
  "porte", "sorte", "morte", "forte", "cortege", "sortir", "mortel", "reporter", "porter",
  "tour", "four", "jour", "cour", "amour", "toujours", "bonjour", "secours", "velours", "contour",
  "chat", "chien", "chose", "chaud", "chaise", "bouche", "marche", "cloche", "planche", "manche",
];
const players: GamePlayer[] = [
  { id: "a", name: "Alice", color: "#f00" },
  { id: "b", name: "Bob", color: "#0f0" },
  { id: "c", name: "Cléo", color: "#00f" },
];
const ctx = (now: number, seed = 1): GameContext => ({ now, rng: rngFrom(seed) });
const submit = (playerId: string, text: string): GameAction<BombeClientAction> => ({
  type: "client",
  playerId,
  msg: { kind: "submit", text },
});
const wordWith = (s: string) => WORDS.find((w) => bombeNormalize(w).includes(s))!;

setBombeDictionary(WORDS);

console.log("\nBombe — engine\n");

test("création : phase playing, 1er joueur courant, syllabe + minuteur posés", () => {
  const s = createBombe(players, { lives: 3 }, ctx(1000));
  eq(s.phase, "playing", "phase playing");
  assert(s.currentId != null, "un joueur courant");
  assert(s.syllable.length >= 2, "une syllabe est posée");
  assert(s.deadline != null && s.deadline > 1000, "un minuteur (deadline) est armé");
  assert(players.every((p) => s.lives[p.id] === 3), "tout le monde a 3 vies");
  assert(bombeSyllableCount(s.syllable) > 0, "la syllabe est réellement jouable");
});

test("le minuteur reste dans les bornes min/max", () => {
  const s = createBombe(players, { lives: 3, minSeconds: 5, maxSeconds: 12 }, ctx(1000));
  const fuse = (s.deadline ?? 0) - s.turnStartedAt;
  assert(fuse >= 5000 && fuse <= 12000, `minuteur dans [5000,12000], obtenu ${fuse}`);
});

test("bon mot : la bombe passe au joueur suivant + nouvelle syllabe", () => {
  const s0 = createBombe(players, { lives: 3 }, ctx(1000));
  const cur = s0.currentId!;
  const w = wordWith(s0.syllable);
  const r = reduceBombe(s0, submit(cur, w), ctx(1100));
  assert(!r.error, "pas d'erreur pour un bon mot");
  const s1 = r.state;
  assert(s1.currentId !== cur, "le tour change de joueur");
  assert(s1.syllable !== s0.syllable || s1.usedWords.length === 1, "nouvelle syllabe / mot mémorisé");
  eq(s1.wordsFound[cur], 1, "le joueur a trouvé 1 mot");
  assert(s1.usedWords.includes(bombeNormalize(w)), "le mot est mémorisé comme utilisé");
});

test("mot sans la syllabe → refusé (erreur syllable), tour inchangé", () => {
  const s0 = createBombe(players, { lives: 3 }, ctx(1000));
  const cur = s0.currentId!;
  const bad = WORDS.find((w) => !bombeNormalize(w).includes(s0.syllable))!;
  const r = reduceBombe(s0, submit(cur, bad), ctx(1100));
  eq(r.error?.code, "bombe_syllable", "erreur syllable");
  eq(r.state.currentId, cur, "le joueur courant ne change pas");
});

test("mot inconnu du dico → refusé (erreur unknown)", () => {
  const s0 = createBombe(players, { lives: 3 }, ctx(1000));
  const cur = s0.currentId!;
  const fake = "qq" + s0.syllable + "qq"; // contient la syllabe mais pas dans le dico
  const r = reduceBombe(s0, submit(cur, fake), ctx(1100));
  eq(r.error?.code, "bombe_unknown", "erreur unknown");
});

test("mot déjà utilisé → refusé (erreur used)", () => {
  const s0 = createBombe(players, { lives: 3 }, ctx(1000));
  const cur = s0.currentId!;
  const w = wordWith(s0.syllable);
  const seeded: BombeState = { ...s0, usedWords: [bombeNormalize(w)] };
  const r = reduceBombe(seeded, submit(cur, w), ctx(1100));
  eq(r.error?.code, "bombe_used", "erreur used");
});

test("un joueur qui n'est pas le joueur courant est ignoré", () => {
  const s0 = createBombe(players, { lives: 3 }, ctx(1000));
  const other = players.find((p) => p.id !== s0.currentId)!.id;
  const w = wordWith(s0.syllable);
  const r = reduceBombe(s0, submit(other, w), ctx(1100));
  assert(!r.error, "pas d'erreur");
  eq(r.state.currentId, s0.currentId, "rien ne change");
  eq(r.state.usedWords.length, 0, "aucun mot mémorisé");
});

test("explosion (advance) : le joueur courant perd une vie et passe la main", () => {
  const s0 = createBombe(players, { lives: 3 }, ctx(1000));
  const victim = s0.currentId!;
  const r = reduceBombe(s0, { type: "advance" }, ctx(2000));
  eq(r.state.lives[victim], 2, "une vie en moins");
  eq(r.state.justExploded, victim, "explosion signalée pour l'animation");
  assert(r.state.currentId !== victim, "la bombe passe au suivant");
});

test("explosion : pause puis le tour suivant est ARMÉ (pas de blocage)", () => {
  const s0 = createBombe(players, { lives: 3 }, ctx(1000));
  const victim = s0.currentId!;
  // 1er advance = explosion → pause
  const boom = reduceBombe(s0, { type: "advance" }, ctx(2000)).state;
  eq(boom.explodePause, true, "on est en pause d'explosion");
  eq(boom.justExploded, victim, "explosion affichée pendant la pause");
  // pendant la pause, toute soumission est ignorée
  const during = reduceBombe(boom, submit(boom.currentId!, wordWith(boom.syllable)), ctx(2100));
  assert(!during.error, "pas d'erreur pendant la pause");
  eq(during.state.usedWords.length, 0, "aucun mot pris en compte pendant la pause");
  // 2e advance = fin de pause → le tour est réellement armé, explosion effacée
  const next = reduceBombe(boom, { type: "advance" }, ctx(3600)).state;
  eq(next.explodePause, false, "la pause est finie");
  eq(next.justExploded, null, "l'explosion est effacée → la saisie se débloque");
  assert(next.currentId != null && next.currentId !== victim, "un joueur suivant est actif");
  assert(next.deadline != null && next.deadline > 3600, "un nouveau minuteur est armé");
  // et ce joueur peut jouer normalement
  const play = reduceBombe(next, submit(next.currentId!, wordWith(next.syllable)), ctx(3700));
  assert(!play.error, "le joueur suivant peut jouer");
  eq(play.state.usedWords.length, 1, "son mot est bien pris en compte");
});

test("élimination à 0 vie + victoire du dernier debout", () => {
  let s: BombeState = createBombe(players, { lives: 1 }, ctx(1000));
  // 2 explosions consécutives éliminent 2 joueurs (1 vie chacun) → il en reste 1.
  for (let i = 0; i < 5 && s.phase === "playing"; i++) {
    s = reduceBombe(s, { type: "advance" }, ctx(2000 + i * 1000)).state;
  }
  eq(s.phase, "gameover", "la partie se termine");
  assert(s.winnerId != null, "il y a un gagnant");
  eq(s.eliminated.length, 2, "deux joueurs éliminés");
  assert((s.lives[s.winnerId!] ?? 0) > 0, "le gagnant a encore une vie");
});

test("presence : si le joueur courant part, la main passe sans pénalité", () => {
  const s0 = createBombe(players, { lives: 3 }, ctx(1000));
  const cur = s0.currentId!;
  const others = players.map((p) => p.id).filter((id) => id !== cur);
  const r = reduceBombe(s0, { type: "presence", connectedIds: others }, ctx(1500));
  assert(r.state.currentId !== cur, "la main a changé");
  eq(r.state.lives[cur], 3, "aucune vie perdue (il a juste quitté)");
});

test("helpers deadline/isOver", () => {
  const s = createBombe(players, { lives: 3 }, ctx(1000));
  assert(bombeDeadline(s) === s.deadline, "deadline exposée en jeu");
  assert(!bombeIsOver(s), "pas fini au début");
  const over: BombeState = { ...s, phase: "gameover" };
  assert(bombeDeadline(over) === null, "pas de deadline une fois fini");
  assert(bombeIsOver(over), "isOver = true");
});

test("projection : deadline réelle exposée (mèche honnête) + bornes", () => {
  const s = createBombe(players, { lives: 3, minSeconds: 5, maxSeconds: 12 }, ctx(1000));
  const pub = projectBombe(s, players[0].id);
  eq(pub.deadline, s.deadline, "deadline réelle exposée pour l'animation");
  eq(pub.maxDeadline, s.turnStartedAt + s.config.maxMs, "borne haute exposée");
  eq(pub.syllable, s.syllable, "syllabe visible");
  eq(pub.ranking.length, players.length, "classement complet");
});

// ── Nouvelles règles : lettres A-V, vies, timer ────────────────────────────

// État de départ avec syllabe forcée "ar" (dans "arbre") et timer non expiré.
function baseFor(cur: string, lives = 3): BombeState {
  let s = createBombe(players, { lives }, ctx(1000));
  // on force le joueur courant = cur et une syllabe connue
  s = { ...s, currentId: cur, syllable: "ar", deadline: 10_000_000 };
  return s;
}

test("mauvais mot → timer inchangé (le tour continue)", () => {
  const s = baseFor("a");
  const before = s.deadline;
  const r = reduceBombe(s, submit("a", "maison"), ctx(2000)); // pas de "ar"
  eq(r.error?.code, "bombe_syllable", "erreur syllabe");
  eq(r.state.currentId, "a", "toujours le même joueur");
  eq(r.state.deadline, before, "le minuteur ne change pas");
});

test("nouvelle lettre sous le max → +1 vie + lettres enregistrées", () => {
  const s = { ...baseFor("a", 3), lives: { a: 2, b: 3, c: 3, d: 3 } };
  const r = reduceBombe(s, submit("a", "arbre"), ctx(2000)); // A R B E
  assert(!r.error, "mot accepté");
  eq(r.state.lives["a"], 3, "+1 vie (2 → 3)");
  assert(r.state.letterEvent?.gainedLife === true, "event +1 vie");
  assert(["A", "R", "B", "E"].every((l) => r.state.usedLetters.includes(l)), "A R B E enregistrées");
});

test("plusieurs nouvelles lettres → +1 vie SEULEMENT", () => {
  const s = { ...baseFor("a", 5), lives: { a: 1, b: 5, c: 5, d: 5 } };
  const r = reduceBombe(s, submit("a", "arbre"), ctx(2000)); // 4 nouvelles lettres
  eq(r.state.lives["a"], 2, "une seule vie gagnée");
});

test("joueur au max → aucune vie, mais lettres enregistrées (atMax)", () => {
  const s = baseFor("a", 3); // a a 3/3
  const r = reduceBombe(s, submit("a", "arbre"), ctx(2000));
  eq(r.state.lives["a"], 3, "toujours 3 (pas de dépassement)");
  assert(r.state.letterEvent?.atMax === true, "atMax signalé");
  assert(r.state.usedLetters.includes("A"), "lettre quand même enregistrée");
});

test("lettre déjà utilisée → aucune récompense", () => {
  const s = { ...baseFor("a", 3), lives: { a: 2, b: 3, c: 3, d: 3 }, usedLetters: ["A", "R", "B", "E"] };
  const r = reduceBombe(s, submit("a", "arbre"), ctx(2000));
  eq(r.state.lives["a"], 2, "pas de +1 vie");
  eq(r.state.letterEvent, null, "aucun event lettre");
});

test("timer expiré → soumission ignorée (l'explosion suivra)", () => {
  const s = { ...baseFor("a", 3), deadline: 1500 };
  const r = reduceBombe(s, submit("a", "arbre"), ctx(2000)); // now 2000 > 1500
  eq(r.state.currentId, "a", "rien ne change");
  eq(r.state.usedWords.length, 0, "mot non enregistré");
});

test("lettres : accents normalisés, W/X/Y/Z ignorées", () => {
  eq(bombeWordLetters(bombeNormalize("Éléphant")).join(""), "ELPHANT", "accents retirés");
  eq(bombeWordLetters(bombeNormalize("çà")).join(""), "CA", "ç→C à→A");
  eq(bombeWordLetters("wxyzab").join(""), "AB", "W X Y Z ignorées");
  eq(bombeWordLetters("arbrear").join(""), "ARBE", "lettres uniques");
});

test("config : jusqu'à 10 vies autorisées", () => {
  eq(resolveBombeConfig({ lives: 10 }).lives, 10, "10 vies OK");
  eq(resolveBombeConfig({ lives: 99 }).lives, 10, "plafonné à 10");
  eq(resolveBombeConfig({ minSeconds: 2, maxSeconds: 4 }).minMs, 2000, "min 2s autorisé");
});

test("projection : usedLetters et letterEvent exposés", () => {
  const s = { ...baseFor("a", 3), lives: { a: 2, b: 3, c: 3, d: 3 } };
  const r = reduceBombe(s, submit("a", "arbre"), ctx(2000));
  const pub = projectBombe(r.state, "b");
  assert(pub.usedLetters.includes("A"), "usedLetters exposées");
  assert(pub.letterEvent?.gainedLife === true, "letterEvent exposé");
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
