// Run: npx tsx src/games/ranking/engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameContext } from "../../platform/types";
import { RANKING_PERFECT_BONUS, consensusOrder, createRanking, isValidOrder, projectRanking, reduceRanking, scoreOrder } from "./engine";
import { rankingModule } from "./module";
import { SAVOIR_PROMPTS, TABLE_PROMPTS } from "./prompts";
import type { RankingClientAction, RankingState } from "./types";
import { assert, done, test } from "../../testing";


const P: GamePlayer[] = ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase(), color: "#fff" }));
let t = 1000;
let seed = 4;
const rng = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const ctx = (): GameContext => ({ now: (t += 1000), rng });
const act = (s: RankingState, from: string, msg: RankingClientAction) => reduceRanking(s, { type: "client", playerId: from, msg }, ctx());
const adv = (s: RankingState) => reduceRanking(s, { type: "advance" }, ctx()).state;
/** Le bon ordre, exprimé en positions affichées (ce que le client enverrait). */
const correctPublic = (s: RankingState) => s.prompts[s.index].items.map((_, i) => s.shuffled.indexOf(i));

console.log("\nLe Top\n");

test("banques : ≥ 20 consignes « savoir » avec valeurs, ≥ 12 « table », 5 éléments chacune", () => {
  assert(SAVOIR_PROMPTS.length >= 20 && SAVOIR_PROMPTS.every((p) => p.items.length === 5 && p.items.every((i) => !!i.value)), "savoir");
  assert(TABLE_PROMPTS.length >= 12 && TABLE_PROMPTS.every((p) => p.items.length === 5), "table");
  for (const p of [...SAVOIR_PROMPTS, ...TABLE_PROMPTS]) assert(new Set(p.items.map((i) => i.label)).size === 5, `doublon dans « ${p.title} »`);
});

test("barème : parfait = 600, une inversion voisine = 400, à l'envers = 140", () => {
  assert(scoreOrder([0, 1, 2, 3, 4], [0, 1, 2, 3, 4]) === 500 + RANKING_PERFECT_BONUS, "parfait");
  assert(scoreOrder([1, 0, 2, 3, 4], [0, 1, 2, 3, 4]) === 400, "inversion");
  assert(scoreOrder([4, 3, 2, 1, 0], [0, 1, 2, 3, 4]) === 20 + 0 + 100 + 0 + 20, `à l'envers ${scoreOrder([4, 3, 2, 1, 0], [0, 1, 2, 3, 4])}`);
});

test("classement de la table = places moyennes (égalités départagées)", () => {
  assert(consensusOrder([[0, 1, 2], [1, 0, 2], [0, 1, 2]], 3).join() === "0,1,2", "moyenne");
  assert(consensusOrder([[2, 1, 0], [2, 0, 1]], 3).join() === "2,0,1", "tie → ordre d'origine");
});

test("validation : seule une permutation complète est acceptée", () => {
  assert(isValidOrder([2, 0, 1, 4, 3], 5) && !isValidOrder([0, 0, 1, 2, 3], 5) && !isValidOrder([0, 1, 2], 5) && !isValidOrder("x", 5), "permutation");
  const s = createRanking(P, {}, ctx());
  const r = act(s, "a", { kind: "order", order: [0, 1, 1, 2, 3] });
  assert(r.error?.code === "bad_order" && !r.state.orders.a, "refusé");
});

test("la bonne réponse ne fuit jamais avant la révélation", () => {
  for (let k = 0; k < 10; k++) {
    const s = createRanking(P, {}, ctx());
    const v = projectRanking(s, "a");
    assert(v.items.every((i) => i.value === undefined), "pas de valeurs");
    assert(v.expected === null && v.orders === null, "pas d'ordre attendu");
    assert(v.items.map((i) => i.label).join("|") !== s.prompts[0].items.map((i) => i.label).join("|"), "jamais présenté dans le bon ordre");
  }
});

test("ordre exprimé en positions affichées : bon ordre → 600", () => {
  let s = createRanking(P, { mode: "savoir" }, ctx());
  s = act(s, "a", { kind: "order", order: correctPublic(s) }).state;
  s = adv(s);
  assert(s.phase === "reveal" && s.gained.a === 600 && s.perfects.a === 1, `${s.gained.a}`);
  const v = projectRanking(s, "b");
  assert(v.expected!.join() === correctPublic({ ...s, phase: "order" } as RankingState).join(), "attendu en positions affichées");
  assert(v.items.every((i) => !!i.value), "valeurs révélées");
});

test("on peut changer d'avis ; tout le monde a validé → révélation", () => {
  let s = createRanking(P, {}, ctx());
  s = act(s, "a", { kind: "order", order: [0, 1, 2, 3, 4] }).state;
  s = act(s, "a", { kind: "order", order: correctPublic(s) }).state;
  s = act(s, "b", { kind: "order", order: [4, 3, 2, 1, 0] }).state;
  assert(s.phase === "order", "c réfléchit encore");
  s = act(s, "c", { kind: "order", order: [0, 1, 2, 3, 4] }).state;
  assert(s.phase === "reveal" && s.gained.a === 600, "dernier envoi retenu");
});

test("pas rendu = 0 point ; un absent ne bloque pas", () => {
  let s = createRanking(P, {}, ctx());
  s = reduceRanking(s, { type: "presence", connectedIds: ["a", "b"] }, ctx()).state;
  s = act(s, "a", { kind: "order", order: correctPublic(s) }).state;
  s = act(s, "b", { kind: "order", order: correctPublic(s) }).state;
  assert(s.phase === "reveal" && (s.gained.c ?? 0) === 0, "c absent");
});

test("mode table : il faut penser comme la table", () => {
  let s = createRanking(P, { mode: "table" }, ctx());
  s = act(s, "a", { kind: "order", order: [0, 1, 2, 3, 4] }).state;
  s = act(s, "b", { kind: "order", order: [0, 1, 2, 3, 4] }).state;
  s = act(s, "c", { kind: "order", order: [4, 3, 2, 1, 0] }).state;
  assert(s.phase === "reveal", "révélé");
  assert(s.gained.a > s.gained.c && s.gained.a === s.gained.b, JSON.stringify(s.gained));
});

test("mode table seul : pas de consensus, pas de points", () => {
  let s = createRanking([P[0]], { mode: "table" }, ctx());
  s = act(s, "a", { kind: "order", order: [0, 1, 2, 3, 4] }).state;
  assert(s.phase === "reveal" && !s.gained.a, "aucun point");
});

test("partie complète + résultat standard + distinction", () => {
  let s = rankingModule.createState(P, rankingModule.sanitizeSettings({ totalRounds: 2 }), ctx());
  s = act(s, "b", { kind: "order", order: correctPublic(s) }).state;
  while (!rankingModule.isOver(s)) s = adv(s);
  const r = rankingModule.results(s)!;
  assert(r.scores.b === 600 && !!r.awards?.some((x) => x.id === "ranking_perfect" && x.playerId === "b"), JSON.stringify(r));
  const v = rankingModule.sanitizeSettings({ totalRounds: 1, seconds: 999, mode: "?" });
  assert(v.totalRounds === 2 && v.seconds === 120 && v.mode === "savoir", JSON.stringify(v));
});

done();
