// Run: npx tsx settings.test.ts
import {
  DEFAULT_GAME_SETTINGS,
  ROUNDS_MAX,
  ROUNDS_MIN,
  SPEED_PRESETS,
  resolveConfig,
  sanitizeSettings,
} from "./settings";

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

console.log("\nGame settings\n");

test("resolveConfig applique le preset de vitesse", () => {
  const c = resolveConfig({ totalRounds: 3, speed: "fast" });
  eq(c.writingMs, SPEED_PRESETS.fast.writingMs, "writingMs rapide");
  eq(c.votingMs, SPEED_PRESETS.fast.votingMs, "votingMs rapide");
  eq(c.watchingMs, SPEED_PRESETS.fast.watchingMs, "watchingMs rapide");
});

test("resolveConfig garde 100 points par vote", () => {
  eq(resolveConfig(DEFAULT_GAME_SETTINGS).pointsPerVote, 100, "points");
});

test("le nombre de manches est borné", () => {
  eq(resolveConfig({ totalRounds: 1, speed: "normal" }).totalRounds, ROUNDS_MIN, "min");
  eq(resolveConfig({ totalRounds: 99, speed: "normal" }).totalRounds, ROUNDS_MAX, "max");
});

test("sanitizeSettings rejette une vitesse invalide", () => {
  const s = sanitizeSettings({ totalRounds: 4, speed: "turbo" as never });
  eq(s.speed, "normal", "repli sur normal");
  eq(s.totalRounds, 4, "manches conservées");
});

test("sanitizeSettings borne les manches et gère l'absence", () => {
  eq(sanitizeSettings({ totalRounds: 100 }).totalRounds, ROUNDS_MAX, "borne max");
  eq(sanitizeSettings(undefined).speed, DEFAULT_GAME_SETTINGS.speed, "défaut vitesse");
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
