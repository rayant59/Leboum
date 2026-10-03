// Run: npx tsx src/games/imposter/engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameContext } from "../../platform/types";
import {
  IMPOSTER_ESCAPE_POINTS,
  IMPOSTER_STEAL_POINTS,
  IMPOSTER_VOTE_POINTS,
  createImposter,
  isImposterGuessRight,
  projectImposter,
  reduceImposter,
} from "./engine";
import { imposterModule } from "./module";
import { addCustomImposterPairs, imposterBank, parseImposterPairs, resetCustomImposterPairs } from "./words";
import type { ImposterClientAction, ImposterState } from "./types";
import { assert, done, test } from "../../testing";


const P: GamePlayer[] = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), color: "#fff" }));
let t = 1000;
let seed = 7;
const rng = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const ctx = (): GameContext => ({ now: (t += 1000), rng });
const act = (s: ImposterState, from: string, msg: ImposterClientAction) => reduceImposter(s, { type: "client", playerId: from, msg }, ctx());
const adv = (s: ImposterState) => reduceImposter(s, { type: "advance" }, ctx()).state;

/** Tout le monde a vu sa carte → indices. */
function toClues(s: ImposterState) {
  for (const id of s.roster) s = act(s, id, { kind: "seen" }).state;
  return s;
}
/** Chaque joueur donne un indice jusqu'au vote. */
function giveAllClues(s: ImposterState) {
  let n = 0;
  while (s.phase === "clues" && n++ < 50) s = act(s, s.order[s.turn], { kind: "clue", text: `indice ${n}` }).state;
  return s;
}
/** Tous les votes vont à `target` (le target lui-même vote pour un autre). */
function voteAll(s: ImposterState, target: string) {
  for (const id of s.roster) {
    const to = id === target ? s.roster.find((x) => x !== target)! : target;
    s = act(s, id, { kind: "vote", targetId: to }).state;
  }
  return s;
}

console.log("\nImposteur\n");

test("la banque est fournie (≥ 80 paires) et sans paire identique", () => {
  const bank = imposterBank();
  assert(bank.length >= 80, `${bank.length} paires`);
  assert(bank.every((p) => p.word && p.decoy && p.word !== p.decoy), "paires valides");
});

test("démarre en phase secrète, un imposteur dans la table", () => {
  const s = createImposter(P, { totalRounds: 3 }, ctx());
  assert(s.phase === "secret" && s.deadline != null, "phase secrète");
  assert(s.roster.length === 4 && s.roster.includes(s.imposterId), "imposteur");
  assert(s.pairs.length === 3, "3 manches");
});

test("classique : l'imposteur n'a pas le mot, les autres oui", () => {
  const s = createImposter(P, { mode: "classique" }, ctx());
  const word = s.pairs[0].word;
  for (const id of s.roster) {
    const v = projectImposter(s, id);
    if (id === s.imposterId) assert(v.yourWord === null && v.youAreImposter, "imposteur sans mot");
    else assert(v.yourWord === word && !v.youAreImposter, "citoyen avec le mot");
  }
});

test("classique : l'imposteur ne parle jamais en premier", () => {
  for (let i = 0; i < 25; i++) {
    const s = createImposter(P, { mode: "classique" }, ctx());
    assert(s.order[0] !== s.imposterId, "pas en premier");
  }
});

test("infiltré : l'imposteur a un mot voisin et ne sait pas qu'il l'est", () => {
  const s = createImposter(P, { mode: "infiltre" }, ctx());
  const v = projectImposter(s, s.imposterId);
  assert(v.yourWord === s.pairs[0].decoy && !v.youAreImposter, "mot voisin, rôle caché");
});

test("le secret ne fuit pas : ni l'imposteur ni les votes avant la révélation", () => {
  let s = toClues(createImposter(P, {}, ctx()));
  s = giveAllClues(s);
  const someone = s.roster.find((id) => id !== s.imposterId)!;
  s = act(s, someone, { kind: "vote", targetId: s.imposterId }).state;
  const v = projectImposter(s, someone);
  assert(v.reveal === null, "pas de révélation");
  assert(!JSON.stringify(v).includes(`"imposterId"`), "imposteur caché");
  assert(v.votedIds.length === 1 && v.yourVote === s.imposterId, "seul son propre vote");
});

test("tout le monde a vu sa carte → phase indices", () => {
  const s = toClues(createImposter(P, {}, ctx()));
  assert(s.phase === "clues" && s.turn === 0 && s.pass === 1, "indices");
});

test("seul le joueur dont c'est le tour peut donner un indice", () => {
  const s = toClues(createImposter(P, {}, ctx()));
  const other = s.order[1];
  const r = act(s, other, { kind: "clue", text: "hop" });
  assert(r.state.clues.length === 0, "refusé");
});

test("interdit de donner le mot lui-même comme indice", () => {
  let s = toClues(createImposter(P, { mode: "classique" }, ctx()));
  const first = s.order[0];
  const r = act(s, first, { kind: "clue", text: `un ${s.pairs[0].word.toUpperCase()} !` });
  assert(!!r.error && r.state.clues.length === 0, "refusé");
  s = act(s, first, { kind: "clue", text: "quelque chose" }).state;
  assert(s.clues.length === 1 && s.turn === 1, "accepté");
});

test("2 tours d'indices à 4 joueurs, puis le vote", () => {
  let s = toClues(createImposter(P, {}, ctx()));
  s = giveAllClues(s);
  assert(s.clues.length === 8 && s.phase === "vote", `${s.clues.length} indices, ${s.phase}`);
});

test("1 seul tour d'indices à 7 joueurs", () => {
  const P7: GamePlayer[] = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id, name: id, color: "#fff" }));
  let s = toClues(createImposter(P7, {}, ctx()));
  s = giveAllClues(s);
  assert(s.clues.length === 7 && s.phase === "vote", "1 tour");
});

test("chrono écoulé : le joueur passe son tour (indice vide)", () => {
  let s = toClues(createImposter(P, {}, ctx()));
  const cur = s.order[0];
  s = adv(s);
  assert(s.clues[0].playerId === cur && s.clues[0].text === "" && s.turn === 1, "tour sauté");
});

test("imposteur démasqué (classique) → dernière chance, raté → +100 aux bons votants", () => {
  let s = giveAllClues(toClues(createImposter(P, { mode: "classique" }, ctx())));
  const imp = s.imposterId;
  s = voteAll(s, imp);
  assert(s.phase === "guess" && s.accused[0] === imp, "dernière chance");
  s = act(s, imp, { kind: "guess", text: "n'importe quoi" }).state;
  assert(s.phase === "reveal" && s.outcome === "caught", "démasqué");
  for (const id of s.roster) {
    if (id === imp) assert((s.scores[id] ?? 0) === 0, "imposteur à 0");
    else assert(s.scores[id] === IMPOSTER_VOTE_POINTS, `${id} +100`);
  }
});

test("imposteur démasqué qui trouve le mot → vole la manche (+150)", () => {
  let s = giveAllClues(toClues(createImposter(P, { mode: "classique" }, ctx())));
  const imp = s.imposterId;
  s = voteAll(s, imp);
  const word = s.pairs[s.index].word;
  s = act(s, imp, { kind: "guess", text: word.toLowerCase() }).state;
  assert(s.outcome === "stolen" && s.scores[imp] === IMPOSTER_STEAL_POINTS, "volé");
});

test("imposteur pas démasqué → +250 pour lui, 0 pour les autres", () => {
  let s = giveAllClues(toClues(createImposter(P, {}, ctx())));
  const imp = s.imposterId;
  const innocent = s.roster.find((id) => id !== imp)!;
  s = voteAll(s, innocent);
  assert(s.phase === "reveal" && s.outcome === "escaped", "échappé");
  assert(s.scores[imp] === IMPOSTER_ESCAPE_POINTS, "+250");
  assert(s.roster.filter((id) => id !== imp).every((id) => s.scores[id] === 0), "autres à 0");
});

test("égalité au vote → l'imposteur s'en sort", () => {
  let s = giveAllClues(toClues(createImposter(P, {}, ctx())));
  const imp = s.imposterId;
  const [x, y, z] = s.roster.filter((id) => id !== imp);
  // imp et x à 2 votes chacun.
  s = act(s, x, { kind: "vote", targetId: imp }).state;
  s = act(s, y, { kind: "vote", targetId: imp }).state;
  s = act(s, z, { kind: "vote", targetId: x }).state;
  s = act(s, imp, { kind: "vote", targetId: x }).state;
  assert(s.outcome === "escaped" && s.accused.length === 2, "égalité");
});

test("pas de vote contre soi-même", () => {
  const s = giveAllClues(toClues(createImposter(P, {}, ctx())));
  const r = act(s, "a", { kind: "vote", targetId: "a" });
  assert(!!r.error && !r.state.votes.a, "refusé");
});

test("en infiltré, pas de dernière chance : démasqué = révélation directe", () => {
  let s = giveAllClues(toClues(createImposter(P, { mode: "infiltre" }, ctx())));
  s = voteAll(s, s.imposterId);
  assert(s.phase === "reveal" && s.outcome === "caught", "révélation");
  const v = projectImposter(s, "a");
  assert(v.reveal?.decoy === s.pairs[s.index].decoy, "mot voisin révélé");
});

test("le rôle d'imposteur tourne d'une manche à l'autre", () => {
  let s = createImposter(P, { totalRounds: 4 }, ctx());
  const seen = new Set<string>();
  for (let r = 0; r < 4; r++) {
    seen.add(s.imposterId);
    s = giveAllClues(toClues(s));
    s = adv(adv(s)); // vote (chrono) → révélation / dernière chance
    while (s.phase !== "secret" && s.phase !== "final") s = adv(s);
  }
  assert(seen.size === 4 && s.phase === "final", `${seen.size} imposteurs différents`);
});

test("un joueur déconnecté est sauté pendant les indices", () => {
  let s = toClues(createImposter(P, {}, ctx()));
  const second = s.order[1];
  s = reduceImposter(s, { type: "presence", connectedIds: s.roster.filter((id) => id !== second || id === s.imposterId) }, ctx()).state;
  if (second !== s.imposterId) {
    s = act(s, s.order[0], { kind: "clue", text: "un" }).state;
    assert(s.order[s.turn] !== second, "sauté");
  }
});

test("l'imposteur quitte la partie → manche annulée sans points", () => {
  let s = toClues(createImposter(P, {}, ctx()));
  const imp = s.imposterId;
  s = reduceImposter(s, { type: "presence", connectedIds: s.roster.filter((id) => id !== imp) }, ctx()).state;
  assert(s.phase === "reveal" && s.outcome === "left", "annulée");
  assert(Object.values(s.scores).every((v) => v === 0), "aucun point");
});

test("un joueur arrivé en cours attend la manche suivante", () => {
  let s = createImposter(P, { totalRounds: 2 }, ctx());
  const late: GamePlayer = { id: "z", name: "Zoé", color: "#fff" };
  s = reduceImposter(s, { type: "presence", connectedIds: [...s.roster, "z"], players: [...P, late] }, ctx()).state;
  assert(!s.roster.includes("z") && s.scores.z === 0, "spectateur");
  assert(projectImposter(s, "z").yourWord === null, "pas de mot");
  s = giveAllClues(toClues(s));
  s = adv(s);
  while (s.phase !== "secret" && s.phase !== "final") s = adv(s);
  assert(s.roster.includes("z"), "joue la manche 2");
});

test("vérification du mot : accents, articles, pluriel, 1 faute", () => {
  assert(isImposterGuessRight("la creme", "Crème"), "accent + article");
  assert(isImposterGuessRight("croissants", "Croissant"), "pluriel");
  assert(isImposterGuessRight("pingoin", "Pingouin"), "1 faute");
  assert(!isImposterGuessRight("chat", "Chien"), "faux");
  assert(isImposterGuessRight("oeuf au plat", "Œuf au plat"), "œ");
});

test("mots perso : « catégorie | mot | mot proche »", () => {
  resetCustomImposterPairs();
  const before = imposterBank().length;
  const pairs = parseImposterPairs("# commentaire\nSéries | Friends | How I Met Your Mother\nRaclette | Tartiflette\nligne invalide");
  assert(pairs.length === 2 && pairs[1].category === "Perso", "parse");
  addCustomImposterPairs(pairs);
  addCustomImposterPairs(pairs);
  assert(imposterBank().length === before + 1, "Raclette existe déjà, pas de doublon");
  resetCustomImposterPairs();
});

test("module : résultat standard + distinctions", () => {
  let s = imposterModule.createState(P, imposterModule.sanitizeSettings({ totalRounds: 1 }), ctx());
  assert(imposterModule.results(s) === null, "pas avant la fin");
  s = giveAllClues(toClues(s));
  const imp = s.imposterId;
  s = voteAll(s, s.roster.find((id) => id !== imp)!);
  s = adv(s);
  assert(imposterModule.isOver(s), "fin");
  const r = imposterModule.results(s)!;
  assert(r.scores[imp] === IMPOSTER_ESCAPE_POINTS, "score");
  assert(!!r.awards?.some((a) => a.id === "best_liar" && a.playerId === imp), "meilleur menteur");
});

test("réglages bornés", () => {
  const v = imposterModule.sanitizeSettings({ totalRounds: 99, seconds: 1, mode: "nimp" });
  assert(v.totalRounds === 10 && v.seconds === 10 && v.mode === "classique", JSON.stringify(v));
});

done();
