// Zero-dependency tests for the subtitles game engine.
// Run: npx tsx subtitles.test.ts

import {
  createSubtitlesGame,
  reduceSubtitles,
  standings,
  submissionCount,
} from "./subtitles";
import { staticClipProvider, CLIP_LIBRARY } from "./clips";
import type { GamePlayer, SubtitlesAction, SubtitlesState } from "./types";
import { DEFAULT_SUBTITLES_CONFIG } from "./types";

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

const PLAYERS: GamePlayer[] = [
  { id: "a", name: "Alice", color: "#f00" },
  { id: "b", name: "Bob", color: "#0f0" },
  { id: "c", name: "Cléo", color: "#00f" },
];
const CFG = { ...DEFAULT_SUBTITLES_CONFIG, totalRounds: 2 };

function newGame(): SubtitlesState {
  const clips = staticClipProvider(CLIP_LIBRARY, () => 0).pick(CFG.totalRounds);
  return createSubtitlesGame(PLAYERS, clips, 0, CFG);
}
function run(s: SubtitlesState, ...actions: SubtitlesAction[]): SubtitlesState {
  return actions.reduce((st, a) => reduceSubtitles(st, a).state, s);
}

console.log("\nSubtitles game engine\n");

test("la partie démarre en 'watching', manche 1, scores à zéro", () => {
  const s = newGame();
  eq(s.phase, "watching", "phase");
  eq(s.round, 1, "round");
  assert(s.deadline !== null, "deadline posée");
  assert(PLAYERS.every((p) => s.scores[p.id] === 0), "scores à 0");
  eq(s.clips.length, 2, "un clip par manche");
});

test("advance fait passer watching -> writing", () => {
  const s = run(newGame(), { type: "advance", now: 100 });
  eq(s.phase, "writing", "writing");
});

test("on ne peut pas écrire hors de la phase d'écriture", () => {
  const r = reduceSubtitles(newGame(), { type: "submit", playerId: "a", lines: ["coucou"], now: 1 });
  eq(r.error?.code, "wrong_phase", "wrong_phase");
});

test("un sous-titre vide est refusé", () => {
  const s = run(newGame(), { type: "advance", now: 1 });
  const r = reduceSubtitles(s, { type: "submit", playerId: "a", lines: ["   "], now: 2 });
  eq(r.error?.code, "empty_caption", "empty_caption");
});

test("un non-joueur ne peut pas soumettre", () => {
  const s = run(newGame(), { type: "advance", now: 1 });
  const r = reduceSubtitles(s, { type: "submit", playerId: "zzz", lines: ["hack"], now: 2 });
  eq(r.error?.code, "not_a_player", "not_a_player");
});

test("quand tout le monde a écrit, on lance la projection des répliques", () => {
  const s = run(
    newGame(),
    { type: "advance", now: 1 },
    { type: "submit", playerId: "a", lines: ["Je crois que j'ai oublié le gaz"], now: 2 },
    { type: "submit", playerId: "b", lines: ["Cours, Forrest !"], now: 3 },
    { type: "submit", playerId: "c", lines: ["C'est pas mon chien"], now: 4 },
  );
  eq(s.phase, "screening", "screening");
  eq(s.screenIndex, 0, "on commence par la 1re réplique");
  eq(submissionCount(s), 3, "3 soumissions");
});

test("la projection défile réplique par réplique puis ouvre le vote", () => {
  let s = toScreening();
  eq(s.phase, "screening", "screening");
  s = reduceSubtitles(s, { type: "advance", now: 20 }).state;
  eq(s.screenIndex, 1, "2e réplique");
  s = reduceSubtitles(s, { type: "advance", now: 21 }).state;
  eq(s.screenIndex, 2, "3e réplique");
  s = reduceSubtitles(s, { type: "advance", now: 22 }).state;
  eq(s.phase, "voting", "après la dernière réplique, on vote");
});

test("scène dialogue : exige une réplique par créneau", () => {
  const dialogueClip = {
    id: "d",
    title: "D",
    kind: "file" as const,
    url: "x",
    script: [
      { id: "a", fromMs: 0, toMs: 1000 },
      { id: "b", fromMs: 1000, toMs: 2000 },
    ],
  };
  let s = createSubtitlesGame(PLAYERS, [dialogueClip], 0, { ...CFG, totalRounds: 1 });
  s = reduceSubtitles(s, { type: "advance", now: 1 }).state; // -> writing

  let r = reduceSubtitles(s, { type: "submit", playerId: "a", lines: ["une seule"], now: 2 });
  eq(r.error?.code, "empty_caption", "il manque une réplique");
  r = reduceSubtitles(s, { type: "submit", playerId: "a", lines: ["ok", "   "], now: 2 });
  eq(r.error?.code, "empty_caption", "une réplique est vide");

  const ok2 = reduceSubtitles(s, { type: "submit", playerId: "a", lines: ["Bonjour", "Au revoir"], now: 2 }).state;
  assert(Array.isArray(ok2.submissions["a"]) && ok2.submissions["a"].length === 2, "2 lignes stockées");
});

test("on ne vote pas pour soi-même", () => {
  const s = toVoting();
  const r = reduceSubtitles(s, { type: "vote", playerId: "a", authorId: "a", now: 10 });
  eq(r.error?.code, "self_vote", "self_vote");
});

test("on ne peut pas voter pour un sous-titre inexistant", () => {
  const s = toVoting();
  const r = reduceSubtitles(s, { type: "vote", playerId: "a", authorId: "zzz", now: 10 });
  eq(r.error?.code, "unknown_target", "unknown_target");
});

test("quand tout le monde a voté, on calcule les résultats et les points", () => {
  // a et c votent pour b ; b vote pour a.
  const s = run(
    toVoting(),
    { type: "vote", playerId: "a", authorId: "b", now: 10 },
    { type: "vote", playerId: "c", authorId: "b", now: 11 },
    { type: "vote", playerId: "b", authorId: "a", now: 12 },
  );
  eq(s.phase, "results", "results");
  eq(s.scores["b"], 2 * CFG.pointsPerVote, "b marque 2 votes");
  eq(s.scores["a"], 1 * CFG.pointsPerVote, "a marque 1 vote");
  eq(s.scores["c"], 0, "c marque 0");
  eq(s.roundResults?.[0].authorId, "b", "b en tête du classement de manche");
});

test("manche suivante : remet à zéro soumissions et votes, avance la manche", () => {
  const s = playFullRound();
  const next = reduceSubtitles(s, { type: "next_round", now: 100 }).state;
  eq(next.round, 2, "manche 2");
  eq(next.phase, "watching", "re-watching");
  eq(submissionCount(next), 0, "soumissions vidées");
  assert(Object.keys(next.votes).length === 0, "votes vidés");
});

test("après la dernière manche, on va au tableau des scores", () => {
  let s = playFullRound(); // fin manche 1
  s = reduceSubtitles(s, { type: "next_round", now: 100 }).state; // manche 2
  // rejouer une manche complète
  s = run(
    s,
    { type: "advance", now: 101 },
    { type: "submit", playerId: "a", lines: ["x"], now: 102 },
    { type: "submit", playerId: "b", lines: ["y"], now: 103 },
    { type: "submit", playerId: "c", lines: ["z"], now: 104 }, // -> screening
    { type: "advance", now: 105 },
    { type: "advance", now: 106 },
    { type: "advance", now: 107 }, // -> voting
    { type: "vote", playerId: "a", authorId: "b", now: 108 },
    { type: "vote", playerId: "b", authorId: "a", now: 109 },
    { type: "vote", playerId: "c", authorId: "b", now: 110 },
  );
  eq(s.phase, "results", "results manche 2");
  const end = reduceSubtitles(s, { type: "next_round", now: 200 }).state;
  eq(end.phase, "scoreboard", "scoreboard final");
});

test("fin d'écriture avec moins de 2 sous-titres : projection puis résultats (pas de vote)", () => {
  const s = run(
    newGame(),
    { type: "advance", now: 1 }, // writing
    { type: "submit", playerId: "a", lines: ["seul"], now: 2 },
    { type: "advance", now: 999 }, // temps écoulé -> projection (1 réplique)
    { type: "advance", now: 1000 }, // fin de projection -> résultats (pas de vote)
  );
  eq(s.phase, "results", "résultats directs");
});

test("le classement est trié par score décroissant", () => {
  const s = run(
    toVoting(),
    { type: "vote", playerId: "a", authorId: "b", now: 10 },
    { type: "vote", playerId: "c", authorId: "b", now: 11 },
    { type: "vote", playerId: "b", authorId: "a", now: 12 },
  );
  const order = standings(s).map((p) => p.id);
  eq(order[0], "b", "b premier");
});

test("le reducer ne mute pas l'état d'entrée", () => {
  const s = toVoting();
  const snap = JSON.stringify(s);
  reduceSubtitles(s, { type: "vote", playerId: "a", authorId: "b", now: 10 });
  eq(JSON.stringify(s), snap, "état inchangé");
});

test("advance depuis results enchaîne la manche suivante (chrono)", () => {
  const s = playFullRound();
  eq(s.phase, "results", "en résultats");
  const next = reduceSubtitles(s, { type: "advance", now: 500 }).state;
  eq(next.round, 2, "manche 2");
  eq(next.phase, "watching", "re-watching");
});

test("advance en results de la dernière manche va au scoreboard", () => {
  const cfg1 = { ...CFG, totalRounds: 1 };
  const clips = staticClipProvider(CLIP_LIBRARY, () => 0).pick(1);
  let s = createSubtitlesGame(PLAYERS, clips, 0, cfg1);
  s = run(
    s,
    { type: "advance", now: 1 },
    { type: "submit", playerId: "a", lines: ["x"], now: 2 },
    { type: "submit", playerId: "b", lines: ["y"], now: 3 },
    { type: "submit", playerId: "c", lines: ["z"], now: 4 }, // -> screening
    { type: "advance", now: 5 },
    { type: "advance", now: 6 },
    { type: "advance", now: 7 }, // -> voting
    { type: "vote", playerId: "a", authorId: "b", now: 8 },
    { type: "vote", playerId: "b", authorId: "a", now: 9 },
    { type: "vote", playerId: "c", authorId: "b", now: 10 },
  );
  eq(s.phase, "results", "results");
  const end = reduceSubtitles(s, { type: "advance", now: 100 }).state;
  eq(end.phase, "scoreboard", "scoreboard");
});

// helpers ---------------------------------------------------------------------
function toScreening(): SubtitlesState {
  return run(
    newGame(),
    { type: "advance", now: 1 },
    { type: "submit", playerId: "a", lines: ["réplique de a"], now: 2 },
    { type: "submit", playerId: "b", lines: ["réplique de b"], now: 3 },
    { type: "submit", playerId: "c", lines: ["réplique de c"], now: 4 },
  );
}
function toVoting(): SubtitlesState {
  // 3 captions -> screen through all three, then voting opens.
  return run(
    toScreening(),
    { type: "advance", now: 5 },
    { type: "advance", now: 6 },
    { type: "advance", now: 7 },
  );
}
function playFullRound(): SubtitlesState {
  return run(
    toVoting(),
    { type: "vote", playerId: "a", authorId: "b", now: 10 },
    { type: "vote", playerId: "b", authorId: "a", now: 11 },
    { type: "vote", playerId: "c", authorId: "b", now: 12 },
  );
}

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
