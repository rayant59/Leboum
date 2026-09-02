// Run: npx tsx engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameAction, GameContext } from "../../platform/types";
import { createMimic, reduceMimic, projectMimic, mimicDeadline, mimicIsOver } from "./engine";
import type { MimicClientAction, MimicState } from "./types";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  [32m✓[0m ${name}`); }
  catch (e) { failed++; console.log(`  [31m✗ ${name}[0m\n      ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function eq<T>(a: T, b: T, m: string) { if (a !== b) throw new Error(`${m} — attendu ${String(b)}, obtenu ${String(a)}`); }
function rngFrom(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const players: GamePlayer[] = [
  { id: "a", name: "Alice", color: "#f00" },
  { id: "b", name: "Bob", color: "#0f0" },
  { id: "c", name: "Cléo", color: "#00f" },
];
const ctx = (now: number, seed = 1): GameContext => ({ now, rng: rngFrom(seed) });
const act = (playerId: string, msg: MimicClientAction): GameAction<MimicClientAction> => ({ type: "client", playerId, msg });
const adv = (): GameAction<MimicClientAction> => ({ type: "advance" });
const R = (s: MimicState, a: GameAction<MimicClientAction>, now: number) => reduceMimic(s, a, ctx(now)).state;

console.log("\nMimic — engine\n");

test("création : phase prep, round 0, tout le monde à 0", () => {
  const s = createMimic(players, { totalRounds: 2 }, ctx(1000));
  eq(s.phase, "prep", "phase prep");
  eq(s.round, 0, "round 0");
  assert(players.every((p) => s.scores[p.id] === 0), "scores à 0");
  assert(mimicDeadline(s) === null, "pas de deadline en prep");
});

test("prêt + start (hôte) → reference, manche 1, son + deadline posés", () => {
  let s = createMimic(players, { totalRounds: 2 }, ctx(1000));
  for (const p of players) s = R(s, act(p.id, { kind: "ready", ready: true }), 1000);
  s = R(s, act("a", { kind: "start" }), 1100);
  eq(s.phase, "reference", "phase reference");
  eq(s.round, 1, "manche 1");
  assert(!!s.soundId, "un son de référence est choisi");
  assert(s.deadline != null, "deadline armée");
});

test("cycle des phases : reference → countdown → recording", () => {
  let s = createMimic(players, { totalRounds: 2 }, ctx(1000));
  s = R(s, act("a", { kind: "start" }), 1000);
  s = R(s, adv(), 2000); eq(s.phase, "countdown", "→ countdown");
  s = R(s, adv(), 3000); eq(s.phase, "recording", "→ recording");
});

test("une seule prise : 2e take_done ignoré", () => {
  let s = createMimic(players, { totalRounds: 2 }, ctx(1000));
  s = R(s, act("a", { kind: "start" }), 1000);
  s = R(s, adv(), 2000); s = R(s, adv(), 3000); // recording
  s = R(s, act("a", { kind: "take_done" }), 3100);
  assert(s.submitted["a"], "prise a rendue");
  const before = JSON.stringify(s.submitted);
  s = R(s, act("a", { kind: "take_done" }), 3200);
  eq(JSON.stringify(s.submitted), before, "2e prise ignorée");
});

test("tous rendent → processing → playback (ordre = joueurs connectés)", () => {
  let s = createMimic(players, { totalRounds: 2 }, ctx(1000));
  s = R(s, act("a", { kind: "start" }), 1000);
  s = R(s, adv(), 2000); s = R(s, adv(), 3000); // recording
  for (const p of players) s = R(s, act(p.id, { kind: "take_done" }), 3100);
  eq(s.phase, "processing", "→ processing quand tous ont rendu");
  s = R(s, adv(), 6000);
  eq(s.phase, "playback", "→ playback");
  eq(s.playbackOrder.length, 3, "3 prises à lire");
  eq(s.playbackIndex, 0, "commence à la 1re");
});

test("recording : fin du temps → prises vides pour les absents", () => {
  let s = createMimic(players, { totalRounds: 2 }, ctx(1000));
  s = R(s, act("a", { kind: "start" }), 1000);
  s = R(s, adv(), 2000); s = R(s, adv(), 3000); // recording
  s = R(s, act("a", { kind: "take_done" }), 3100); // seul a rend
  s = R(s, adv(), 99999); // temps écoulé
  eq(s.phase, "processing", "→ processing");
  assert(s.emptyTake["b"] && s.emptyTake["c"], "b et c ont une prise vide");
  assert(!s.emptyTake["a"], "a a une vraie prise");
});

test("playback avance prise par prise puis → voting", () => {
  let s = createMimic(players, { totalRounds: 2 }, ctx(1000));
  s = R(s, act("a", { kind: "start" }), 1000);
  s = R(s, adv(), 2000); s = R(s, adv(), 3000);
  for (const p of players) s = R(s, act(p.id, { kind: "take_done" }), 3100);
  s = R(s, adv(), 6000); // playback idx0
  s = R(s, adv(), 20000); eq(s.playbackIndex, 1, "prise 2");
  s = R(s, adv(), 30000); eq(s.playbackIndex, 2, "prise 3");
  s = R(s, adv(), 40000); eq(s.phase, "voting", "→ voting après la dernière prise");
});

test("vote : pas pour soi, un seul vote, tous votent → scoreboard + points", () => {
  let s = createMimic(players, { totalRounds: 2 }, ctx(1000));
  s = R(s, act("a", { kind: "start" }), 1000);
  s = R(s, adv(), 2000); s = R(s, adv(), 3000);
  for (const p of players) s = R(s, act(p.id, { kind: "take_done" }), 3100);
  s = R(s, adv(), 6000); s = R(s, adv(), 20000); s = R(s, adv(), 30000); s = R(s, adv(), 40000); // voting
  eq(s.phase, "voting", "en phase voting");
  // a vote pour soi → ignoré
  const before = JSON.stringify(s.votes);
  s = R(s, act("a", { kind: "vote", targetId: "a" }), 41000);
  eq(JSON.stringify(s.votes), before, "vote pour soi ignoré");
  // tous votent pour b
  s = R(s, act("a", { kind: "vote", targetId: "b" }), 41000);
  s = R(s, act("c", { kind: "vote", targetId: "b" }), 41100);
  s = R(s, act("b", { kind: "vote", targetId: "c" }), 41200);
  eq(s.phase, "scoreboard", "→ scoreboard quand tous ont voté");
  eq(s.roundVotes["b"], 2, "b a 2 votes");
  eq(s.roundVotes["c"], 1, "c a 1 vote");
  assert(s.scores["b"] > s.scores["c"], "b marque plus que c");
  assert(s.scores["a"] === 0, "a n'a reçu aucun vote");
});

test("fin de partie après le nombre de manches → gagnant = meilleur score", () => {
  let s = createMimic(players, { totalRounds: 2 }, ctx(1000));
  // Helper : joue une manche complète où b gagne les votes.
  function playRoundBwins(t0: number): number {
    let t = t0;
    s = R(s, adv(), t); t += 1000; // reference→countdown (si applicable)
    // se remettre en phase reference si besoin
    while (s.phase !== "recording") { s = R(s, adv(), t); t += 1000; }
    for (const p of players) s = R(s, act(p.id, { kind: "take_done" }), t);
    t += 1000;
    while (s.phase !== "voting") { s = R(s, adv(), t); t += 3000; }
    s = R(s, act("a", { kind: "vote", targetId: "b" }), t);
    s = R(s, act("c", { kind: "vote", targetId: "b" }), t + 100);
    s = R(s, act("b", { kind: "vote", targetId: "a" }), t + 200);
    t += 1000;
    return t;
  }
  s = R(s, act("a", { kind: "start" }), 1000); // manche 1 (reference)
  // manche 1
  for (const p of players) { /* noop */ }
  // avance jusqu'à recording puis joue
  let t = 2000;
  while (s.phase !== "recording") { s = R(s, adv(), t); t += 1000; }
  for (const p of players) s = R(s, act(p.id, { kind: "take_done" }), t); t += 1000;
  while (s.phase !== "voting") { s = R(s, adv(), t); t += 3000; }
  s = R(s, act("a", { kind: "vote", targetId: "b" }), t);
  s = R(s, act("c", { kind: "vote", targetId: "b" }), t + 100);
  s = R(s, act("b", { kind: "vote", targetId: "a" }), t + 200); t += 1000;
  eq(s.phase, "scoreboard", "scoreboard manche 1");
  s = R(s, act("a", { kind: "next" }), t); t += 1000; // → manche 2
  eq(s.round, 2, "manche 2");
  while (s.phase !== "recording") { s = R(s, adv(), t); t += 1000; }
  for (const p of players) s = R(s, act(p.id, { kind: "take_done" }), t); t += 1000;
  while (s.phase !== "voting") { s = R(s, adv(), t); t += 3000; }
  s = R(s, act("a", { kind: "vote", targetId: "b" }), t);
  s = R(s, act("c", { kind: "vote", targetId: "b" }), t + 100);
  s = R(s, act("b", { kind: "vote", targetId: "a" }), t + 200); t += 1000;
  s = R(s, adv(), t + 9000); // scoreboard timeout → gameover
  eq(s.phase, "gameover", "→ gameover après 2 manches");
  eq(s.winnerId, "b", "b gagne (plus de votes)");
  assert(mimicIsOver(s), "isOver = true");
});

test("projection : classement trié, son présent, deadline exposée", () => {
  let s = createMimic(players, { totalRounds: 2 }, ctx(1000));
  s = R(s, act("a", { kind: "start" }), 1000);
  const pub = projectMimic(s, "a");
  eq(pub.ranking.length, 3, "classement complet");
  assert(!!pub.sound, "son de référence exposé");
  eq(pub.round, 1, "manche 1");
  assert(pub.deadline === s.deadline, "deadline exposée");
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
