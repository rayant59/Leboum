// Run: npx tsx src/soiree/stats.test.ts
import type { GamePlayer } from "../game/types";
import type { GameResult } from "../platform/result";
import { drawModule } from "../games/draw/module";
import { createSoiree, nextGame, recordGame, voteRematch } from "./engine";
import { playerSummary, soireeHighlights, soireeRecap } from "./stats";
import type { SoireeState } from "./types";
import { assert, done, test } from "../testing";


const P: GamePlayer[] = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), color: "#fff" }));

/** Joue une soirée : une liste de (jeu, résultat). */
function play(games: [string, GameResult][]): SoireeState {
  let s = createSoiree(games.map(([gameId]) => ({ gameId })), 0);
  games.forEach(([gameId, result], i) => {
    s = recordGame(s, i, i, gameId, result, P);
    s = nextGame(s);
  });
  return s;
}
const has = (s: SoireeState, id: string, who?: string) => soireeHighlights(s).some((h) => h.id === id && (who == null || h.playerId === who));

console.log("\nSoirée LeBoum — fin de soirée & stats\n");

test("soirée vide : aucune stat, pas de crash", () => {
  const s = createSoiree([{ gameId: "quiz" }], 0);
  assert(soireeHighlights(s).length === 0 && soireeRecap(s).length === 0, "vide");
});

test("plus de jeux gagnés : au moins 2, sans égalité", () => {
  const s = play([
    ["quiz", { scores: { a: 900, b: 500, c: 100, d: 0 } }],
    ["whois", { scores: { a: 300, b: 200, c: 100, d: 0 } }],
    ["funny", { scores: { b: 400, a: 300, c: 0, d: 0 } }],
  ]);
  const h = soireeHighlights(s).find((x) => x.id === "most_wins");
  assert(h?.playerId === "a" && h.detail === "2 victoires", JSON.stringify(h));
  const tie = play([
    ["quiz", { scores: { a: 9, b: 5 } }],
    ["whois", { scores: { b: 9, a: 5 } }],
  ]);
  assert(!has(tie, "most_wins"), "1 victoire chacun → rien");
});

test("plus gros carton : la victoire la plus nette", () => {
  const s = play([
    ["quiz", { scores: { a: 1000, b: 900, c: 0, d: 0 } }],
    ["ranking", { scores: { c: 2400, a: 600, b: 0, d: 0 } }],
  ]);
  const h = soireeHighlights(s).find((x) => x.id === "big_win");
  assert(h?.playerId === "c" && /Le Top/.test(h.detail ?? "") && /2 400/.test(h.detail ?? ""), JSON.stringify(h));
  const close = play([["quiz", { scores: { a: 1000, b: 950 } }]]);
  assert(!has(close, "big_win"), "victoire serrée → pas de carton");
});

test("tête de quiz : seuls les jeux de culture/réflexion comptent", () => {
  const s = play([
    ["quiz", { scores: { b: 900, a: 500, c: 100, d: 0 } }],
    ["whois", { scores: { a: 900, c: 500, b: 0, d: 0 } }],
    ["pixel", { scores: { b: 700, c: 600, a: 0, d: 0 } }],
  ]);
  const h = soireeHighlights(s).find((x) => x.id === "quiz_head");
  assert(h?.playerId === "b" && h.detail === "20 pts sur 2 jeux de tête", JSON.stringify(h));
  const coop = play([["pixel", { scores: { a: 5, b: 5 }, coop: true }]]);
  assert(!has(coop, "quiz_head"), "coop : pas de tête de quiz");
});

test("distinctions des jeux reprises (meilleur dessinateur, menteur, réponse la plus drôle)", () => {
  const s = play([
    ["phone", { scores: { a: 300, b: 100 }, awards: [{ id: "best_drawer", label: "Meilleur dessinateur", playerId: "a", detail: "3 j'adore" }] }],
    ["imposter", { scores: { c: 400, a: 100 }, awards: [{ id: "best_liar", label: "Meilleur menteur", playerId: "c", detail: "2 manches gagnées" }] }],
    ["funny", { scores: { d: 400 }, awards: [{ id: "funny_best", label: "Réponse la plus drôle", playerId: "d", detail: "« Un pigeon »" }] }],
  ]);
  const h = soireeHighlights(s);
  const ids = h.map((x) => x.id);
  assert(ids.indexOf("best_drawer") < ids.indexOf("best_liar") && ids.indexOf("best_liar") < ids.indexOf("funny_best"), ids.join());
  assert(h.find((x) => x.id === "funny_best")?.detail === "« Un pigeon »", "citation gardée");
});

test("une même distinction gagnée deux fois → « dans 2 jeux » ; égalité → pas décernée", () => {
  const d = (playerId: string) => ({ id: "best_drawer", label: "Meilleur dessinateur", playerId });
  const s = play([
    ["phone", { scores: { a: 1 }, awards: [d("a")] }],
    ["draw", { scores: { a: 1 }, awards: [d("a")] }],
    ["phone", { scores: { a: 1 }, awards: [d("b")] }],
  ]);
  const h = soireeHighlights(s).find((x) => x.id === "best_drawer");
  assert(h?.playerId === "a" && h.detail === "dans 2 jeux", JSON.stringify(h));
  const tie = play([
    ["phone", { scores: { a: 1 }, awards: [d("a")] }],
    ["draw", { scores: { a: 1 }, awards: [d("b")] }],
  ]);
  assert(!has(tie, "best_drawer"), "égalité");
  const pen = play([
    ["phone", { scores: { a: 1 }, awards: [{ id: "best_writer", label: "Plume d'or", playerId: "c" }] }],
    ["funny", { scores: { a: 1 }, awards: [{ id: "funny_pen", label: "Plume d'or", playerId: "c" }] }],
  ]);
  assert(soireeHighlights(pen).filter((x) => x.label === "Plume d'or").length === 1 && has(pen, "golden_pen", "c"), "plumes fusionnées");
});

test("remontada : dernier après le 1er jeu, premier à la fin", () => {
  const s = play([
    ["quiz", { scores: { a: 4, b: 3, c: 2, d: 1 } }],
    ["whois", { scores: { d: 4, b: 3, c: 2, a: 1 } }],
    ["funny", { scores: { d: 4, c: 3, b: 2, a: 1 } }],
  ]);
  const h = soireeHighlights(s).find((x) => x.id === "comeback");
  assert(h?.playerId === "d" && h.detail === "de la 4e à la 1re place", JSON.stringify(h));
});

test("abonné au podium : toujours dans les 3, hors champion", () => {
  const s = play([
    ["quiz", { scores: { a: 4, b: 3, c: 2, d: 1 } }],
    ["whois", { scores: { a: 4, c: 3, b: 2, d: 1 } }],
    ["funny", { scores: { a: 4, b: 3, d: 2, c: 1 } }],
  ]);
  assert(has(s, "always_podium", "b"), JSON.stringify(soireeHighlights(s)));
  assert(!has(s, "always_podium", "a"), "le champion n'en a pas besoin");
});

test("au plus 8 distinctions", () => {
  const awards = Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, label: `X${i}`, playerId: "a" }));
  const s = play([["quiz", { scores: { a: 9, b: 1 }, awards }]]);
  assert(soireeHighlights(s).length === 8, `${soireeHighlights(s).length}`);
});

test("film de la soirée + bilan personnel", () => {
  const s = play([
    ["quiz", { scores: { a: 9, b: 9, c: 1, d: 0 } }],
    ["pixel", { scores: { a: 5, b: 5 }, coop: true }],
    ["whois", { scores: { c: 9, b: 5, a: 1, d: 0 } }],
  ]);
  const recap = soireeRecap(s);
  assert(recap.length === 3 && recap[0].winners.join() === "a,b" && recap[1].coop && recap[1].winners.length === 0 && recap[2].winners.join() === "c", JSON.stringify(recap));
  const b = playerSummary(s, "b")!;
  assert(b.wins === 1 && b.podiums === 2 && b.played === 3 && b.best?.gameId === "quiz" && b.best.place === 1, JSON.stringify(b));
  assert(playerSummary(s, "zzz") === null, "inconnu");
});

test("demandes de revanche : seulement en fin de soirée, sans doublon, annulables", () => {
  let s = createSoiree([{ gameId: "quiz" }], 0);
  s = recordGame(s, 0, 0, "quiz", { scores: { a: 1, b: 0 } }, P);
  assert(voteRematch(s, "a") === s, "soirée pas finie");
  s = nextGame(s);
  s = voteRematch(voteRematch(voteRematch(s, "a"), "a"), "b");
  assert(s.rematchVotes!.join() === "a,b", JSON.stringify(s.rematchVotes));
  s = voteRematch(s, "a", false);
  assert(s.rematchVotes!.join() === "b" && voteRematch(s, "intrus") === s, "retrait + intrus");
});

test("Boum Dessin : « Meilleur dessinateur » = dessin le plus souvent trouvé", () => {
  const st = drawModule.createState(P.slice(0, 3), drawModule.defaultSettings(), { now: 0, rng: () => 0.3 });
  const done = { ...st, phase: "scoreboard" as const, drawingsFound: { a: 3, b: 1 } };
  const r = drawModule.results(done)!;
  assert(r.awards?.[0]?.id === "best_drawer" && r.awards[0].playerId === "a", JSON.stringify(r.awards));
  assert((drawModule.results({ ...done, drawingsFound: { a: 2, b: 2 } })!.awards ?? []).length === 0, "égalité");
  assert((drawModule.results({ ...done, drawingsFound: undefined })!.awards ?? []).length === 0, "anciens états");
});

done();
