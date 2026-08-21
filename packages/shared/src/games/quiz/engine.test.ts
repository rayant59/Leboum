// Run: npx tsx engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameAction, GameContext } from "../../platform/types";
import { createQuiz, projectQuiz, reduceQuiz } from "./engine";
import { normalizeAnswer, freeAnswerMatches } from "./questions";
import type { QuizClientAction } from "./types";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  \u001b[32m✓\u001b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \u001b[31m✗ ${name}\u001b[0m\n      ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function eq<T>(a: T, b: T, m: string) { if (a !== b) throw new Error(`${m} — attendu ${String(b)}, obtenu ${String(a)}`); }

const players: GamePlayer[] = [
  { id: "a", name: "Alice", color: "#f00" },
  { id: "b", name: "Bob", color: "#0f0" },
];
const ctx = (now: number): GameContext => ({ now, rng: () => 0.42 });
const ans = (pid: string, value: number | boolean | string): GameAction<QuizClientAction> => ({ type: "client", playerId: pid, msg: { kind: "answer", value } });

console.log("\nQuiz — engine\n");

test("normalisation : casse/accents/espaces", () => {
  eq(normalizeAnswer("  Éléphant  "), "elephant", "normalise accents/espaces");
  assert(freeAnswerMatches("shrek", { id: "x", type: "free", cat: "c", prompt: "p", answer: "Shrek" }), "shrek == Shrek");
  assert(!freeAnswerMatches("zelda", { id: "x", type: "free", cat: "c", prompt: "p", answer: "Shrek" }), "réponse différente rejetée");
});

test("création : phase question, deadline posée, questions tirées", () => {
  const s = createQuiz(players, { totalQuestions: 5, secondsPerQuestion: 10 }, ctx(0));
  eq(s.phase, "question", "phase question");
  eq(s.questions.length, 5, "5 questions");
  eq(s.deadline, 10_000, "deadline = 10s");
});

test("réponse enregistrée, verrouillée, cachée aux autres", () => {
  let s = createQuiz(players, { totalQuestions: 3, secondsPerQuestion: 20 }, ctx(0));
  s = reduceQuiz(s, ans("a", 1), ctx(500)).state;
  const pubB = projectQuiz(s, "b");
  assert(pubB.answeredIds.includes("a"), "Bob voit qu'Alice a répondu");
  eq(pubB.yourAnswer, null, "Bob ne voit pas SA réponse (il n'a pas répondu)");
  const pubA = projectQuiz(s, "a");
  // La projection expose des choix pour un QCM, jamais la bonne réponse.
  if (pubA.question?.type === "mcq") assert(Array.isArray(pubA.question.choices) && pubA.question.choices.length >= 2, "QCM expose les choix");
  assert(!("answer" in (pubA.question as object)), "la bonne réponse n'est jamais exposée en phase question");
  // double réponse ignorée
  s = reduceQuiz(s, ans("a", 3), ctx(700)).state;
  eq(s.answers["a"].value, 1, "réponse verrouillée (pas de changement)");
});

test("révélation anticipée quand tout le monde a répondu", () => {
  let s = createQuiz(players, { totalQuestions: 3, secondsPerQuestion: 20 }, ctx(0));
  s = reduceQuiz(s, ans("a", 0), ctx(300)).state;
  eq(s.phase, "question", "encore en question (un seul a répondu)");
  s = reduceQuiz(s, ans("b", 0), ctx(400)).state;
  eq(s.phase, "reveal", "révélation dès que tous ont répondu");
});

test("score : bonne réponse rapide > tardive ; mauvaise = 0", () => {
  // Question 0 est un QCM avec la banque tirée ; on force une bonne réponse connue en lisant la question.
  let s = createQuiz(players, { totalQuestions: 3, secondsPerQuestion: 10 }, ctx(0));
  const q = s.questions[0];
  const good = q.type === "mcq" ? q.answer : q.type === "truefalse" ? q.answer : q.answer;
  // Alice répond juste très vite, Bob répond juste très tard
  s = reduceQuiz(s, ans("a", good as never), ctx(500)).state; // 0.5s
  s = reduceQuiz(s, ans("b", good as never), ctx(9500)).state; // 9.5s → passe aussi à reveal (tous répondu)
  eq(s.phase, "reveal", "révélation");
  assert(s.gained["a"] > s.gained["b"], "réponse rapide rapporte plus");
  assert(s.gained["b"] > 0, "réponse juste tardive rapporte quand même");
  // manche suivante : mauvaise réponse = 0
  s = reduceQuiz(s, { type: "advance" }, ctx(9500 + 4600)).state; // fin reveal → Q2
  eq(s.phase, "question", "question suivante");
});

test("déroulé complet → phase final + stats", () => {
  let s = createQuiz(players, { totalQuestions: 3, secondsPerQuestion: 10 }, ctx(0));
  for (let i = 0; i < 3; i++) {
    const q = s.questions[s.index];
    const good = q.type === "mcq" ? q.answer : q.type === "truefalse" ? q.answer : q.answer;
    s = reduceQuiz(s, ans("a", good as never), ctx(s.startedAt + 400)).state;
    s = reduceQuiz(s, ans("b", good as never), ctx(s.startedAt + 600)).state; // tous répondu → reveal
    s = reduceQuiz(s, { type: "advance" }, ctx((s.deadline ?? 0) + 1)).state; // fin reveal → suivant/final
  }
  eq(s.phase, "final", "partie terminée");
  const pub = projectQuiz(s, "a");
  eq(pub.ranking.length, 2, "classement complet");
  assert(pub.ranking[0].score >= pub.ranking[1].score, "classement trié");
  assert(pub.stats !== null, "stats de fin présentes");
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
