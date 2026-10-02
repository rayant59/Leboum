// Run: npx tsx src/games/phone/engine.test.ts
import type { GamePlayer } from "../../game/types";
import type { GameContext } from "../../platform/types";
import { PHONE_DRAWING_MAX, PHONE_LIKE_POINTS, authorFor, chainFor, cleanPhoneContent, createPhone, projectPhone, reducePhone, stepKindOf } from "./engine";
import { phoneModule } from "./module";
import { addCustomPhonePhrases, phonePhraseBank, resetCustomPhonePhrases } from "./phrases";
import type { PhoneClientAction, PhoneState } from "./types";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  \u001b[32m✓\u001b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \u001b[31m✗ ${name}\u001b[0m\n      ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

const mk = (ids: string[]): GamePlayer[] => ids.map((id) => ({ id, name: id.toUpperCase(), color: "#fff" }));
const P = mk(["a", "b", "c", "d"]);
let t = 1000;
let seed = 3;
const rng = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const ctx = (): GameContext => ({ now: (t += 1000), rng });
const act = (s: PhoneState, from: string, msg: PhoneClientAction) => reducePhone(s, { type: "client", playerId: from, msg }, ctx());
const adv = (s: PhoneState) => reducePhone(s, { type: "advance" }, ctx()).state;
const IMG = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

/** Tout le monde rend quelque chose de valide pour l'étape courante. */
function playStep(s: PhoneState) {
  const kind = stepKindOf(s.step);
  for (const id of s.order) {
    if (s.phase !== "play") break;
    s = act(s, id, { kind: "submit", content: kind === "text" ? `texte de ${id} étape ${s.step}` : IMG }).state;
  }
  return s;
}

console.log("\nTéléphone cassé\n");

test("banque de phrases fournie (≥ 50)", () => {
  assert(phonePhraseBank().length >= 50, `${phonePhraseBank().length}`);
});

test("classique : 5 étapes max, alternance texte / dessin", () => {
  const s = createPhone(mk(["a", "b", "c", "d", "e", "f", "g"]), {}, ctx());
  assert(s.config.steps === 5, `${s.config.steps} étapes`);
  assert(["text", "drawing", "text", "drawing", "text"].every((k, i) => stepKindOf(i) === k), "alternance");
});

test("à 3 joueurs : 3 étapes (phrase, dessin, description)", () => {
  const s = createPhone(mk(["a", "b", "c"]), {}, ctx());
  assert(s.config.steps === 3, `${s.config.steps}`);
});

test("complet : une étape par joueur", () => {
  const s = createPhone(mk(["a", "b", "c", "d", "e", "f", "g"]), { mode: "complet" }, ctx());
  assert(s.config.steps === 7, `${s.config.steps}`);
});

test("personne ne retombe sur sa propre chaîne pendant la partie", () => {
  const s = createPhone(mk(["a", "b", "c", "d", "e"]), {}, ctx());
  for (let step = 1; step < s.config.steps; step++) {
    for (const id of s.order) assert(s.chains[chainFor(s, id, step)].ownerId !== id, `${id} étape ${step}`);
  }
  for (let step = 0; step < s.config.steps; step++) {
    const authors = s.order.map((_, c) => authorFor(s, c, step));
    assert(new Set(authors).size === s.order.length, "un rendu par joueur et par étape");
  }
});

test("étape 1 : chacun voit uniquement la phrase de la chaîne qu'il reçoit", () => {
  let s = playStep(createPhone(P, {}, ctx()));
  assert(s.step === 1 && s.phase === "play", "étape 2");
  for (const id of s.order) {
    const v = projectPhone(s, id);
    const c = chainFor(s, id, 1);
    assert(v.task?.kind === "drawing" && v.task.prev?.content === s.chains[c].entries[0].content, "phrase reçue");
    assert(v.album === null && v.reveal === null, "rien d'autre");
  }
});

test("on peut modifier son texte avant la fin de l'étape", () => {
  let s = createPhone(P, {}, ctx());
  s = act(s, "a", { kind: "submit", content: "v1" }).state;
  s = act(s, "a", { kind: "submit", content: "v2" }).state;
  assert(projectPhone(s, "a").yourContent === "v2" && s.step === 0, "modifié");
});

test("rendus invalides refusés (vide, pas une image, trop lourd)", () => {
  assert(cleanPhoneContent("text", "   ") === null, "vide");
  assert(cleanPhoneContent("drawing", "coucou") === null, "pas une image");
  assert(cleanPhoneContent("drawing", "data:image/png;base64," + "A".repeat(PHONE_DRAWING_MAX)) === null, "trop lourd");
  assert(cleanPhoneContent("drawing", IMG) === IMG, "image ok");
  assert(cleanPhoneContent("text", "x".repeat(500))!.length === 100, "texte tronqué");
  let s = playStep(createPhone(P, {}, ctx()));
  const r = act(s, s.order[0], { kind: "submit", content: "pas un dessin" });
  assert(!!r.error && r.state.pending[s.order[0]] == null, "dessin texte refusé");
});

test("chrono écoulé : phrase de secours à l'étape 1, rendu vide ensuite", () => {
  let s = createPhone(P, {}, ctx());
  s = act(s, "a", { kind: "submit", content: "ma phrase" }).state;
  s = adv(s);
  for (const c of s.chains) {
    const e = c.entries[0];
    if (e.authorId === "a") assert(e.content === "ma phrase" && !e.auto, "rendu gardé");
    else assert(e.auto === true && e.content.length > 0, "phrase de secours");
  }
  s = adv(s);
  assert(s.chains.every((c) => c.entries[1].content === "" && c.entries[1].auto), "dessins vides");
});

test("partie complète → révélation étape par étape → final", () => {
  let s = createPhone(P, {}, ctx());
  while (s.phase === "play") s = playStep(s);
  assert(s.phase === "reveal" && s.revealChain === 0 && s.revealShown === 1, "révélation");
  assert(s.chains.every((c) => c.entries.length === 4), "chaînes complètes");
  const v = projectPhone(s, "a");
  assert(v.reveal!.chain.entries.length === 1 && v.album === null, "une étape à la fois");
  let n = 0;
  while (s.phase === "reveal" && n++ < 100) s = adv(s);
  assert(s.phase === "final" && n === 16, `16 dévoilements (${n})`);
  const f = projectPhone(s, "b");
  assert(f.album!.length === 4 && f.album!.every((c) => c.entries.length === 4), "album complet");
});

test("« j'adore » : +100 à l'auteur, une fois, jamais pour soi, seulement ce qui est dévoilé", () => {
  let s = createPhone(P, {}, ctx());
  while (s.phase === "play") s = playStep(s);
  const author = s.chains[0].entries[0].authorId;
  const fan = s.order.find((id) => id !== author)!;
  s = act(s, author, { kind: "like", chain: 0, step: 0 }).state;
  assert((s.scores[author] ?? 0) === 0, "pas pour soi");
  s = act(s, fan, { kind: "like", chain: 0, step: 1 }).state;
  assert(Object.values(s.scores).every((v) => v === 0), "étape pas encore dévoilée");
  s = act(s, fan, { kind: "like", chain: 0, step: 0 }).state;
  s = act(s, fan, { kind: "like", chain: 0, step: 0 }).state;
  assert(s.scores[author] === PHONE_LIKE_POINTS && s.textLikes[author] === 1, "+100 une seule fois");
  assert(projectPhone(s, fan).reveal!.chain.entries[0].youLiked, "youLiked");
});

test("un absent ne bloque pas : on avance quand tous les présents ont rendu", () => {
  let s = createPhone(P, {}, ctx());
  s = reducePhone(s, { type: "presence", connectedIds: ["a", "b", "c"] }, ctx()).state;
  for (const id of ["a", "b", "c"]) s = act(s, id, { kind: "submit", content: "hop" }).state;
  assert(s.step === 1, "étape suivante");
  const lost = s.chains.find((c) => c.entries[0].authorId === "d")!;
  assert(lost.entries[0].auto === true, "rendu de d auto");
});

test("un arrivant regarde sans tâche", () => {
  let s = createPhone(P, {}, ctx());
  s = reducePhone(s, { type: "presence", connectedIds: ["a", "b", "c", "d", "z"], players: [...P, { id: "z", name: "Z", color: "#fff" }] }, ctx()).state;
  assert(projectPhone(s, "z").task === null && s.scores.z === 0, "spectateur");
});

test("les dessins ne sont jamais renvoyés pendant le jeu (allège le réseau)", () => {
  let s = playStep(createPhone(P, {}, ctx()));
  s = act(s, s.order[0], { kind: "submit", content: IMG }).state;
  assert(projectPhone(s, s.order[0]).yourContent === null, "pas d'écho du dessin");
  assert(projectPhone(s, s.order[1]).submittedIds.includes(s.order[0]), "mais on sait qu'il a rendu");
});

test("phrases perso sans doublon", () => {
  resetCustomPhonePhrases();
  const before = phonePhraseBank().length;
  addCustomPhonePhrases(["# commentaire", "Karim qui danse la macarena", "Karim qui danse la macarena", ""]);
  assert(phonePhraseBank().length === before + 1, "ajoutée une fois");
  resetCustomPhonePhrases();
});

test("module : résultat standard + Meilleur dessinateur", () => {
  let s = phoneModule.createState(P, phoneModule.sanitizeSettings({}), ctx());
  while (s.phase === "play") s = playStep(s);
  adv(s); // étape 1 de la chaîne 0 (texte) déjà visible ; on dévoile le dessin :
  s = adv(s);
  const drawer = s.chains[0].entries[1].authorId;
  const fan = s.order.find((id) => id !== drawer)!;
  s = act(s, fan, { kind: "like", chain: 0, step: 1 }).state;
  while (!phoneModule.isOver(s)) s = adv(s);
  const r = phoneModule.results(s)!;
  assert(r.scores[drawer] === 100, "score");
  assert(!!r.awards?.some((a) => a.id === "best_drawer" && a.playerId === drawer), "distinction");
});

test("réglages bornés", () => {
  const v = phoneModule.sanitizeSettings({ seconds: 9999, mode: "x" });
  assert(v.seconds === 180 && v.mode === "classique", JSON.stringify(v));
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed) process.exit(1);
