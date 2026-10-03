// Run: npx tsx src/games/taboo/engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameContext } from "../../platform/types";
import { findForbidden, isWordGuess } from "../../platform/text";
import { TABOO_FOUND_POINTS, TABOO_SLIP_PENALTY, censorOf, createTaboo, giverOf, projectTaboo, reduceTaboo, totalTurns } from "./engine";
import { tabooModule } from "./module";
import { addCustomTabooCards, parseTabooCards, resetCustomTabooCards, tabooBank } from "./cards";
import type { TabooClientAction, TabooState } from "./types";
import { assert, done, test } from "../../testing";


const P: GamePlayer[] = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), color: "#fff" }));
let t = 1000;
let seed = 11;
const rng = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const ctx = (): GameContext => ({ now: (t += 1000), rng });
const act = (s: TabooState, from: string, msg: TabooClientAction) => reduceTaboo(s, { type: "client", playerId: from, msg }, ctx());
const adv = (s: TabooState) => reduceTaboo(s, { type: "advance" }, ctx()).state;
const started = (mode: "ecrit" | "oral" = "ecrit") => {
  const s = createTaboo(P, { mode }, ctx());
  return act(s, giverOf(s)!, { kind: "start" }).state;
};

console.log("\nMot interdit\n");

test("banque : ≥ 120 cartes, 4 mots interdits chacune, aucun doublon", () => {
  const bank = tabooBank();
  assert(bank.length >= 120, `${bank.length}`);
  assert(bank.every((c) => c.forbidden.length === 4), "4 interdits");
  assert(new Set(bank.map((c) => c.word.toLowerCase())).size === bank.length, "doublons");
});

test("détection des mots interdits : variantes attrapées, faux positifs évités", () => {
  const terms = ["Danse", "Musique", "Dents", "Nez rouge", "Pain"];
  assert(findForbidden("on aime danser", terms) === "Danse", "danser");
  assert(findForbidden("des MUSIQUES cool", terms) === "Musique", "pluriel + casse");
  assert(findForbidden("ça fait mal aux dent", terms) === "Dents", "singulier");
  assert(findForbidden("un nez  rouge de clown", terms) === "Nez rouge", "expression");
  assert(findForbidden("le nez tout bleu", terms) === null, "nez seul ≠ nez rouge");
  assert(findForbidden("une peinture", terms) === null, "peinture ≠ pain");
  assert(findForbidden("Pâtisserie fine", ["Pâte"]) === null, "mot court : égalité stricte");
  assert(findForbidden("ça s'écrit é-c-h-e-c-s", ["Échecs"]) === null, "épelé : pas attrapé (assumé)");
});

test("bonne réponse : accents, articles, pluriel, 1 faute", () => {
  assert(isWordGuess("la tour eiffel", "Tour Eiffel"), "article");
  assert(isWordGuess("elephants", "Éléphant"), "accent + pluriel");
  assert(isWordGuess("kangouru", "Kangourou"), "1 faute");
  assert(!isWordGuess("chien", "Chat"), "faux");
});

test("démarre en « prêt », le donneur lance son chrono", () => {
  const s0 = createTaboo(P, {}, ctx());
  assert(s0.phase === "ready" && s0.deadline != null && totalTurns(s0) === 4, "prêt");
  const other = s0.order.find((id) => id !== giverOf(s0))!;
  assert(act(s0, other, { kind: "start" }).state.phase === "ready", "seul le donneur lance");
  const s = act(s0, giverOf(s0)!, { kind: "start" }).state;
  assert(s.phase === "turn" && !!s.current, "chrono lancé");
});

test("la carte n'est visible que du donneur (et du censeur en oral)", () => {
  const s = started("ecrit");
  const g = giverOf(s)!;
  assert(projectTaboo(s, g).card?.word === s.current!.word, "donneur");
  for (const id of s.order.filter((x) => x !== g)) assert(projectTaboo(s, id).card === null, "caché");
  const o = started("oral");
  const c = censorOf(o)!;
  assert(!!c && c !== giverOf(o) && projectTaboo(o, c).card !== null, "censeur");
  const third = o.order.find((x) => x !== giverOf(o) && x !== c)!;
  assert(projectTaboo(o, third).card === null, "devineur");
});

test("écrit : indice propre diffusé, indice interdit bloqué (−50, carte perdue)", () => {
  let s = started("ecrit");
  const g = giverOf(s)!;
  const card = s.current!;
  s = act(s, g, { kind: "clue", text: "un indice sans risque zzz" }).state;
  assert(s.log.some((m) => m.kind === "clue"), "diffusé");
  const r = act(s, g, { kind: "clue", text: `c'est comme ${card.forbidden[0]}` });
  assert(r.error?.code === "forbidden_word", "erreur");
  assert(!r.state.log.some((m) => m.text.includes(`comme ${card.forbidden[0]}`)), "jamais diffusé");
  assert(r.state.scores[g] === -TABOO_SLIP_PENALTY && r.state.played[0].outcome === "forbidden", "pénalité");
  assert(r.state.current !== card, "nouvelle carte");
});

test("écrit : dire le mot lui-même est aussi interdit", () => {
  const s = started("ecrit");
  const r = act(s, giverOf(s)!, { kind: "clue", text: s.current!.word });
  assert(r.error?.code === "forbidden_word", "bloqué");
});

test("écrit : bonne réponse → +100 / +100, carte suivante", () => {
  let s = started("ecrit");
  const g = giverOf(s)!;
  const finder = s.order.find((id) => id !== g)!;
  const word = s.current!.word;
  s = act(s, finder, { kind: "guess", text: "n'importe quoi" }).state;
  assert(s.log.some((m) => m.kind === "guess"), "proposition visible");
  s = act(s, finder, { kind: "guess", text: word.toLowerCase() }).state;
  assert(s.scores[g] === TABOO_FOUND_POINTS && s.scores[finder] === TABOO_FOUND_POINTS, "points");
  assert(s.played[0].outcome === "found" && s.current!.word !== word, "carte suivante");
});

test("le donneur ne peut pas deviner, les autres ne peuvent pas donner d'indice", () => {
  let s = started("ecrit");
  const g = giverOf(s)!;
  const other = s.order.find((id) => id !== g)!;
  const word = s.current!.word;
  s = act(s, g, { kind: "guess", text: word }).state;
  s = act(s, other, { kind: "clue", text: "triche" }).state;
  assert(s.played.length === 0 && s.log.length === 0, "rien");
});

test("passer : 0 point, carte suivante", () => {
  let s = started();
  const first = s.current;
  s = act(s, giverOf(s)!, { kind: "pass" }).state;
  assert(s.played[0].outcome === "passed" && s.current !== first && Object.values(s.scores).every((v) => v === 0), "passé");
});

test("oral : le donneur désigne qui a trouvé ; le censeur buzze", () => {
  let s = started("oral");
  const g = giverOf(s)!;
  const c = censorOf(s)!;
  const finder = s.order.find((id) => id !== g && id !== c)!;
  assert(act(s, g, { kind: "found", finderId: c }).state.played.length === 0, "le censeur ne peut pas trouver");
  s = act(s, g, { kind: "found", finderId: finder }).state;
  assert(s.scores[g] === 100 && s.scores[finder] === 100, "trouvé");
  assert(act(s, finder, { kind: "buzz" }).state.played.length === 1, "seul le censeur buzze");
  s = act(s, c, { kind: "buzz" }).state;
  assert(s.played[1].outcome === "forbidden" && s.scores[g] === 50, "buzz −50");
});

test("fin du chrono → récap (carte en cours non comptée) → joueur suivant", () => {
  let s = started();
  const g1 = giverOf(s);
  s = act(s, g1!, { kind: "pass" }).state;
  s = adv(s);
  assert(s.phase === "recap" && s.played.length === 1 && projectTaboo(s, "a").recap?.played.length === 1, "récap");
  s = adv(s);
  assert(s.phase === "ready" && giverOf(s) !== g1, "suivant");
});

test("tour de table complet → final ; chacun a fait deviner une fois", () => {
  let s = createTaboo(P, { totalRounds: 1 }, ctx());
  const givers: string[] = [];
  let n = 0;
  while (s.phase !== "final" && n++ < 50) {
    if (s.phase === "ready") givers.push(giverOf(s)!);
    s = adv(s);
  }
  assert(s.phase === "final" && new Set(givers).size === 4 && givers.length === 4, `${givers.join(",")}`);
});

test("un donneur absent est sauté", () => {
  let s = createTaboo(P, {}, ctx());
  const g = giverOf(s)!;
  s = reduceTaboo(s, { type: "presence", connectedIds: s.order.filter((id) => id !== g) }, ctx()).state;
  assert(s.phase === "ready" && giverOf(s) !== g, "sauté");
});

test("un arrivant fera deviner à la fin du tour de table", () => {
  let s = createTaboo(P, {}, ctx());
  s = reduceTaboo(s, { type: "presence", connectedIds: [...s.order, "z"], players: [...P, { id: "z", name: "Z", color: "#fff" }] }, ctx()).state;
  assert(s.order[s.order.length - 1] === "z" && totalTurns(s) === 5 && s.scores.z === 0, "ajouté");
});

test("cartes perso « mot | interdit, interdit »", () => {
  resetCustomTabooCards();
  const cards = parseTabooCards("# test\nKarim | Copain, Barbe, Rire\nPizza | Italie\nsans barre");
  assert(cards.length === 2 && cards[0].forbidden.length === 3, "parse");
  const before = tabooBank().length;
  addCustomTabooCards(cards);
  assert(tabooBank().length === before + 1, "Pizza existe déjà");
  resetCustomTabooCards();
});

test("module : résultat standard et distinctions", () => {
  let s = tabooModule.createState(P, tabooModule.sanitizeSettings({}), ctx());
  s = act(s, giverOf(s)!, { kind: "start" }).state;
  const g = giverOf(s)!;
  const finder = s.order.find((id) => id !== g)!;
  s = act(s, finder, { kind: "guess", text: s.current!.word }).state;
  while (!tabooModule.isOver(s)) s = adv(s);
  const r = tabooModule.results(s)!;
  assert(r.scores[g] === 100 && r.scores[finder] === 100, "scores");
  assert(!!r.awards?.some((a) => a.id === "best_orator" && a.playerId === g), "langue bien pendue");
  const v = tabooModule.sanitizeSettings({ seconds: 5, totalRounds: 99, mode: "?" });
  assert(v.seconds === 30 && v.totalRounds === 4 && v.mode === "ecrit", JSON.stringify(v));
});

done();
