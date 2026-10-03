// Mini-harnais de test commun (chaque fichier *.test.ts tourne dans son propre
// processus `tsx` : les compteurs sont donc propres à chaque fichier).
//
//   import { test, assert, done } from "../testing";
//   test("ça marche", () => assert(1 + 1 === 2, "calcul"));
//   done();

let passed = 0;
let failed = 0;

export function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  \u001b[32m✓\u001b[0m ${name}`);
  } catch (e) {
    failed++;
    console.log(`  \u001b[31m✗ ${name}\u001b[0m\n      ${(e as Error).message}`);
  }
}

export function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error(m);
}

/** Affiche le bilan et fait échouer le processus s'il y a un test raté. */
export function done() {
  console.log(`\n${passed} réussis, ${failed} échoués\n`);
  if (failed) process.exit(1);
}
