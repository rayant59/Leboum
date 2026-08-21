// Run: npx tsx engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameAction, GameContext } from "../../platform/types";
import { createRelay, projectRelay, reduceRelay, swapActiveDrawer } from "./engine";
import type { RelayClientAction, RelayState } from "./types";

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
  { id: "d", name: "Dan", color: "#ff0" },
];
const ctx = (now: number, seed = 1): GameContext => ({ now, rng: rngFrom(seed) });
const guess = (playerId: string, text: string): GameAction<RelayClientAction> => ({
  type: "client",
  playerId,
  msg: { kind: "guess", text },
});
const guessers = (s: RelayState) => players.map((p) => p.id).filter((id) => !s.drawerIds.includes(id));

console.log("\nRelais — engine\n");

test("création : phase dessin, 2 dessinateurs, un mot", () => {
  const s = createRelay(players, { totalRounds: 3 }, ctx(1000));
  eq(s.phase, "drawing", "phase dessin");
  eq(s.drawerIds.length, 2, "deux dessinateurs en relais");
  assert(!!s.word && !!s.theme, "mot + thème posés");
  assert(s.swapDeadline != null, "un timer de rotation est armé");
});

test("projection : les 2 dessinateurs voient le mot, pas les devineurs", () => {
  const s = createRelay(players, { totalRounds: 3 }, ctx(1000));
  for (const d of s.drawerIds) {
    eq(projectRelay(s, d).word, s.word, "dessinateur voit le mot");
    assert(projectRelay(s, d).youAreDrawer, "dessinateur reconnu");
  }
  const g = guessers(s)[0];
  assert(projectRelay(s, g).word === null, "devineur : mot caché");
  assert(projectRelay(s, g).wordPattern.includes("_"), "devineur : gabarit");
});

test("rotation : le dessinateur actif change", () => {
  let s = createRelay(players, { totalRounds: 3 }, ctx(1000));
  const first = s.drawerIds[s.activeIdx];
  s = swapActiveDrawer(s, ctx(1500));
  const second = s.drawerIds[s.activeIdx];
  assert(first !== second, "le stylo passe à l'autre dessinateur");
  assert(s.drawerIds.includes(second), "toujours parmi les dessinateurs");
});

test("un dessinateur ne peut pas deviner ; un devineur oui", () => {
  let s = createRelay(players, { totalRounds: 3 }, ctx(1000));
  const drawer = s.drawerIds[0];
  s = reduceRelay(s, guess(drawer, s.word!), ctx(1100)).state;
  assert(s.guessedAt[drawer] == null, "dessinateur ne devine pas");
  const g = guessers(s)[0];
  s = reduceRelay(s, guess(g, s.word!.toUpperCase()), ctx(1100)).state;
  assert(s.guessedAt[g] != null, "devineur trouve");
  assert(s.scores[g] > 0, "le devineur marque");
  assert(s.drawerIds.every((d) => s.scores[d] > 0), "les deux dessinateurs marquent");
});

test("tous les devineurs trouvent → révélation", () => {
  let s = createRelay(players, { totalRounds: 3 }, ctx(1000));
  for (const g of guessers(s)) s = reduceRelay(s, guess(g, s.word!), ctx(1100)).state;
  eq(s.phase, "reveal", "révélation quand tout le monde a trouvé");
});

test("nouveau tour : la paire de dessinateurs change", () => {
  let s = createRelay(players, { totalRounds: 3 }, ctx(1000));
  const firstPair = [...s.drawerIds].sort().join(",");
  s = reduceRelay(s, { type: "advance" }, ctx(2000)).state; // reveal
  s = reduceRelay(s, { type: "advance" }, ctx(3000)).state; // next turn
  eq(s.phase, "drawing", "nouveau tour");
  const secondPair = [...s.drawerIds].sort().join(",");
  assert(firstPair !== secondPair, "la paire a changé");
});

test("la partie se termine par un scoreboard", () => {
  let s = createRelay(players, { totalRounds: 3 }, ctx(1000));
  for (let i = 0; i < 60 && s.phase !== "scoreboard"; i++) {
    s = reduceRelay(s, { type: "advance" }, ctx(1000 + i)).state;
  }
  eq(s.phase, "scoreboard", "arrive au scoreboard");
  eq(s.deadline, null, "plus de deadline");
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
