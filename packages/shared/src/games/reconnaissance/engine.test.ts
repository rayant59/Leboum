import type { GamePlayer } from "../../game/types";
import type { GameAction, GameContext } from "../../platform/types";
import { createReco, projectReco, reduceReco } from "./engine";
import { recoAccepts, editDistance, recoNormalize } from "./bank";
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
  assert(!!pub.item?.wiki && !!pub.item?.question, "sujet + question exposés");
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

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
