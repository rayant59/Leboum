// Run: npx tsx engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameContext } from "../../platform/types";
import { createDrawGame, projectDraw, reduceDraw } from "./engine";
import { resolveDrawConfig } from "./modes";
import { pickWordEntries } from "./words";
import type { DrawClientAction, DrawState } from "./types";
import type { GameAction } from "../../platform/types";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  \u001b[32m✓\u001b[0m ${name}`);
  } catch (e) {
    failed++;
    console.log(`  \u001b[31m✗ ${name}\u001b[0m\n      ${(e as Error).message}`);
  }
}
function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}
function eq<T>(a: T, b: T, m: string) {
  if (a !== b) throw new Error(`${m} — attendu ${String(b)}, obtenu ${String(a)}`);
}

// deterministic rng (mulberry32)
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
const players: GamePlayer[] = [
  { id: "a", name: "Alice", color: "#f00" },
  { id: "b", name: "Bob", color: "#0f0" },
  { id: "c", name: "Cléo", color: "#00f" },
];
const ctx = (now: number, seed = 1): GameContext => ({ now, rng: rngFrom(seed) });
const choose = (playerId: string, word: string): GameAction<DrawClientAction> => ({
  type: "client",
  playerId,
  msg: { kind: "choose_word", word },
});
const guess = (playerId: string, text: string): GameAction<DrawClientAction> => ({
  type: "client",
  playerId,
  msg: { kind: "guess", text },
});
const guessers = (s: DrawState) => players.map((p) => p.id).filter((id) => id !== s.drawerId);

console.log("\nDraw & Guess — engine\n");

test("création : phase choosing, dessinateur + 5 mots, scores à 0", () => {
  const s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  eq(s.phase, "choosing", "phase");
  assert(players.some((p) => p.id === s.drawerId), "un dessinateur est désigné");
  eq(s.wordChoices.length, 5, "5 propositions de mots");
  assert(Object.values(s.scores).every((v) => v === 0), "scores à 0");
  assert(s.deadline === 1000 + s.config.chooseMs, "deadline de choix");
});

test("choose_word : refusé pour un non-dessinateur, accepté pour le dessinateur", () => {
  const s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  const notDrawer = guessers(s)[0];
  const r1 = reduceDraw(s, choose(notDrawer, s.wordChoices[0]), ctx(1000));
  assert(r1.error?.code === "not_drawer", "non-dessinateur rejeté");
  eq(r1.state.phase, "choosing", "toujours en choix");

  const r2 = reduceDraw(s, choose(s.drawerId!, s.wordChoices[0]), ctx(1000));
  eq(r2.state.phase, "drawing", "passe au dessin");
  eq(r2.state.word, s.wordChoices[0], "mot fixé");
  assert(r2.state.wordPattern.includes("_"), "gabarit masqué");
});

test("devinette fausse = aucun point ; correcte = devineur + dessinateur marquent", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  const drawer = s.drawerId!;
  const word = s.wordChoices[0];
  s = reduceDraw(s, choose(drawer, word), ctx(1000)).state;
  const g = guessers(s)[0];

  s = reduceDraw(s, guess(g, "n'importe quoi"), ctx(1200)).state;
  assert(s.guessedAt[g] == null, "pas marqué comme trouvé");
  eq(s.scores[g], 0, "aucun point pour une fausse devinette");

  s = reduceDraw(s, guess(g, word.toUpperCase()), ctx(1200)).state; // insensible à la casse
  assert(s.guessedAt[g] != null, "marqué comme trouvé");
  assert(s.scores[g] > 0, "le devineur marque");
  eq(s.scores[drawer], s.config.pointsDrawerPerGuess, "le dessinateur marque aussi");
});

test("quand tous les devineurs trouvent → révélation", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  const drawer = s.drawerId!;
  const word = s.wordChoices[0];
  s = reduceDraw(s, choose(drawer, word), ctx(1000)).state;
  for (const g of guessers(s)) s = reduceDraw(s, guess(g, word), ctx(1200)).state;
  eq(s.phase, "reveal", "révélation");
  eq(s.result?.guesserIds.length, guessers(s).length, "tous les devineurs listés");
});

test("advance : reveal → nouveau tour (dessinateur différent)", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  const first = s.drawerId!;
  s = reduceDraw(s, choose(first, s.wordChoices[0]), ctx(1000)).state; // drawing
  s = reduceDraw(s, { type: "advance" }, ctx(2000)).state; // reveal
  eq(s.phase, "reveal", "reveal");
  s = reduceDraw(s, { type: "advance" }, ctx(3000)).state; // next turn
  eq(s.phase, "choosing", "nouveau tour en choix");
  assert(s.drawerId !== first, "le dessinateur a changé");
});

test("la partie se termine par un scoreboard", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  for (let i = 0; i < 200 && s.phase !== "scoreboard"; i++) {
    s = reduceDraw(s, { type: "advance" }, ctx(1000 + i)).state;
  }
  eq(s.phase, "scoreboard", "arrive au scoreboard");
  eq(s.deadline, null, "plus de deadline");
});

test("projection : le mot est caché aux devineurs pendant le dessin, révélé ensuite", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  const drawer = s.drawerId!;
  const word = s.wordChoices[0];
  s = reduceDraw(s, choose(drawer, word), ctx(1000)).state;
  const g = guessers(s)[0];
  assert(projectDraw(s, g).word === null, "le devineur ne voit pas le mot");
  assert(projectDraw(s, g).wordPattern.includes("_"), "il voit le gabarit");
  eq(projectDraw(s, drawer).word, word, "le dessinateur voit le mot");
  eq(projectDraw(s, drawer).wordChoices, null, "plus de choix pendant le dessin");

  s = reduceDraw(s, { type: "advance" }, ctx(2000)).state; // reveal
  eq(projectDraw(s, g).word, word, "au reveal, tout le monde voit le mot");
});

test("presence : si le dessinateur part, le tour se termine", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  const drawer = s.drawerId!;
  s = reduceDraw(s, choose(drawer, s.wordChoices[0]), ctx(1000)).state; // drawing
  const remaining = players.map((p) => p.id).filter((id) => id !== drawer);
  s = reduceDraw(s, { type: "presence", connectedIds: remaining }, ctx(1500)).state;
  eq(s.phase, "reveal", "le tour se termine quand le dessinateur part");
});

test("aveugle : plus de temps de dessin que classic", () => {
  const c = resolveDrawConfig({ totalRounds: 3, mode: "classic" });
  const b = resolveDrawConfig({ totalRounds: 3, mode: "blind" });
  assert(b.drawMs >= c.drawMs, "aveugle laisse au moins autant de temps");
});

test("mode contraintes : une contrainte est posée au début du dessin", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "constraints" }, ctx(1000, 3));
  const drawer = s.drawerId!;
  const word = s.wordChoices[0];
  s = reduceDraw(s, choose(drawer, word), ctx(1000, 3)).state;
  assert(typeof s.constraint === "string" && s.constraint.length > 0, "contrainte présente");
  assert(projectDraw(s, drawer).constraint === s.constraint, "contrainte projetée");
});

test("mode classic : aucune contrainte ; mode aveugle enregistré", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  s = reduceDraw(s, choose(s.drawerId!, s.wordChoices[0]), ctx(1000)).state;
  assert(s.constraint === null, "pas de contrainte en classic");
  const blind = createDrawGame(players, { totalRounds: 2, mode: "blind" }, ctx(1000));
  eq(blind.mode, "blind", "mode aveugle conservé");
  const coop = createDrawGame(players, { totalRounds: 2, mode: "coop" }, ctx(1000));
  eq(coop.mode, "coop", "mode coopératif conservé");
});

test("banque de mots : entrées avec mot + thème (sans difficulté)", () => {
  const entries = pickWordEntries(5, () => 0.3);
  eq(entries.length, 5, "5 entrées");
  assert(entries.every((e) => e.word && e.theme), "chaque entrée a un mot et un thème");
  assert(entries.every((e) => !("difficulty" in e)), "plus de champ difficulté");
});

test("filtre par thèmes : ne tire que les thèmes demandés", () => {
  const only = pickWordEntries(3, () => 0.4, ["Animaux"]);
  assert(only.every((e) => e.theme === "Animaux"), "que des animaux");
  const s = createDrawGame(players, { totalRounds: 2, mode: "classic", themes: ["Nourriture"] }, ctx(1000, 7));
  assert(s.choicePool.every((e) => e.theme === "Nourriture"), "les choix respectent les thèmes");
  eq(s.wordThemes[0], "Nourriture", "thèmes mémorisés pour les tours suivants");
});

test("mots composés : segments séparés + tirets/espaces gérés", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  s = { ...s, choicePool: [{ word: "machine à laver", theme: "Objets" }], wordChoices: ["machine à laver"] };
  s = reduceDraw(s, choose(s.drawerId!, "machine à laver"), ctx(1000)).state;
  const g = guessers(s)[0];
  const segs = projectDraw(s, g).wordSegments;
  eq(segs.length, 3, "trois sous-mots (machine / à / laver)");
  eq(segs.map((x) => x.length).join(","), "7,1,5", "longueurs correctes");
  assert(segs.every((x) => /^_+$/.test(x)), "tout masqué au départ");
});

test("mots composés : casse-noisette accepté en 'casse noisette' (matching)", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  // force un mot composé connu
  s = { ...s, choicePool: [{ word: "casse-noisette", theme: "Objets" }], wordChoices: ["casse-noisette"] };
  const drawer = s.drawerId!;
  s = reduceDraw(s, choose(drawer, "casse-noisette"), ctx(1000)).state;
  eq(s.theme, "Objets", "thème mémorisé");
  const g = guessers(s)[0];
  s = reduceDraw(s, guess(g, "Casse Noisette"), ctx(1200)).state;
  assert(s.guessedAt[g] != null, "variante espace/casse acceptée");
});

test("révéler le thème : dessinateur seulement, une fois, visible ensuite", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  const drawer = s.drawerId!;
  s = reduceDraw(s, choose(drawer, s.wordChoices[0]), ctx(1000)).state;
  const g = guessers(s)[0];
  assert(projectDraw(s, g).theme === null, "thème caché au départ");
  const notDrawer: GameAction<DrawClientAction> = { type: "client", playerId: g, msg: { kind: "reveal_theme" } };
  s = reduceDraw(s, notDrawer, ctx(1100)).state;
  assert(!s.themeRevealed, "un devineur ne peut pas révéler");
  s = reduceDraw(s, { type: "client", playerId: drawer, msg: { kind: "reveal_theme" } }, ctx(1100)).state;
  assert(s.themeRevealed, "le dessinateur révèle");
  assert(projectDraw(s, g).theme != null, "thème visible aux devineurs après révélation");
});

test("ordre des trouveurs (foundOrder) suit l'ordre des bonnes réponses", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  const drawer = s.drawerId!;
  const word = s.wordChoices[0];
  s = reduceDraw(s, choose(drawer, word), ctx(1000)).state;
  const [g1, g2] = guessers(s);
  s = reduceDraw(s, guess(g2, word), ctx(1100)).state; // g2 en premier
  s = reduceDraw(s, guess(g1, word), ctx(1200)).state; // g1 ensuite (fin de tour)
  eq(projectDraw(s, drawer).foundOrder[0], g2, "premier trouveur d'abord");
});

test("plus d'indices auto : le mot reste entièrement masqué, séparateurs visibles", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  s = { ...s, choicePool: [{ word: "casse-noisette", theme: "Objets" }], wordChoices: ["casse-noisette"] };
  const drawer = s.drawerId!;
  s = reduceDraw(s, choose(drawer, "casse-noisette"), ctx(1000)).state;
  const g = guessers(s)[0];
  const p0 = projectDraw(s, g).wordPattern;
  assert(p0.includes("-"), "le tiret est visible");
  assert(!/[A-ZÀ-Ÿ]/.test(p0), "aucune lettre révélée");
  const segs = projectDraw(s, g).wordSegments;
  eq(segs.length, 2, "casse / noisette → 2 segments");
  assert(segs.every((x) => /^_+$/.test(x)), "tout masqué, jamais de lettre");
});


test("le dessinateur peut terminer sa manche plus tôt (end_drawing)", () => {
  let s = createDrawGame(players, { totalRounds: 2, mode: "classic" }, ctx(1000));
  const drawer = s.drawerId!;
  s = reduceDraw(s, choose(drawer, s.wordChoices[0]), ctx(1000)).state; // drawing
  eq(s.phase, "drawing", "en dessin");
  // un non-dessinateur ne peut PAS forcer la fin
  const notDrawer = guessers(s)[0];
  s = reduceDraw(s, { type: "client", playerId: notDrawer, msg: { kind: "end_drawing" } }, ctx(1500)).state;
  eq(s.phase, "drawing", "un joueur ne peut pas terminer le dessin");
  // le dessinateur, oui
  s = reduceDraw(s, { type: "client", playerId: drawer, msg: { kind: "end_drawing" } }, ctx(2000)).state;
  eq(s.phase, "reveal", "le dessinateur termine → révélation");
});
console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
