// Run: npx tsx engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameAction, GameContext } from "../../platform/types";
import { createFakeArtist, projectFakeArtist, reduceFakeArtist } from "./engine";
import type { FakeArtistClientAction, FakeArtistState } from "./types";

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
const vote = (playerId: string, targetId: string): GameAction<FakeArtistClientAction> => ({
  type: "client",
  playerId,
  msg: { kind: "vote", targetId },
});
const others = (s: FakeArtistState) => players.map((p) => p.id).filter((id) => id !== s.impostorId);

console.log("\nFaux-artiste — engine\n");

test("création : phase dessin, un imposteur, un mot", () => {
  const s = createFakeArtist(players, { totalRounds: 2 }, ctx(1000));
  eq(s.phase, "drawing", "phase dessin");
  assert(players.some((p) => p.id === s.impostorId), "un imposteur désigné");
  assert(!!s.word && !!s.theme, "mot + thème posés");
  assert(Object.values(s.scores).every((v) => v === 0), "scores à 0");
});

test("projection : l'imposteur ne voit pas le mot, les autres oui", () => {
  const s = createFakeArtist(players, { totalRounds: 2 }, ctx(1000));
  const imp = s.impostorId!;
  assert(projectFakeArtist(s, imp).word === null, "imposteur : mot caché");
  assert(projectFakeArtist(s, imp).youAreImpostor, "imposteur : sait qu'il l'est");
  const real = others(s)[0];
  eq(projectFakeArtist(s, real).word, s.word, "joueur réel : voit le mot");
  assert(!projectFakeArtist(s, real).youAreImpostor, "joueur réel : pas imposteur");
});

test("vote seulement en phase voting ; auto-vote refusé", () => {
  let s = createFakeArtist(players, { totalRounds: 2 }, ctx(1000));
  const voter = others(s)[0];
  s = reduceFakeArtist(s, vote(voter, s.impostorId!), ctx(1100)).state;
  assert(Object.keys(s.votes).length === 0, "pas de vote pendant le dessin");
  s = reduceFakeArtist(s, { type: "advance" }, ctx(2000)).state; // voting
  eq(s.phase, "voting", "phase vote");
  s = reduceFakeArtist(s, vote(voter, voter), ctx(2100)).state;
  assert(s.votes[voter] == null, "auto-vote ignoré");
});

test("imposteur démasqué → ses accusateurs marquent", () => {
  let s = createFakeArtist(players, { totalRounds: 2 }, ctx(1000));
  const imp = s.impostorId!;
  const [r1, r2] = others(s);
  s = reduceFakeArtist(s, { type: "advance" }, ctx(2000)).state; // voting
  s = reduceFakeArtist(s, vote(r1, imp), ctx(2100)).state;
  s = reduceFakeArtist(s, vote(r2, imp), ctx(2150)).state;
  s = reduceFakeArtist(s, vote(imp, r1), ctx(2200)).state; // tous ont voté → reveal
  eq(s.phase, "reveal", "révélation");
  assert(s.result?.caught === true, "imposteur démasqué");
  eq(s.scores[r1], 100, "accusateur 1 marque");
  eq(s.scores[r2], 100, "accusateur 2 marque");
  eq(s.scores[imp], 0, "imposteur ne marque pas");
});

test("imposteur passe inaperçu → il rafle la mise", () => {
  let s = createFakeArtist(players, { totalRounds: 2 }, ctx(1000));
  const imp = s.impostorId!;
  const [r1, r2] = others(s);
  s = reduceFakeArtist(s, { type: "advance" }, ctx(2000)).state; // voting
  // les réels s'accusent entre eux, personne ne vise l'imposteur
  s = reduceFakeArtist(s, vote(r1, r2), ctx(2100)).state;
  s = reduceFakeArtist(s, vote(r2, r1), ctx(2150)).state;
  s = reduceFakeArtist(s, vote(imp, r1), ctx(2200)).state;
  eq(s.phase, "reveal", "révélation");
  assert(s.result?.caught === false, "imposteur non démasqué");
  eq(s.scores[imp], 200, "l'imposteur rafle la mise");
});

test("la partie se termine par un scoreboard", () => {
  let s = createFakeArtist(players, { totalRounds: 2 }, ctx(1000));
  for (let i = 0; i < 50 && s.phase !== "scoreboard"; i++) {
    s = reduceFakeArtist(s, { type: "advance" }, ctx(1000 + i)).state;
  }
  eq(s.phase, "scoreboard", "arrive au scoreboard");
  eq(s.deadline, null, "plus de deadline");
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
