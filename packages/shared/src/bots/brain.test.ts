// Les bots de test savent-ils jouer à TOUS les mini-jeux jusqu'au bout ?
// Simulation pure : 4 bots, horloge simulée, uniquement les moteurs de jeu.
// Run: npx tsx src/bots/brain.test.ts
import { GAME_REGISTRY } from "../platform/registry";
import { createInitialState, reduce as reduceRoom } from "../room/engine";
import type { RoomState } from "../room/types";
import type { GamePlayer } from "../game/types";
import { addCustomQuestions, parseCustomQuestions } from "../games/quiz/questions";
import { addCustomRecoItems, parseCustomRecoItems } from "../games/reconnaissance/bank";
import { botDecide, botStroke, newBotMemory, type BotMedia, type BotMemory } from "./brain";

let passed = 0;
let failed = 0;
function assert(cond: unknown, name: string, detail = "") {
  if (cond) { passed++; console.log(`  \u001b[32m✓\u001b[0m ${name}`); }
  else { failed++; console.log(`  \u001b[31m✗ ${name}\u001b[0m ${detail}`); }
}

// La banque du quiz est vide par défaut (le contenu vient des dossiers de l'hôte).
addCustomQuestions(parseCustomQuestions([
  "Capitale de l'Italie ? = Rome", "Capitale du Japon ? = Tokyo", "Couleur du ciel ? = bleu",
  "Quel animal aboie ? = chien", "Plus grand océan ? = Pacifique", "Combien de continents ? = 7 | sept",
  "Astre au centre du système solaire ? = Soleil", "Combien de pattes a une araignée ? = 8 | huit",
  "Capitale de l'Espagne ? = Madrid", "Capitale de l'Allemagne ? = Berlin", "Combien de jours dans une semaine ? = 7",
  "Quel fruit est jaune et courbé ? = banane",
].join("\n")));

addCustomRecoItems(parseCustomRecoItems([
  "== Anime ==", "naruto.png | Qui est-ce ? = Naruto", "luffy.png | Qui est-ce ? = Luffy",
  "== Films ==", "titanic.png | Quel film ? = Titanic", "matrix.png | Quel film ? = Matrix",
  "== Marques ==", "nike.png | Quelle marque ? = Nike", "apple.png | Quelle marque ? = Apple",
].join("\n")));

// Générateur pseudo-aléatoire déterministe.
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const media: BotMedia = {
  drawing: () => "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
  voice: () => "data:audio/wav;base64,UklGRiQAAABXQVZF",
};

function makeRoom(ids: string[]): RoomState {
  let room = createInitialState("TEST", 0);
  for (const id of ids) room = reduceRoom(room, { type: "join", playerId: id, name: id, now: 0, bot: true }).state;
  return { ...room, phase: "in_game" };
}

console.log("bots — chaque mini-jeu se joue jusqu'au bout");
const SKIP = new Set(["doublage"]); // pas de fin : l'hôte pilote la vidéo
for (const mod of Object.values(GAME_REGISTRY)) {
  if (SKIP.has(mod.id)) continue;
  const ids = ["b1", "b2", "b3", "b4"].slice(0, Math.max(mod.meta.minPlayers, Math.min(4, mod.meta.maxPlayers)));
  const room = { ...makeRoom(ids), gameId: mod.id };
  const players: GamePlayer[] = ids.map((id) => ({ id, name: id, color: "#fff", avatar: null }));
  const rng = seeded(42 + mod.id.length);
  let now = 1_000_000;
  const ctx = () => ({ now, rng });
  let state = mod.createState(players, mod.sanitizeSettings(undefined), ctx());
  const mems = new Map<string, BotMemory>(ids.map((id) => [id, newBotMemory()]));
  let accepted = 0;
  let advances = 0;
  const limit = now + 4 * 3600_000; // 4 h simulées max
  while (!mod.isOver(state) && now < limit) {
    now += 250;
    for (const id of ids) {
      const out = botDecide({ botId: id, room, gameId: mod.id, pub: mod.project(state, id), internal: state, now, rng, skill: 0.6, media }, mems.get(id)!);
      for (const m of out) {
        if (m.type !== "game") continue;
        const r = mod.reduce(state, { type: "client", playerId: id, msg: m.action }, ctx());
        if (r.state !== state) accepted++;
        state = r.state;
      }
    }
    const dl = mod.deadline(state);
    if (dl != null && now >= dl) {
      state = mod.reduce(state, { type: "advance" }, ctx()).state;
      advances++;
    }
  }
  assert(mod.isOver(state), `${mod.id} : partie terminée par les bots`, `(${Math.round((now - 1_000_000) / 1000)} s simulées)`);
  assert(accepted > 0, `${mod.id} : les bots ont joué (${accepted} actions acceptées, ${advances} chronos)`);
}

console.log("bots — salon & dessin");
{
  let room = createInitialState("ROOM", 0);
  room = reduceRoom(room, { type: "join", playerId: "h", name: "Humain", now: 0 }).state;
  room = reduceRoom(room, { type: "join", playerId: "b", name: "Bot", now: 1, bot: true }).state;
  assert(room.players.b.isBot === true && !room.players.h.isBot, "le bot est marqué isBot");
  const out = (() => {
    const mem = newBotMemory();
    const base = { botId: "b", room, gameId: null, pub: null, internal: null, rng: seeded(1), skill: 0.5, media };
    botDecide({ ...base, now: 0 }, mem);
    return botDecide({ ...base, now: 5000 }, mem);
  })();
  assert(out.length === 1 && out[0].type === "set_ready", "au salon, le bot se met prêt");
  // L'hôte humain se déconnecte : la couronne ne part pas chez un bot s'il reste un humain.
  room = reduceRoom(room, { type: "join", playerId: "h2", name: "Humain 2", now: 2 }).state;
  room = reduceRoom(room, { type: "disconnect", playerId: "h", now: 3 }).state;
  assert(room.hostId === "h2", "couronne transmise à un humain plutôt qu'à un bot", room.hostId ?? "");
  const st = botStroke(seeded(3));
  assert(st.points.length > 3 && st.points.every((p) => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1), "trait de dessin dans le cadre");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
