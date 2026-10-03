// Run: npx tsx src/games/guesswho/engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameContext } from "../../platform/types";
import { GUESSWHO_FIND_POINTS, GUESSWHO_MASTER_POINTS, GUESSWHO_PER_LEFT, createGuessWho, isCelebrityGuess, masterOf, projectGuessWho, reduceGuessWho } from "./engine";
import { guessWhoModule } from "./module";
import { guessWhoBank } from "./people";
import type { GuessWhoClientAction, GuessWhoState } from "./types";
import { assert, done, test } from "../../testing";


const P: GamePlayer[] = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), color: "#fff" }));
let t = 1000;
let seed = 9;
const rng = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const ctx = (): GameContext => ({ now: (t += 1000), rng });
const act = (s: GuessWhoState, from: string, msg: GuessWhoClientAction) => reduceGuessWho(s, { type: "client", playerId: from, msg }, ctx());
const adv = (s: GuessWhoState) => reduceGuessWho(s, { type: "advance" }, ctx()).state;
const asking = (mode: "celebrites" | "entrenous" = "celebrites") => {
  const s = createGuessWho(P, { mode }, ctx());
  return act(s, masterOf(s)!, { kind: "ready" }).state;
};
const guessers = (s: GuessWhoState) => s.order.filter((id) => id !== masterOf(s));

console.log("\nDevine qui\n");

test("banque : ≥ 80 personnes, chacune avec un indice, sans doublon", () => {
  const b = guessWhoBank();
  assert(b.length >= 80 && b.every((c) => c.hint.length > 3), `${b.length}`);
  assert(new Set(b.map((c) => c.name)).size === b.length, "doublons");
});

test("reconnaissance des noms : alias, nom de famille, accents, fautes", () => {
  const zz = guessWhoBank().find((c) => c.name === "Zinédine Zidane")!;
  assert(isCelebrityGuess("zidane", zz) && isCelebrityGuess("Zizou", zz) && isCelebrityGuess("zinedine zidan", zz), "zidane");
  const mc = guessWhoBank().find((c) => c.name === "Marie Curie")!;
  assert(isCelebrityGuess("curie", mc), "nom de famille");
  const dv = guessWhoBank().find((c) => c.name === "Dark Vador")!;
  assert(isCelebrityGuess("darth vader", dv) && !isCelebrityGuess("yoda", dv), "alias / faux");
});

test("seul le Maître voit le secret, et il lance la manche", () => {
  const s = createGuessWho(P, {}, ctx());
  const m = masterOf(s)!;
  assert(s.phase === "secret" && !!s.celebrity, "secret");
  assert(projectGuessWho(s, m).celebrity?.name === s.celebrity!.name, "Maître");
  for (const id of guessers(s)) assert(projectGuessWho(s, id).celebrity === null && !JSON.stringify(projectGuessWho(s, id)).includes(s.celebrity!.name), "caché");
  assert(act(s, guessers(s)[0], { kind: "ready" }).state.phase === "secret", "seul le Maître lance");
  assert(act(s, m, { kind: "ready" }).state.phase === "ask", "lancé");
});

test("questions : une en attente par joueur, oui/non consomment le stock, nsp/écartée non", () => {
  let s = asking();
  const m = masterOf(s)!;
  const [g1, g2] = guessers(s);
  s = act(s, g1, { kind: "ask", text: "Est-ce une femme ?" }).state;
  const r = act(s, g1, { kind: "ask", text: "Encore ?" });
  assert(r.error?.code === "pending_question" && r.state.questions.length === 1, "une à la fois");
  s = act(s, g2, { kind: "ask", text: "Est-ce un personnage de fiction ?" }).state;
  s = act(s, m, { kind: "answer", questionId: s.questions[0].id, answer: "non" }).state;
  assert(s.left === 19 && s.questions[0].answer === "non", "oui/non comptent");
  s = act(s, m, { kind: "answer", questionId: s.questions[1].id, answer: "nsp" }).state;
  assert(s.left === 19, "je ne sais pas : gratuit");
  s = act(s, g1, { kind: "ask", text: "Il est vivant ?" }).state;
  assert(s.questions.length === 3, "nouvelle question possible après réponse");
});

test("le Maître ne peut ni poser de question ni deviner ; les autres ne répondent pas", () => {
  let s = asking();
  const m = masterOf(s)!;
  const g = guessers(s)[0];
  s = act(s, m, { kind: "ask", text: "?" }).state;
  s = act(s, m, { kind: "guess", text: s.celebrity!.name }).state;
  assert(s.questions.length === 0 && s.phase === "ask", "Maître");
  s = act(s, g, { kind: "ask", text: "Question ?" }).state;
  s = act(s, g, { kind: "answer", questionId: s.questions[0].id, answer: "oui" }).state;
  assert(s.questions[0].answer === null, "réponse refusée");
});

test("bonne proposition : +100 +10/question restante, Maître +50", () => {
  let s = asking();
  const m = masterOf(s)!;
  const g = guessers(s)[0];
  s = act(s, g, { kind: "ask", text: "Q ?" }).state;
  s = act(s, m, { kind: "answer", questionId: s.questions[0].id, answer: "oui" }).state;
  s = act(s, g, { kind: "guess", text: s.celebrity!.name.toLowerCase() }).state;
  assert(s.phase === "reveal" && s.finderId === g, "trouvé");
  assert(s.scores[g] === GUESSWHO_FIND_POINTS + 19 * GUESSWHO_PER_LEFT, `${s.scores[g]}`);
  assert(s.scores[m] === GUESSWHO_MASTER_POINTS, "Maître");
  assert(projectGuessWho(s, g).celebrity?.name === s.celebrity!.name, "révélé à tous");
});

test("mauvaise proposition : coûte une question, la manche continue", () => {
  let s = asking();
  const g = guessers(s)[0];
  s = act(s, g, { kind: "guess", text: "Personne-qui-n-existe-pas" }).state;
  assert(s.phase === "ask" && s.left === 19 && s.guesses[0].ok === false, "raté");
});

test("chrono écoulé : personne ne trouve, aucun point", () => {
  let s = asking();
  s = adv(s);
  assert(s.phase === "reveal" && s.finderId === null && Object.values(s.scores).every((v) => v === 0), "raté");
});

test("stock épuisé : plus de questions, une mauvaise proposition clôt la manche", () => {
  let s = asking();
  const m = masterOf(s)!;
  const [g1] = guessers(s);
  for (let i = 0; i < 20; i++) {
    s = act(s, g1, { kind: "ask", text: `Q${i} ?` }).state;
    s = act(s, m, { kind: "answer", questionId: s.questions[s.questions.length - 1].id, answer: "non" }).state;
  }
  assert(s.left === 0, "stock vide");
  assert(act(s, g1, { kind: "ask", text: "encore ?" }).state.questions.length === 20, "plus de question");
  s = act(s, g1, { kind: "guess", text: "raté" }).state;
  assert(s.phase === "reveal" && s.finderId === null, "fini");
});

test("entre nous : la personne mystère est un joueur (jamais le Maître), on la désigne", () => {
  let s = asking("entrenous");
  const m = masterOf(s)!;
  assert(!!s.secretPlayerId && s.secretPlayerId !== m && s.celebrity === null, "joueur secret");
  const g = guessers(s).find((id) => id !== s.secretPlayerId)!;
  const wrong = s.order.find((id) => id !== s.secretPlayerId && id !== m && id !== g) ?? m;
  s = act(s, g, { kind: "guess", targetId: wrong }).state;
  assert(s.phase === "ask" && s.left === 19, "raté");
  s = act(s, g, { kind: "guess", targetId: s.secretPlayerId! }).state;
  assert(s.phase === "reveal" && s.finderId === g, "trouvé");
});

test("le rôle de Maître tourne ; partie complète jusqu'au final", () => {
  let s = createGuessWho(P, { totalRounds: 4 }, ctx());
  const masters: string[] = [];
  let n = 0;
  while (s.phase !== "final" && n++ < 30) {
    if (s.phase === "secret") masters.push(masterOf(s)!);
    s = adv(s);
  }
  assert(s.phase === "final" && new Set(masters).size === 4, masters.join());
});

test("un Maître qui part : manche suivante", () => {
  let s = createGuessWho(P, {}, ctx());
  const m = masterOf(s)!;
  s = reduceGuessWho(s, { type: "presence", connectedIds: s.order.filter((id) => id !== m) }, ctx()).state;
  assert(s.phase === "secret" && masterOf(s) !== m && s.round === 1, "suivante");
});

test("module : résultat standard, distinctions, réglages bornés", () => {
  let s = guessWhoModule.createState(P, guessWhoModule.sanitizeSettings({ totalRounds: 1 }), ctx());
  s = act(s, masterOf(s)!, { kind: "ready" }).state;
  const g = guessers(s)[0];
  s = act(s, g, { kind: "guess", text: s.celebrity!.name }).state;
  while (!guessWhoModule.isOver(s)) s = adv(s);
  const r = guessWhoModule.results(s)!;
  assert(r.scores[g] === 300 && !!r.awards?.some((a) => a.id === "guesswho_sherlock" && a.playerId === g), JSON.stringify(r));
  const v = guessWhoModule.sanitizeSettings({ totalRounds: 99, seconds: 5, mode: "?" });
  assert(v.totalRounds === 10 && v.seconds === 45 && v.mode === "celebrites", JSON.stringify(v));
});

done();
