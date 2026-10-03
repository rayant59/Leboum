// Run: npx tsx src/games/funny/engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameContext } from "../../platform/types";
import { cleanAnswer, createFunny, FUNNY_MAX_CHARS, FUNNY_VOTE_POINTS, FUNNY_WIN_BONUS, projectFunny, reduceFunny } from "./engine";
import { funnyModule } from "./module";
import { addCustomFunnyPrompts, funnyPromptBank, FUNNY_PROMPTS } from "./prompts";
import type { FunnyState } from "./types";
import { assert, done, test } from "../../testing";


const P: GamePlayer[] = ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase(), color: "#fff" }));
let t = 1000;
let seed = 1;
const ctx = (): GameContext => ({ now: (t += 1000), rng: () => ((seed = (seed * 9301 + 49297) % 233280) / 233280) });
const answer = (s: FunnyState, id: string, text: string) => reduceFunny(s, { type: "client", playerId: id, msg: { kind: "answer", text } }, ctx());
const vote = (s: FunnyState, id: string, token: string) => reduceFunny(s, { type: "client", playerId: id, msg: { kind: "vote", token } }, ctx());
const advance = (s: FunnyState) => reduceFunny(s, { type: "advance" }, ctx()).state;
const tokenOf = (s: FunnyState, author: string) => s.order.find((tk) => s.tokens[tk] === author)!;

function writeAll(s: FunnyState) {
  s = answer(s, "a", "une poule en roller").state;
  s = answer(s, "b", "un dentier qui chante").state;
  s = answer(s, "c", "trois chaussettes").state;
  return s;
}

console.log("\nLa Plus Drôle\n");

test("au moins 50 phrases, toutes avec un trou", () => {
  assert(FUNNY_PROMPTS.length >= 50 && FUNNY_PROMPTS.every((p) => p.includes("___")), "banque");
});

test("démarre en écriture avec chrono", () => {
  const s = createFunny(P, { totalRounds: 3, seconds: 45 }, ctx());
  assert(s.phase === "write" && s.prompts.length === 3 && s.phaseMs === 45000, "départ");
});

test("limite de caractères et espaces nettoyés", () => {
  assert(cleanAnswer("  un   chat \n bizarre ") === "un chat bizarre", "espaces");
  assert(cleanAnswer("x".repeat(200)).length === FUNNY_MAX_CHARS, "limite");
  const r = answer(createFunny(P, {}, ctx()), "a", "   ");
  assert(!!r.error, "vide refusé");
});

test("on peut corriger sa réponse pendant l'écriture", () => {
  let s = createFunny(P, {}, ctx());
  s = answer(s, "a", "v1").state;
  s = answer(s, "a", "v2").state;
  assert(s.answers.a === "v2" && s.phase === "write", "corrigée");
});

test("les réponses des autres restent cachées pendant l'écriture", () => {
  let s = createFunny(P, {}, ctx());
  s = answer(s, "a", "secret").state;
  const pub = projectFunny(s, "b");
  assert(pub.answers === null && pub.submittedIds.includes("a") && pub.yourAnswer === null, "caché");
  assert(projectFunny(s, "a").yourAnswer === "secret", "je vois la mienne");
});

test("tout le monde a écrit → révélation anonyme", () => {
  const s = writeAll(createFunny(P, {}, ctx()));
  assert(s.phase === "reveal" && s.order.length === 3, s.phase);
  const pub = projectFunny(s, "a");
  assert(pub.answers!.length === 3 && pub.results === null, "anonyme");
  assert(!JSON.stringify(pub.answers).includes('"a"') && !("authorId" in pub.answers![0]), "aucun auteur");
  assert(pub.yourToken === tokenOf(s, "a"), "je reconnais la mienne");
});

test("interdit de voter pour sa propre réponse", () => {
  let s = advance(writeAll(createFunny(P, {}, ctx())));
  assert(s.phase === "vote", s.phase);
  const r = vote(s, "a", tokenOf(s, "a"));
  assert(!!r.error && !r.state.votes.a, "refusé");
});

test("votes → résultats, auteurs dévoilés, points", () => {
  let s = advance(writeAll(createFunny(P, {}, ctx())));
  s = vote(s, "a", tokenOf(s, "b")).state;
  s = vote(s, "c", tokenOf(s, "b")).state;
  s = vote(s, "b", tokenOf(s, "a")).state;
  assert(s.phase === "results", s.phase);
  assert(s.scores.b === 2 * FUNNY_VOTE_POINTS + FUNNY_WIN_BONUS, `b=${s.scores.b}`);
  assert(s.scores.a === FUNNY_VOTE_POINTS && s.scores.c === 0, JSON.stringify(s.scores));
  const pub = projectFunny(s, "c");
  assert(pub.results![0].authorId === "b" && pub.results![0].winner && pub.results![0].voters.length === 2, "dévoilé");
});

test("égalité : toutes les réponses ex æquo gagnent le bonus", () => {
  let s = advance(writeAll(createFunny(P, {}, ctx())));
  s = vote(s, "a", tokenOf(s, "b")).state;
  s = vote(s, "b", tokenOf(s, "c")).state;
  s = vote(s, "c", tokenOf(s, "a")).state;
  assert(s.winners.length === 3, String(s.winners.length));
  assert(Object.values(s.scores).every((v) => v === FUNNY_VOTE_POINTS + FUNNY_WIN_BONUS), JSON.stringify(s.scores));
});

test("personne n'a voté → aucun bonus", () => {
  let s = advance(writeAll(createFunny(P, {}, ctx())));
  s = advance(s);
  assert(s.phase === "results" && s.winners.length === 0, "pas de gagnant");
});

test("moins de 2 réponses : pas de vote", () => {
  let s = createFunny(P, {}, ctx());
  s = answer(s, "a", "seul").state;
  s = advance(s); // écriture → révélation
  s = advance(s); // révélation → (pas de vote) résultats
  assert(s.phase === "results", s.phase);
});

test("personne n'a écrit : la manche passe sans planter", () => {
  let s = advance(createFunny(P, {}, ctx()));
  assert(s.phase === "results" && s.order.length === 0, s.phase);
});

test("un joueur parti ne bloque ni l'écriture ni le vote", () => {
  let s = createFunny(P, {}, ctx());
  s = answer(s, "a", "x").state;
  s = answer(s, "b", "y").state;
  s = reduceFunny(s, { type: "presence", connectedIds: ["a", "b"] }, ctx()).state;
  assert(s.phase === "reveal", "écriture débloquée");
  s = advance(s);
  s = vote(s, "a", tokenOf(s, "b")).state;
  s = vote(s, "b", tokenOf(s, "a")).state;
  assert(s.phase === "results", "vote débloqué");
});

test("partie complète → final, best-of, distinctions", () => {
  let s = createFunny(P, { totalRounds: 2 }, ctx());
  for (let r = 0; r < 2; r++) {
    s = advance(writeAll(s));
    s = vote(s, "a", tokenOf(s, "b")).state;
    s = vote(s, "c", tokenOf(s, "b")).state;
    s = vote(s, "b", tokenOf(s, "c")).state;
    s = advance(s);
  }
  assert(s.phase === "final", s.phase);
  const res = funnyModule.results(s)!;
  assert(res.awards!.some((a) => a.id === "funny_pen" && a.playerId === "b"), "Plume d'or = b");
  const pub = projectFunny(s, "a");
  assert(pub.best!.length >= 2 && pub.best![0].authorId === "b", "best-of");
});

test("phrases perso : sans « ___ », le trou est ajouté à la fin", () => {
  addCustomFunnyPrompts(["# non", "Le meilleur souvenir de vacances de Karim", "Ma pire honte : ___"]);
  const bank = funnyPromptBank();
  assert(bank.includes("Le meilleur souvenir de vacances de Karim : ___") && bank.includes("Ma pire honte : ___"), "ajoutées");
});

done();
