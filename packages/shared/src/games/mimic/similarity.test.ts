// Run: npx tsx similarity.test.ts
import { extractSoundFeatures, soundSimilarity } from "./similarity";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  \u001b[32m✓\u001b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \u001b[31m✗ ${name}\u001b[0m\n      ${(e as Error).message}`); }
}
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

const SR = 16000;
let seed = 3;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
type Part = [number, number, number]; // durée (s), fréquence (Hz, 0 = silence), volume
function make(parts: Part[], pre = 0.6, post = 0.4): Float32Array {
  const total = pre + parts.reduce((s, p) => s + p[0], 0) + post;
  const out = new Float32Array(Math.floor(total * SR));
  let t = Math.floor(pre * SR);
  for (const [d, f, a] of parts) {
    const n = Math.floor(d * SR);
    for (let i = 0; i < n; i++) out[t + i] = a * Math.sin((Math.PI * i) / n) * Math.sin((2 * Math.PI * f * i) / SR);
    t += n;
  }
  for (let i = 0; i < out.length; i++) out[i] += (rnd() - 0.5) * 0.01;
  return out;
}
const ORIG: Part[] = [[0.25, 300, 0.8], [0.1, 0, 0], [0.35, 450, 1], [0.15, 0, 0], [0.4, 250, 0.6]];
const O = extractSoundFeatures(make(ORIG), SR);
const vary = (k: number): Part[] => ORIG.map(([d, f, a]) => [Math.max(0.03, d * (1 + (rnd() - 0.5) * k)), f ? f * (1 + (rnd() - 0.5) * k) : 0, a ? a * (1 + (rnd() - 0.5) * k) : 0]);

console.log("\nMimic — ressemblance\n");

test("le même son : 100 %, le silence : 0 %", () => {
  assert(soundSimilarity(O, O) === 100, "identique");
  assert(soundSimilarity(extractSoundFeatures(new Float32Array(SR), SR), O) === 0, "silence");
});

test("le silence avant la prise ne change (presque) rien", () => {
  const a = soundSimilarity(extractSoundFeatures(make(ORIG, 0.1), SR), O);
  const b = soundSimilarity(extractSoundFeatures(make(ORIG, 1.5), SR), O);
  assert(a >= 95 && b >= 95, `${a} / ${b}`);
});

test("plus on s'éloigne de l'original, plus le score baisse", () => {
  const avg = (k: number) => {
    let s = 0;
    for (let i = 0; i < 12; i++) s += soundSimilarity(extractSoundFeatures(make(vary(k), 0.2 + rnd()), SR), O);
    return s / 12;
  };
  const close = avg(0.2), mid = avg(0.8), far = avg(1.8);
  assert(close > mid && mid > far, `${close.toFixed(0)} > ${mid.toFixed(0)} > ${far.toFixed(0)}`);
});

test("score précis : des valeurs variées, pas seulement des multiples de 10", () => {
  const all: number[] = [];
  for (const k of [0.4, 0.8, 1.2, 1.6, 2.0]) for (let i = 0; i < 8; i++) all.push(soundSimilarity(extractSoundFeatures(make(vary(k)), SR), O));
  const distinct = new Set(all).size;
  const round10 = all.filter((v) => v % 10 === 0).length;
  assert(distinct >= 20, `${distinct} valeurs différentes sur ${all.length}`);
  assert(round10 <= all.length / 4, `${round10} multiples de 10`);
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
