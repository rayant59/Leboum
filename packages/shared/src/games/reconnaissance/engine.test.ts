import type { GamePlayer } from "../../game/types";
import type { GameAction, GameContext } from "../../platform/types";
import { createReco, projectReco, reduceReco } from "./engine";
import { recoAccepts, editDistance, recoNormalize, pickItems, parseCustomRecoItems, addCustomRecoItems, RECO_BANK } from "./bank";

// La banque Wikipédia est volontairement vide : les sujets viennent des images
// locales. On en charge donc quelques-unes pour faire tourner les tests.
addCustomRecoItems(
  parseCustomRecoItems(
    [
      "== Anime ==",
      "naruto.png | Qui est-ce ? = Naruto",
      "luffy.png | Qui est-ce ? = Luffy",
      "== Films ==",
      "titanic.png | Quel film ? = Titanic",
      "matrix.png | Quel film ? = Matrix",
      "== Disney ==",
      "belle.png | Quelle princesse ? = Belle",
      "simba.png | Qui est-ce ? = Simba",
      "== Jeux vidéo ==",
      "mario.png | Quel jeu ? = Mario",
      "zelda.png | Quel jeu ? = Zelda",
    ].join("\n"),
  ),
);
import type { RecoClientAction } from "./types";

let passed = 0, failed = 0;
function test(n: string, fn: () => void) { try { fn(); passed++; console.log(`  \u001b[32m✓\u001b[0m ${n}`); } catch (e) { failed++; console.log(`  \u001b[31m✗ ${n}\u001b[0m\n      ${(e as Error).message}`); } }
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function eq<T>(a: T, b: T, m: string) { if (a !== b) throw new Error(`${m} — attendu ${String(b)}, obtenu ${String(a)}`); }

const players: GamePlayer[] = [{ id: "a", name: "Alice", color: "#f00" }, { id: "b", name: "Bob", color: "#0f0" }];
const ctx = (now: number): GameContext => ({ now, rng: () => 0.3 });
const ans = (pid: string, v: string): GameAction<RecoClientAction> => ({ type: "client", playerId: pid, msg: { kind: "answer", value: v } });
const item = { id: "x", wiki: "Tour Eiffel", question: "q", answer: "Tour Eiffel", accepted: ["Eiffel Tower"], category: "Monument" };

console.log("\nReconnaissance — engine\n");

test("normalisation + tolérance : casse/accents/espaces", () => {
  eq(recoNormalize("  LA TOUR EIFFEL "), "la tour eiffel", "normalise");
  assert(recoAccepts("tour eiffel", item), "casse ignorée");
  assert(recoAccepts("Eiffel Tower", item), "réponse alternative acceptée");
});

test("petites fautes de frappe tolérées, vraie erreur rejetée", () => {
  assert(editDistance("tour eifel", "tour eiffel") === 1, "distance 1");
  assert(recoAccepts("Tour Eifel", item), "faute proche acceptée");
  assert(!recoAccepts("Statue de la Liberté", item), "réponse différente rejetée");
  assert(!recoAccepts("chat", { id: "y", wiki: "Chien", question: "q", answer: "chien", category: "c" }), "mot court différent rejeté");
});

test("création : image + question exposées, pas la réponse", () => {
  const s = createReco(players, { totalQuestions: 4, secondsPerQuestion: 10 }, ctx(0));
  eq(s.phase, "question", "phase question");
  const pub = projectReco(s, "a");
  assert(!!pub.item?.img && !!pub.item?.question, "image + question exposées");
  assert(!("answer" in (pub.item as object)), "réponse jamais exposée en question");
  eq(pub.correctText, null, "pas de correctText en question");
});

test("réponse cachée aux autres + verrouillée", () => {
  let s = createReco(players, { totalQuestions: 3, secondsPerQuestion: 20 }, ctx(0));
  s = reduceReco(s, ans("a", "test"), ctx(500)).state;
  const pubB = projectReco(s, "b");
  assert(pubB.answeredIds.includes("a"), "Bob voit qu'Alice a répondu");
  eq(pubB.yourAnswer, null, "Bob ne voit pas la réponse d'Alice");
  s = reduceReco(s, ans("a", "autre"), ctx(700)).state;
  eq(s.answers["a"].value, "test", "réponse verrouillée");
});

test("révélation anticipée + score vitesse", () => {
  let s = createReco(players, { totalQuestions: 3, secondsPerQuestion: 10 }, ctx(0));
  const good = s.items[0].answer;
  s = reduceReco(s, ans("a", good), ctx(500)).state;   // rapide
  s = reduceReco(s, ans("b", good), ctx(9000)).state;  // tardif → tous répondu → reveal
  eq(s.phase, "reveal", "révélation dès que tous ont répondu");
  assert(s.gained["a"] > s.gained["b"], "réponse rapide rapporte plus");
});

test("déroulé complet → final + stats", () => {
  let s = createReco(players, { totalQuestions: 3, secondsPerQuestion: 10 }, ctx(0));
  for (let i = 0; i < 3; i++) {
    const good = s.items[s.index].answer;
    s = reduceReco(s, ans("a", good), ctx(s.startedAt + 300)).state;
    s = reduceReco(s, ans("b", "faux"), ctx(s.startedAt + 400)).state; // tous répondu → reveal
    s = reduceReco(s, { type: "advance" }, ctx((s.deadline ?? 0) + 1)).state;
  }
  eq(s.phase, "final", "partie terminée");
  const pub = projectReco(s, "a");
  eq(pub.ranking[0].id, "a", "Alice gagne (que des bonnes réponses)");
  assert(pub.stats !== null, "stats de fin présentes");
});


test("pop sauce : catégories variées et jamais deux fois de suite", () => {
  let seed = 777;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const picked = pickItems(12, rng);
  let same = 0;
  for (let i = 1; i < picked.length; i++) if (picked[i].category === picked[i - 1].category) same++;
  eq(same, 0, "deux sujets de suite dans la même catégorie");
  eq(new Set(RECO_BANK.map((i) => i.id)).size, RECO_BANK.length, "ids dupliqués dans la banque");
});

test("images perso : manifeste parsé et sujets jouables", () => {
  const items = parseCustomRecoItems(
    "# commentaire\nlogo.png | Quelle marque ? = Nike | nike\nphoto.jpg = Luffy\nligne sans egal",
  );
  eq(items.length, 2, "2 lignes valides attendues");
  eq(items[0].question, "Quelle marque ?", "question personnalisée");
  eq(items[0].img, "/reco/logo.png", "chemin de l'image");
  eq(items[1].question, "Qu'est-ce que c'est ?", "question par défaut");
  eq(recoAccepts("nike", items[0]), true, "réponse acceptée");
});


test("catégorie « Perso » : uniquement les images locales, jamais Wikipédia", () => {
  addCustomRecoItems(
    parseCustomRecoItems("a.png | Qui est-ce ? = Alpha\nb.png = Beta\nc.png = Gamma"),
  );
  let seed = 4242;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const picked = pickItems(3, rng, "Perso");
  eq(picked.length, 3, "3 sujets attendus");
  eq(picked.every((i) => !!i.img), true, "une image non locale s'est glissée dans la sélection");
  eq(picked.every((i) => !i.wiki), true, "un sujet Wikipédia s'est glissé dans la sélection");
});

// --- Modes (SPEC §2) --------------------------------------------------------

test("mode par défaut = classic ; inconnu → classic", () => {
  eq(createReco(players, { totalQuestions: 3 }, ctx(0)).config.mode, "classic", "défaut classic");
  eq(createReco(players, { totalQuestions: 3, mode: "wat" }, ctx(0)).config.mode, "classic", "inconnu → classic");
});

test("rush : durée effective divisée par 2 + points doublés", () => {
  const s = createReco(players, { totalQuestions: 3, secondsPerQuestion: 60, mode: "rush" }, ctx(0));
  eq(s.config.mode, "rush", "mode rush");
  eq(s.config.secondsPerQuestion, 30, "durée effective = 60/2 = 30 s");
  eq(s.deadline, 30_000, "deadline = 30 s (chrono réel)");
  // Une bonne réponse rapide rapporte le double du classique (>1000).
  let r = reduceReco(s, ans("a", s.items[0].answer), ctx(1000)).state;
  r = reduceReco(r, ans("b", "faux"), ctx(1100)).state; // tous répondu → reveal
  assert(r.gained["a"] > 1000, `rush double les points (obtenu ${r.gained["a"]})`);
});

test("theme : catégorie « toutes » → une seule catégorie tirée et tenue", () => {
  const s = createReco(players, { totalQuestions: 4, mode: "theme", category: "all" }, ctx(0));
  eq(s.config.mode, "theme", "mode theme");
  assert(s.config.category !== "all", "une catégorie a été tirée au sort");
  assert(s.items.every((it) => it.category === s.config.category), "toutes les images de la manche partagent la catégorie");
});

test("theme : catégorie choisie par l'hôte respectée", () => {
  const s = createReco(players, { totalQuestions: 3, mode: "theme", category: "Anime" }, ctx(0));
  eq(s.config.category, "Anime", "catégorie de l'hôte gardée");
});

test("zoom : points = 1 + floor(temps restant × 4), plafond 4", () => {
  const s = createReco(players, { totalQuestions: 3, secondsPerQuestion: 10, mode: "zoom" }, ctx(0));
  // Réponse quasi instantanée (frac ~1) → plafond 4.
  let r = reduceReco(s, ans("a", s.items[0].answer), ctx(50)).state;
  r = reduceReco(r, ans("b", "faux"), ctx(100)).state;
  eq(r.gained["a"], 4, "réponse ultra-rapide = 4 points (plafond)");
  // Réponse tardive → moins de points, jamais moins de 1.
  const s2 = createReco(players, { totalQuestions: 3, secondsPerQuestion: 10, mode: "zoom" }, ctx(0));
  let r2 = reduceReco(s2, ans("a", s2.items[0].answer), ctx(9500)).state; // ~0.5s restant
  r2 = reduceReco(r2, ans("b", "faux"), ctx(9600)).state;
  assert(r2.gained["a"] >= 1 && r2.gained["a"] < 4, `réponse tardive = 1–3 (obtenu ${r2.gained["a"]})`);
});

test("coop : chrono global = manches × temps par image", () => {
  const s = createReco(players, { totalQuestions: 4, secondsPerQuestion: 15, mode: "coop" }, ctx(0));
  eq(s.config.mode, "coop", "mode coop");
  eq(s.deadline, s.items.length * 15 * 1000, "chrono global = (nb images) × 15 s");
  eq(s.coopScore, 0, "score collectif à 0");
  assert(s.revealAt === 15_000, "révélation de la 1re image sur 15 s");
});

test("coop : bonne réponse → +1 collectif + image suivante, chrono conservé", () => {
  const s = createReco(players, { totalQuestions: 4, secondsPerQuestion: 15, mode: "coop" }, ctx(0));
  const globalDl = s.deadline;
  const r = reduceReco(s, ans("a", s.items[0].answer), ctx(2000)).state;
  eq(r.coopScore, 1, "+1 image trouvée");
  eq(r.index, 1, "on passe à l'image suivante");
  eq(r.deadline, globalDl, "le chrono global n'est pas remis à zéro");
  eq(r.lastFoundBy, "a", "dernier trouveur mémorisé");
  eq(r.phase, "question", "toujours en jeu");
});

test("coop : mauvaise réponse → −3 s au chrono commun", () => {
  const s = createReco(players, { totalQuestions: 4, secondsPerQuestion: 15, mode: "coop" }, ctx(0));
  const before = s.deadline!;
  const r = reduceReco(s, ans("a", "réponse fausse xyz"), ctx(2000)).state;
  eq(r.deadline, before - 3000, "chrono commun −3 s");
  eq(r.coopScore, 0, "pas de point");
  eq(r.index, 0, "on reste sur la même image");
});

test("coop : chrono écoulé → fin de partie", () => {
  const s = createReco(players, { totalQuestions: 4, secondsPerQuestion: 15, mode: "coop" }, ctx(0));
  const r = reduceReco(s, { type: "advance" }, ctx((s.deadline ?? 0) + 1)).state;
  eq(r.phase, "final", "fin quand le chrono global expire");
});

test("coop : plus d'images → fin même s'il reste du temps", () => {
  const s0 = createReco(players, { totalQuestions: 3, secondsPerQuestion: 15, mode: "coop" }, ctx(0));
  const n = s0.items.length;
  let s = s0;
  for (let i = 0; i < n; i++) s = reduceReco(s, ans("a", s0.items[i].answer), ctx(1000 + i * 500)).state;
  eq(s.phase, "final", "partie terminée quand toutes les images sont trouvées");
  eq(s.coopScore, n, `${n} images trouvées`);
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
