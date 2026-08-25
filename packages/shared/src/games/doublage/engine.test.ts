// Run: npx tsx engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameAction, GameContext } from "../../platform/types";
import { createDoublage, projectDoublage, reduceDoublage } from "./engine";
import type { DoublageClientAction } from "./types";
import { setCustomDoublageVideos, parseDoublageScenes } from "./videos";

// La bibliothèque intégrée est volontairement vide (les scènes viennent de
// apps/web/public/doublage/). On en charge donc pour les tests.
setCustomDoublageVideos(
  parseDoublageScenes(
    [
      "scene1.mp4 | Scene 1 | 12 = Voix 1 | Voix 2",
      "restaurant.mp4 | Au restaurant | 45 = Le client | Le serveur | Le chef",
    ].join("\n"),
  ),
);

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
const players: GamePlayer[] = [
  { id: "a", name: "Alice", color: "#f00" },
  { id: "b", name: "Bob", color: "#0f0" },
  { id: "c", name: "Cléo", color: "#00f" },
];
const ctx = (now: number): GameContext => ({ now, rng: () => 0.5 });
const act = (playerId: string, msg: DoublageClientAction): GameAction<DoublageClientAction> => ({ type: "client", playerId, msg });

console.log("\nDoublage — engine\n");

test("création : phase prépa, vidéo par défaut, personnages attribués", () => {
  const s = createDoublage(players, {}, ctx(0));
  eq(s.phase, "prep", "phase prépa");
  assert(!!s.videoId, "une vidéo par défaut est choisie");
  assert(s.characters.length >= 2, "des personnages existent");
  const assigned = Object.values(s.assignments).filter(Boolean).length;
  assert(assigned >= 1, "au moins un personnage attribué");
});

test("choisir une vidéo (hôte) réattribue les personnages", () => {
  let s = createDoublage(players, {}, ctx(0));
  s = reduceDoublage(s, act("a", { kind: "pick_video", videoId: "cs2" }), ctx(1)).state;
  eq(s.videoId, "cs2", "vidéo changée");
  eq(s.characters.length, 3, "3 personnages");
});

test("attribution manuelle d'un personnage", () => {
  let s = createDoublage(players, {}, ctx(0));
  const cid = s.characters[0].id;
  s = reduceDoublage(s, act("a", { kind: "assign", characterId: cid, playerId: "c" }), ctx(1)).state;
  eq(s.assignments[cid], "c", "personnage attribué à Cléo");
});

test("prêt + projection : ton personnage + tous prêts", () => {
  let s = createDoublage(players, {}, ctx(0));
  for (const p of players) s = reduceDoublage(s, act(p.id, { kind: "ready", ready: true }), ctx(1)).state;
  const pub = projectDoublage(s, "a");
  assert(pub.allReady, "tout le monde est prêt");
  const cid = Object.entries(s.assignments).find(([, pid]) => pid === "a")?.[0];
  eq(pub.yourCharacterId, cid ?? null, "ton personnage est exposé");
});

test("synchro : play pose une ancre, la position se calcule dans le temps", () => {
  let s = createDoublage(players, {}, ctx(0));
  s = reduceDoublage(s, act("a", { kind: "start" }), ctx(1000)).state;
  eq(s.phase, "dubbing", "phase doublage");
  assert(s.playback.playing, "lecture en cours");
  eq(s.playback.anchor, 1000, "ancre = temps du start");
  // pause à t=3000 → position ~2000ms
  s = reduceDoublage(s, act("a", { kind: "control", op: "pause" }), ctx(3000)).state;
  assert(!s.playback.playing, "en pause");
  eq(s.playback.positionMs, 2000, "position figée = 2s");
});

test("seek positionne la lecture", () => {
  let s = createDoublage(players, {}, ctx(0));
  s = reduceDoublage(s, act("a", { kind: "start" }), ctx(0)).state;
  s = reduceDoublage(s, act("a", { kind: "control", op: "seek", positionMs: 5000 }), ctx(500)).state;
  eq(s.playback.positionMs, 5000, "seek à 5s");
});

test("fin de scène → phase résultat", () => {
  let s = createDoublage(players, { videoId: "cs2" }, ctx(0)); // durée 45s
  s = reduceDoublage(s, act("a", { kind: "start" }), ctx(0)).state;
  // avance au-delà de la durée
  s = reduceDoublage(s, { type: "advance" }, ctx(46_000)).state;
  eq(s.phase, "result", "passage automatique au résultat");
});

test("retour prépa réinitialise les prêts", () => {
  let s = createDoublage(players, {}, ctx(0));
  for (const p of players) s = reduceDoublage(s, act(p.id, { kind: "ready", ready: true }), ctx(1)).state;
  s = reduceDoublage(s, act("a", { kind: "start" }), ctx(2)).state;
  s = reduceDoublage(s, act("a", { kind: "to_prep" }), ctx(3)).state;
  eq(s.phase, "prep", "retour prépa");
  assert(Object.values(s.ready).every((r) => !r), "prêts réinitialisés");
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
