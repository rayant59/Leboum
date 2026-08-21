// Run: npx tsx twists.test.ts
import { TWIST_POOL, pickTwists } from "./twists";

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
function eq<T>(a: T, b: T, m: string) {
  if (a !== b) throw new Error(`${m} — attendu ${String(b)}, obtenu ${String(a)}`);
}
function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

console.log("\nRound twists\n");

test("une entrée par manche demandée", () => {
  eq(pickTwists(4, () => 0.1).length, 4, "longueur");
  eq(pickTwists(2, () => 0.1).length, 2, "longueur 2");
});

test("rng haut => aucune consigne", () => {
  assert(
    pickTwists(6, () => 0.9).every((t) => t === null),
    "toutes nulles",
  );
});

test("les consignes viennent du pool, sans doublon", () => {
  const got = pickTwists(TWIST_POOL.length, () => 0.1).filter((t): t is string => t !== null);
  assert(got.length > 0, "au moins une consigne");
  assert(
    got.every((t) => TWIST_POOL.includes(t)),
    "chaque consigne vient du pool",
  );
  eq(new Set(got).size, got.length, "aucun doublon");
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
