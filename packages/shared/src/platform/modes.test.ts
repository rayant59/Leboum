// Run: npx tsx src/platform/modes.test.ts
// Phase 2 — chaque Game Mode respecte le socle commun : fiche catalogue,
// cycle de vie complet (création → fin) et résultat standard exploitable.
import type { GamePlayer } from "../game/types";
import type { AnyGameModule, GameContext } from "./types";
import { GAME_CATALOG, gameInfo, gamesByCategory, listedGames } from "./catalog";
import { rankResult, type GameResult } from "./result";
import { bombeResults } from "./standard";
import { addCustomQuestions, parseCustomQuestions } from "../games/quiz/questions";
import { doublageModule } from "../games/doublage/module";
import { bombeModule } from "../games/bombe/module";
import { ALL_GAME_MODULES } from "./registry";
import { assert, done, test } from "../testing";

addCustomQuestions(parseCustomQuestions(["Capitale de l'Italie ? = Rome", "Couleur du ciel ? = bleu", "Capitale du Japon ? = Tokyo", "Plus grand ocean ? = Pacifique", "Quel animal aboie ? = chien"].join("\n")));


const players: GamePlayer[] = [
  { id: "a", name: "Ana", color: "#f00" },
  { id: "b", name: "Bob", color: "#0f0" },
  { id: "c", name: "Cid", color: "#00f" },
];
let t = 1_000_000;
const ctx = (): GameContext => ({ now: (t += 60_000), rng: Math.random });

console.log("\nPlateforme — Game Modes standardisés\n");

test("chaque module enregistré a une fiche catalogue", () => {
  for (const m of ALL_GAME_MODULES) assert(!!GAME_CATALOG[m.id], `fiche manquante : ${m.id}`);
});

test("les fiches catalogue sont complètes (nom, règles, catégorie, durée)", () => {
  for (const g of Object.values(GAME_CATALOG)) {
    assert(g.name.length > 1 && g.tagline.length > 3, `${g.id} : nom/accroche`);
    assert(g.rules.length >= 1, `${g.id} : règles`);
    assert(g.durationMin > 0, `${g.id} : durée`);
    assert(g.minPlayers >= 1 && g.maxPlayers >= g.minPlayers, `${g.id} : joueurs`);
    assert(["creatif", "reflexion", "social", "chaos", "culture"].includes(g.category), `${g.id} : catégorie`);
  }
});

test("joueurs min/max du catalogue = ceux du moteur", () => {
  for (const m of ALL_GAME_MODULES) {
    const g = GAME_CATALOG[m.id];
    assert(g.minPlayers === m.meta.minPlayers, `${m.id} min ${g.minPlayers} ≠ ${m.meta.minPlayers}`);
    assert(g.maxPlayers === m.meta.maxPlayers, `${m.id} max ${g.maxPlayers} ≠ ${m.meta.maxPlayers}`);
  }
});

test("familles de la phase 13 : chaque jeu du lobby est rangé au bon endroit", () => {
  const fam = Object.fromEntries(gamesByCategory().map((f) => [f.category, f.games.map((g) => g.id)]));
  const expect: Record<string, string[]> = {
    creatif: ["draw", "reco", "phone"],
    reflexion: ["quiz", "taboo", "ranking"],
    social: ["whois", "funny", "imposter", "guesswho", "yesno"],
    chaos: ["bombe", "pixel"],
  };
  for (const [cat, ids] of Object.entries(expect)) for (const id of ids) assert((fam[cat] ?? []).includes(id), `${id} devrait être en ${cat}`);
  const all = gamesByCategory().flatMap((f) => f.games.map((g) => g.id));
  assert(all.length === listedGames().length && new Set(all).size === all.length, "chaque jeu listé une seule fois");
});

test("gameInfo() a un repli pour un jeu inconnu", () => {
  assert(gameInfo("nope").name === "Prochain jeu", "repli");
  assert(listedGames().every((g) => g.listed), "listés");
});

/** Fait avancer un module jusqu'à la fin, uniquement par le chrono. */
function runToEnd(mod: AnyGameModule, settings: unknown = undefined, max = 400) {
  let s = mod.createState(players, mod.sanitizeSettings(settings), ctx());
  for (let i = 0; i < max && !mod.isOver(s); i++) {
    const next = mod.reduce(s, { type: "advance" }, ctx()).state;
    if (next !== s) { s = next; continue; }
    // Phases pilotées par l'hôte (Mimic : « Lancer », « Manche suivante »).
    for (const kind of ["start", "next"]) s = mod.reduce(s, { type: "client", playerId: "a", msg: { kind } }, ctx()).state;
  }
  return s;
}

// Tous les jeux du registre (sauf ceux testés à part) : un nouveau jeu est couvert automatiquement.
for (const mod of ALL_GAME_MODULES.filter((m) => m.id !== "bombe" && m.id !== "doublage")) {
  test(`${mod.id} : va au bout et renvoie un résultat standard`, () => {
    const s0 = mod.createState(players, mod.sanitizeSettings(undefined), ctx());
    assert(mod.results(s0) === null, "pas de résultat avant la fin");
    const s = runToEnd(mod);
    assert(mod.isOver(s), "la partie se termine");
    const r = mod.results(s) as GameResult;
    assert(!!r, "résultat présent");
    for (const p of players) assert(typeof r.scores[p.id] === "number", `score de ${p.id}`);
    const ranked = rankResult(r, players.map((p) => p.id));
    assert(ranked.length === 3 && ranked[0].place === 1, "classement");
  });
}

// Phase 17 — contrat commun : « advance » = chrono écoulé OU l'hôte passe. Un jeu ne doit
// pas ignorer le bouton « Passer » de l'hôte en attendant que son chrono sonne.
for (const mod of ALL_GAME_MODULES.filter((m) => m.id !== "doublage")) {
  test(`${mod.id} : l'hôte peut passer une phase chronométrée avant la fin du chrono`, () => {
    const T = 5_000_000;
    let s = mod.createState(players, mod.sanitizeSettings(undefined), { now: T, rng: Math.random });
    // Première phase chronométrée (Mimic commence par une phase lancée par l'hôte).
    for (let i = 0; i < 3 && mod.deadline(s) == null; i++) s = mod.reduce(s, { type: "client", playerId: "a", msg: { kind: "start" } }, { now: T, rng: Math.random }).state;
    const d = mod.deadline(s);
    if (d == null) return; // aucune phase chronométrée au départ : rien à passer
    const next = mod.reduce(s, { type: "advance" }, { now: T + 1, rng: Math.random }).state;
    assert(next !== s && JSON.stringify(next) !== JSON.stringify(s), "« Passer » ignoré tant que le chrono n'a pas sonné");
  });
}

test("bombe : va au bout, le survivant est 1er", () => {
  const s = runToEnd(bombeModule, { lives: 1 }, 2000);
  assert(bombeModule.isOver(s), "fin");
  const r = bombeModule.results(s)!;
  assert(!!r.order && r.order.length === 3, "ordre complet");
  if (s.winnerId) assert(r.order![0] === s.winnerId, "vainqueur en tête");
});

test("doublage : pas de score, jamais compté", () => {
  const s = doublageModule.createState(players, doublageModule.sanitizeSettings(undefined), ctx());
  assert(doublageModule.results(s) === null, "null");
});

test("rankResult : égalités = même place", () => {
  const r = rankResult({ scores: { a: 10, b: 10, c: 3 } }, ["a", "b", "c"]);
  assert(r[0].place === 1 && r[1].place === 1 && r[2].place === 3, JSON.stringify(r));
});

test("rankResult : l'ordre explicite prime sur les scores", () => {
  const r = rankResult({ scores: { a: 99, b: 1, c: 5 }, order: ["b", "c", "a"] }, ["a", "b", "c"]);
  assert(r.map((x) => x.id).join() === "b,c,a", JSON.stringify(r));
});

test("bombeResults : vainqueur, puis éliminés du dernier au premier", () => {
  const s = {
    players, order: ["a", "b", "c"], eliminated: ["c", "a"], winnerId: "b",
    lives: { a: 0, b: 2, c: 0 }, wordsFound: { a: 4, b: 2, c: 7 }, config: { mode: "classic" },
  } as unknown as Parameters<typeof bombeResults>[0];
  const r = bombeResults(s);
  assert(r.order!.join() === "b,a,c", r.order!.join());
  assert(r.awards![0].playerId === "c", "Dico vivant = c");
});

done();
