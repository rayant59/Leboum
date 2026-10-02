// Run: npx tsx src/games/yesno/engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameContext } from "../../platform/types";
import { YESNO_CATCH_POINTS, YESNO_FALSE_ACCUSE, YESNO_POINTS_PER_SEC, YESNO_SURVIVE_BONUS, createYesNo, findYesNo, projectYesNo, reduceYesNo, targetOf, totalTurnsYN } from "./engine";
import { yesnoModule } from "./module";
import type { YesNoClientAction, YesNoState } from "./types";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  \u001b[32m✓\u001b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \u001b[31m✗ ${name}\u001b[0m\n      ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

const P: GamePlayer[] = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), color: "#fff" }));
let t = 1000;
let seed = 5;
const rng = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
/** Horloge contrôlée : `tick(ms)` avance le temps. */
const tick = (ms: number) => (t += ms);
const ctx = (): GameContext => ({ now: t, rng });
const act = (s: YesNoState, from: string, msg: YesNoClientAction) => reduceYesNo(s, { type: "client", playerId: from, msg }, ctx());
const adv = (s: YesNoState) => reduceYesNo(s, { type: "advance" }, ctx()).state;
const hot = (mode: "voix" | "chat" = "voix") => adv(createYesNo(P, { mode, seconds: 45 }, ctx()));
const others = (s: YesNoState) => s.order.filter((id) => id !== targetOf(s));

console.log("\nNi oui ni non\n");

test("détection : oui / non et leurs variantes, pas les faux amis", () => {
  for (const ok of ["Oui", "non !", "ouais carrément", "nan", "Ouiiii", "NOOON", "euh… yes"]) assert(!!findYesNo(ok), ok);
  for (const ko of ["peut-être", "absolument", "pas du tout", "si", "nonante", "ouistiti", "oignon", "nonchalant"]) assert(!findYesNo(ko), ko);
});

test("prêt → chrono : chaque joueur est la cible une fois par tour", () => {
  const s0 = createYesNo(P, {}, ctx());
  assert(s0.phase === "ready" && totalTurnsYN(s0) === 4, "prêt");
  let s = s0;
  const targets: string[] = [];
  let n = 0;
  while (s.phase !== "final" && n++ < 40) {
    if (s.phase === "ready") targets.push(targetOf(s)!);
    s = adv(s);
  }
  assert(new Set(targets).size === 4 && targets.length === 4, targets.join());
});

test("la cible tient jusqu'au bout : 5 pts/s + bonus", () => {
  let s = hot();
  const target = targetOf(s)!;
  tick(45_000);
  s = adv(s);
  assert(s.phase === "result" && s.result!.outcome === "survived", "tenu");
  assert(s.scores[target] === 45 * YESNO_POINTS_PER_SEC + YESNO_SURVIVE_BONUS, `${s.scores[target]}`);
});

test("voix : accusation → vote éclair accepté → +150 au piégeur", () => {
  let s = hot("voix");
  const target = targetOf(s)!;
  const [accuser, v1, v2] = others(s);
  tick(12_000);
  s = act(s, accuser, { kind: "accuse" }).state;
  assert(s.phase === "verdict" && s.accuserId === accuser, "vote");
  assert(act(s, target, { kind: "verdict", said: false }).state.votes[target] === undefined, "la cible ne vote pas");
  assert(act(s, accuser, { kind: "verdict", said: true }).state.votes[accuser] === undefined, "l'accusateur non plus");
  tick(3000);
  s = act(s, v1, { kind: "verdict", said: true }).state;
  s = act(s, v2, { kind: "verdict", said: true }).state;
  assert(s.phase === "result" && s.result!.outcome === "caught" && s.result!.catcherId === accuser, "attrapé");
  assert(s.scores[accuser] === YESNO_CATCH_POINTS, "piégeur");
  assert(s.scores[target] === 12 * YESNO_POINTS_PER_SEC, `survie gelée pendant le vote : ${s.scores[target]}`);
});

test("voix : fausse alerte → −50, le chrono reprend là où il était", () => {
  let s = hot("voix");
  const [accuser, v1, v2] = others(s);
  tick(10_000);
  s = act(s, accuser, { kind: "accuse" }).state;
  tick(5000);
  s = act(s, v1, { kind: "verdict", said: false }).state;
  s = act(s, v2, { kind: "verdict", said: true }).state;
  assert(s.phase === "hot" && s.scores[accuser] === -YESNO_FALSE_ACCUSE, "rejeté (égalité = doute pour la cible)");
  assert(s.deadline! - t === 35_000, `35 s restantes (${s.deadline! - t})`);
});

test("voix : la cible ne peut pas s'accuser, personne n'accuse hors chrono", () => {
  let s = hot("voix");
  assert(act(s, targetOf(s)!, { kind: "accuse" }).state.phase === "hot", "cible");
  s = createYesNo(P, {}, ctx());
  assert(act(s, others(s)[0], { kind: "accuse" }).state.phase === "ready", "pas en « prêt »");
});

test("chat : un « ouais » de la cible la fait tomber, le dernier questionneur marque", () => {
  let s = hot("chat");
  const target = targetOf(s)!;
  const [q1, q2] = others(s);
  s = act(s, q1, { kind: "say", text: "Tu aimes la pizza ?" }).state;
  s = act(s, target, { kind: "say", text: "J'adore ça" }).state;
  s = act(s, q2, { kind: "say", text: "Vraiment ?" }).state;
  tick(8000);
  s = act(s, target, { kind: "say", text: "Ouais bien sûr" }).state;
  assert(s.phase === "result" && s.result!.outcome === "caught" && s.result!.catcherId === q2 && s.result!.word === "ouais", JSON.stringify(s.result));
  assert(s.log[s.log.length - 1].fatal === true, "message fatal marqué");
});

test("chat : les autres peuvent dire oui sans risque", () => {
  let s = hot("chat");
  s = act(s, others(s)[0], { kind: "say", text: "oui oui non non" }).state;
  assert(s.phase === "hot" && s.log.length === 1, "pas de danger");
});

test("une cible absente est sautée", () => {
  let s = createYesNo(P, {}, ctx());
  const target = targetOf(s)!;
  s = reduceYesNo(s, { type: "presence", connectedIds: s.order.filter((id) => id !== target) }, ctx()).state;
  assert(s.phase === "ready" && targetOf(s) !== target, "sautée");
});

test("un arrivant sera la cible en fin de tour", () => {
  let s = createYesNo(P, {}, ctx());
  s = reduceYesNo(s, { type: "presence", connectedIds: [...s.order, "z"], players: [...P, { id: "z", name: "Z", color: "#fff" }] }, ctx()).state;
  assert(s.order[s.order.length - 1] === "z" && totalTurnsYN(s) === 5, "ajouté");
});

test("projection : votes et résultat cachés au bon moment", () => {
  let s = hot("voix");
  const [accuser, v1] = others(s);
  s = act(s, accuser, { kind: "accuse" }).state;
  s = act(s, v1, { kind: "verdict", said: true }).state;
  const v = projectYesNo(s, v1);
  assert(v.yourVote === true && v.result === null, "vote perso visible, pas de résultat");
});

test("module : résultat standard, distinctions, réglages bornés", () => {
  let s = yesnoModule.createState(P, yesnoModule.sanitizeSettings({ seconds: 30 }), ctx());
  s = adv(s);
  const target = targetOf(s)!;
  tick(30_000);
  s = adv(s);
  while (!yesnoModule.isOver(s)) s = adv(s);
  const r = yesnoModule.results(s)!;
  assert(r.scores[target] > 0, "score");
  assert(!r.awards?.some((a) => a.id === "yesno_wall"), "égalité de survies → pas de muraille");
  const v = yesnoModule.sanitizeSettings({ seconds: 1, totalRounds: 9, mode: "x" });
  assert(v.seconds === 20 && v.totalRounds === 3 && v.mode === "voix", JSON.stringify(v));
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed) process.exit(1);
