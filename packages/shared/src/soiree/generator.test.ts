// Run: npx tsx src/soiree/generator.test.ts
import { GAME_CATALOG } from "../platform/catalog";
import { GAME_REGISTRY } from "../platform/registry";
import { SOIREE_FORMATS, SURPRISE_GAME_ID, estimateMinutes, generateSoiree, pickSurpriseGame, soireeSettings, surpriseProgramme } from "./generator";
import { assert, done, test } from "../testing";

let seed = 3;
const rng = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

console.log("\nGénérateur de soirée\n");

test("les formats du PDF existent (rapide, 45 min, chaos)", () => {
  for (const id of ["rapide", "45min", "chaos"]) assert(SOIREE_FORMATS.some((f) => f.id === id), id);
});

test("Soirée rapide = Boum Rush, Qui de nous ?, La Plus Drôle", () => {
  assert(generateSoiree("rapide", 5, rng).map((i) => i.gameId).join() === "bombe,whois,funny", "rapide");
});

test("Soirée Chaos = Pixel Panic, Boum Rush, Imposteur, Ni oui ni non", () => {
  assert(generateSoiree("chaos", 5, rng).map((i) => i.gameId).join() === "pixel,bombe,imposter,yesno", "chaos");
});

test("Soirée 45 min = Social ×2, Créatif, Réflexion, Chaos (sans doublon)", () => {
  for (let k = 0; k < 20; k++) {
    const ids = generateSoiree("45min", 5, rng).map((i) => i.gameId);
    const cats = ids.map((id) => GAME_CATALOG[id].category);
    const count = (c: string) => cats.filter((x) => x === c).length;
    assert(ids.length === 5 && new Set(ids).size === 5, ids.join());
    assert(count("social") === 2 && count("creatif") === 1 && count("reflexion") === 1 && count("chaos") === 1, cats.join());
  }
});

test("tous les formats : uniquement des jeux jouables au nombre de joueurs", () => {
  for (const n of [2, 3, 4, 8, 12]) {
    for (const f of SOIREE_FORMATS) {
      const items = generateSoiree(f.id, n, rng);
      assert(items.length > 0, `${f.id} @${n} vide`);
      for (const it of items) {
        const g = GAME_CATALOG[it.gameId];
        assert(n >= g.minPlayers && n <= g.maxPlayers, `${f.id} @${n} : ${g.id} (${g.minPlayers}–${g.maxPlayers})`);
      }
      assert(new Set(items.map((i) => i.gameId)).size === items.length, `doublon ${f.id}`);
    }
  }
});

test("à 2 joueurs, un jeu imposé injouable est remplacé (Qui de nous ? → autre)", () => {
  const ids = generateSoiree("rapide", 2, rng).map((i) => i.gameId);
  assert(!ids.includes("whois") && !ids.includes("funny") && ids.length === 3, ids.join());
});

test("réglages : valides pour chaque module, raccourcis en format court", () => {
  for (const id of Object.keys(GAME_REGISTRY)) {
    const s = soireeSettings(id, true);
    assert(JSON.stringify(GAME_REGISTRY[id].sanitizeSettings(s)) === JSON.stringify(s), `${id} réglages stables`);
  }
  assert((soireeSettings("quiz", true) as { totalQuestions: number }).totalQuestions === 6, "quiz court");
});

test("durée estimée cohérente avec le format", () => {
  const items = generateSoiree("45min", 5, rng);
  const m = estimateMinutes(items);
  assert(m >= 30 && m <= 60, `${m} min`);
  assert(estimateMinutes(generateSoiree("rapide", 5, rng)) <= 20, "rapide");
});

test("soirée surprise : N emplacements, bornés", () => {
  assert(surpriseProgramme(5).length === 5 && surpriseProgramme(5).every((i) => i.gameId === SURPRISE_GAME_ID && i.surprise), "5 surprises");
  assert(surpriseProgramme(1).length === 2 && surpriseProgramme(99).length === 10, "bornes 2–10");
});

test("jeu surprise : jouable, pas déjà joué, varié", () => {
  const played: string[] = [];
  for (let i = 0; i < 8; i++) {
    const id = pickSurpriseGame(4, played, rng)!;
    const g = GAME_CATALOG[id];
    assert(!!g && g.listed && 4 >= g.minPlayers && 4 <= g.maxPlayers, `${id} jouable à 4`);
    assert(!played.includes(id), `${id} déjà joué`);
    played.push(id);
  }
  // Tous joués : on accepte une redite, mais jamais deux fois de suite.
  const all = Object.values(GAME_CATALOG).filter((g) => g.listed && 3 >= g.minPlayers && 3 <= g.maxPlayers).map((g) => g.id);
  for (let i = 0; i < 20; i++) assert(pickSurpriseGame(3, all, rng) !== all[all.length - 1], "pas deux fois de suite");
  assert(pickSurpriseGame(0, [], rng) === null, "aucun jeu à 0 joueur");
  const many = new Set(Array.from({ length: 60 }, () => pickSurpriseGame(4, [], rng)));
  assert(many.size >= 6, `tirage varié (${many.size} jeux)`);
});

done();
