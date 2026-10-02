// Run: npx tsx src/games/whois/engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameContext } from "../../platform/types";
import { createWhois, projectWhois, reduceWhois, WHOIS_ELECTED_POINTS, WHOIS_MAJORITY_POINTS } from "./engine";
import { whoisModule } from "./module";
import { parseWhoisQuestions, whoisBank, addCustomWhoisQuestions } from "./questions";
import { WHOIS_CATEGORIES, type WhoisCategory, type WhoisState } from "./types";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  \u001b[32m✓\u001b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \u001b[31m✗ ${name}\u001b[0m\n      ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

const P: GamePlayer[] = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), color: "#fff" }));
let t = 1000;
const ctx = (): GameContext => ({ now: (t += 1000), rng: () => 0.42 });
const vote = (s: WhoisState, from: string, to: string) => reduceWhois(s, { type: "client", playerId: from, msg: { kind: "vote", targetId: to } }, ctx());

console.log("\nQui de nous ?\n");

test("chaque catégorie a au moins 15 questions", () => {
  for (const c of Object.keys(WHOIS_CATEGORIES) as WhoisCategory[]) assert(whoisBank([c]).length >= 15, c);
});

test("démarre sur une question avec chrono", () => {
  const s = createWhois(P, { totalRounds: 5, seconds: 20 }, ctx());
  assert(s.phase === "question" && s.questions.length === 5 && s.deadline != null, "départ");
});

test("un mode = une seule catégorie", () => {
  const s = createWhois(P, { totalRounds: 6, mode: "absurde" }, ctx());
  assert(s.questions.every((q) => q.category === "absurde"), "catégorie");
});

test("interdit de voter pour soi", () => {
  const s = createWhois(P, {}, ctx());
  const r = vote(s, "a", "a");
  assert(!!r.error && Object.keys(r.state.votes).length === 0, "refusé");
});

test("les votes restent secrets avant la révélation", () => {
  let s = createWhois(P, {}, ctx());
  s = vote(s, "a", "b").state;
  const pub = projectWhois(s, "c");
  assert(pub.votes === null && pub.tally === null && pub.votedIds.includes("a"), "secret");
  assert(projectWhois(s, "a").yourVote === "b" && pub.yourVote === null, "mon vote");
});

test("un seul vote par joueur", () => {
  let s = createWhois(P, {}, ctx());
  s = vote(s, "a", "b").state;
  s = vote(s, "a", "c").state;
  assert(s.votes.a === "b", "inchangé");
});

test("tout le monde a voté → révélation et points", () => {
  let s = createWhois(P, {}, ctx());
  s = vote(s, "a", "b").state;
  s = vote(s, "c", "b").state;
  s = vote(s, "d", "a").state;
  s = vote(s, "b", "a").state; // b:2 a:2 → égalité, deux élus
  assert(s.phase === "reveal", "révélé");
  assert(s.elected.length === 2 && s.elected.includes("a") && s.elected.includes("b"), JSON.stringify(s.elected));
  // tous ont voté pour un élu → +100 chacun ; a et b élus → +50
  assert(s.scores.a === WHOIS_MAJORITY_POINTS + WHOIS_ELECTED_POINTS, `a=${s.scores.a}`);
  assert(s.scores.c === WHOIS_MAJORITY_POINTS, `c=${s.scores.c}`);
});

test("vote minoritaire = 0 point", () => {
  let s = createWhois(P, {}, ctx());
  s = vote(s, "a", "b").state;
  s = vote(s, "c", "b").state;
  s = vote(s, "b", "c").state;
  s = vote(s, "d", "c").state; // b:2 c:2
  s = createWhois(P, {}, ctx());
  s = vote(s, "a", "b").state;
  s = vote(s, "c", "b").state;
  s = vote(s, "d", "b").state;
  s = vote(s, "b", "c").state; // b:3 c:1
  assert(s.elected.join() === "b", "b élu");
  assert(s.gained.b === WHOIS_ELECTED_POINTS && s.gained.a === WHOIS_MAJORITY_POINTS, JSON.stringify(s.gained));
  assert((s.gained.b ?? 0) < WHOIS_MAJORITY_POINTS, "b a voté c (minorité)");
});

test("chrono écoulé sans votes → personne n'est élu", () => {
  let s = createWhois(P, {}, ctx());
  s = reduceWhois(s, { type: "advance" }, ctx()).state;
  assert(s.phase === "reveal" && s.elected.length === 0, "personne");
});

test("un joueur parti ne bloque pas la manche", () => {
  let s = createWhois(P, {}, ctx());
  s = vote(s, "a", "b").state;
  s = vote(s, "b", "a").state;
  s = vote(s, "c", "a").state;
  s = reduceWhois(s, { type: "presence", connectedIds: ["a", "b", "c"] }, ctx()).state;
  assert(s.phase === "reveal", "révélé sans d");
});

test("un joueur arrivé en cours peut voter et être élu", () => {
  let s = createWhois(P, {}, ctx());
  const e: GamePlayer = { id: "e", name: "E", color: "#000" };
  s = reduceWhois(s, { type: "presence", connectedIds: ["a", "b", "c", "d", "e"], players: [...P, e] }, ctx()).state;
  assert(s.players.length === 5 && s.scores.e === 0, "ajouté");
  s = vote(s, "e", "a").state;
  assert(s.votes.e === "a", "vote compté");
});

test("partie complète → final + résultat standard + distinctions", () => {
  let s = createWhois(P, { totalRounds: 3 }, ctx());
  for (let r = 0; r < 3; r++) {
    s = vote(s, "a", "b").state;
    s = vote(s, "c", "b").state;
    s = vote(s, "d", "b").state;
    s = vote(s, "b", "a").state;
    s = reduceWhois(s, { type: "advance" }, ctx()).state;
  }
  assert(s.phase === "final", s.phase);
  const res = whoisModule.results(s)!;
  assert(res.scores.b === 3 * WHOIS_ELECTED_POINTS, `b=${res.scores.b}`);
  assert(res.awards!.some((a) => a.id === "whois_star" && a.playerId === "b"), "vedette = b");
  const pub = projectWhois(s, "a");
  assert(pub.history?.length === 3 && pub.timesElected?.b === 3, "historique");
});

test("questions perso : « catégorie | question »", () => {
  const qs = parseWhoisQuestions("# commentaire\nDrôle | ronfle le plus fort\nQui de nous a déjà dormi dehors ?\namis | ");
  assert(qs.length === 2 && qs[0].category === "drole" && qs[0].text === "ronfle le plus fort ?", JSON.stringify(qs));
  assert(qs[1].category === "soiree" && qs[1].text === "a déjà dormi dehors ?", JSON.stringify(qs[1]));
  addCustomWhoisQuestions(qs);
  assert(whoisBank(["drole"]).some((q) => q.text === "ronfle le plus fort ?"), "ajoutée");
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed) process.exit(1);
