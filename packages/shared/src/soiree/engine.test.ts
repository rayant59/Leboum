// Run: npx tsx src/soiree/engine.test.ts
import type { GamePlayer } from "../game/types";
import { createSoiree, currentItem, finishSoiree, isRecorded, nextGame, recordGame, skipGame, soireeStandings, withPlayers } from "./engine";
import { COOP_POINTS, pointsForPlace, soireePoints } from "./score";
import { assert, done, test } from "../testing";


const P: GamePlayer[] = [
  { id: "a", name: "Ana", color: "#f00" },
  { id: "b", name: "Bob", color: "#0f0" },
  { id: "c", name: "Cid", color: "#00f" },
];
const items = [{ gameId: "quiz" }, { gameId: "bombe" }, { gameId: "reco" }];

console.log("\nSoirée LeBoum — moteur & score global\n");

test("une soirée commence au premier jeu", () => {
  const s = createSoiree(items, 0);
  assert(s.current === 0 && !s.finished && currentItem(s)?.gameId === "quiz", "départ");
});

test("barème : 10 / 7 / 5 / 4 / 3 puis 2", () => {
  assert([1, 2, 3, 4, 5, 6, 9].map(pointsForPlace).join() === "10,7,5,4,3,2,2", "barème");
});

test("égalité = mêmes points ; coop = tout le monde pareil", () => {
  const ranking = [{ id: "a", score: 5, place: 1 }, { id: "b", score: 5, place: 1 }, { id: "c", score: 1, place: 3 }];
  const pts = soireePoints(ranking, false);
  assert(pts.a === 10 && pts.b === 10 && pts.c === 5, JSON.stringify(pts));
  const coop = soireePoints(ranking, true);
  assert(Object.values(coop).every((v) => v === COOP_POINTS), "coop");
});

test("un jeu terminé ajoute des points au total", () => {
  let s = createSoiree(items, 0);
  s = recordGame(s, 0, 1, "quiz", { scores: { a: 3000, b: 1200, c: 400 } }, P);
  assert(s.totals.a === 10 && s.totals.b === 7 && s.totals.c === 5, JSON.stringify(s.totals));
  assert(isRecorded(s, 0) && isRecorded(s, 0, 1) && !isRecorded(s, 0, 2), "enregistré");
});

test("jamais de double comptage pour la même partie", () => {
  let s = createSoiree(items, 0);
  s = recordGame(s, 0, 1, "quiz", { scores: { a: 3, b: 2, c: 1 } }, P);
  s = recordGame(s, 0, 1, "quiz", { scores: { a: 3, b: 2, c: 1 } }, P);
  assert(s.records.length === 1 && s.totals.a === 10, JSON.stringify(s.totals));
});

test("une revanche du même jeu remplace son résultat", () => {
  let s = createSoiree(items, 0);
  s = recordGame(s, 0, 1, "quiz", { scores: { a: 3, b: 2, c: 1 } }, P);
  s = recordGame(s, 0, 2, "quiz", { scores: { a: 1, b: 2, c: 3 } }, P);
  assert(s.records.length === 1 && s.totals.c === 10 && s.totals.a === 5, JSON.stringify(s.totals));
});

test("le classement à élimination (ordre) est respecté", () => {
  let s = createSoiree(items, 0);
  s = recordGame(s, 1, 1, "bombe", { scores: { a: 9, b: 1, c: 4 }, order: ["b", "c", "a"] }, P);
  assert(s.totals.b === 10 && s.totals.c === 7 && s.totals.a === 5, JSON.stringify(s.totals));
});

test("enchaîner les jeux puis finir la soirée", () => {
  let s = createSoiree(items, 0);
  s = nextGame(s);
  assert(s.current === 1 && currentItem(s)?.gameId === "bombe", "jeu 2");
  s = nextGame(nextGame(s));
  assert(s.finished && currentItem(s) === null, "fin");
  assert(nextGame(s) === s, "rien après la fin");
});

test("classement général : total puis jeux gagnés", () => {
  let s = createSoiree(items, 0);
  s = recordGame(s, 0, 1, "quiz", { scores: { a: 3, b: 2, c: 1 } }, P); // a10 b7 c5
  s = recordGame(s, 1, 1, "bombe", { scores: {}, order: ["b", "a", "c"] }, P); // b10 a7 c5
  const st = soireeStandings(s);
  assert(st[0].total === 17 && st[1].total === 17, JSON.stringify(st));
  assert(st[0].wins === 1 && st[0].place === 1 && st[1].place === 1, "égalité parfaite = même place");
  assert(st[2].id === "c" && st[2].total === 10 && st[2].place === 3, "3e");
});

test("un joueur parti garde sa place au classement", () => {
  let s = createSoiree(items, 0);
  s = recordGame(s, 0, 1, "quiz", { scores: { a: 3, b: 2, c: 1 } }, P);
  s = recordGame(s, 1, 1, "bombe", { scores: { a: 1, b: 2 } }, P.slice(0, 2)); // c est parti
  assert(soireeStandings(s).some((r) => r.id === "c" && r.total === 5), "c toujours là");
});

test("un joueur arrivé en cours démarre à 0", () => {
  let s = createSoiree(items, 0);
  s = recordGame(s, 0, 1, "quiz", { scores: { a: 3, b: 2 } }, P.slice(0, 2));
  s = withPlayers(s, P);
  assert(s.totals.c === 0, "c à 0");
});

test("finishSoiree termine immédiatement", () => {
  assert(finishSoiree(createSoiree(items, 0)).finished, "fini");
});

test("skipGame : le jeu passé est noté et la soirée avance", () => {
  const s = skipGame(skipGame(createSoiree(items, 0)));
  assert(s.current === 2 && !s.finished && (s.skipped ?? []).join() === "0,1", JSON.stringify(s.skipped));
  const end = skipGame(s);
  assert(end.finished && (end.skipped ?? []).length === 3, "fin après le dernier jeu passé");
});

done();
