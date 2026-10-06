// Run: npx tsx src/platform/fuzz.test.ts
// Robustesse : aucun jeu ne doit planter sur un message client mal formé ou
// inconnu, quelle que soit la phase (un plantage ferait tomber le serveur).
// (Les messages qui ne sont pas des objets `{ kind: string }` sont filtrés par le serveur.)
import { GAME_REGISTRY } from "./registry";
import { assert, done, test } from "../testing";

const PLAYERS = ["a", "b", "c", "d"].map((id, i) => ({ id, name: `J${i}`, color: "#fff" }));
const KINDS = ["guess", "submit", "vote", "answer", "choose_word", "start", "next", "clue", "ask", "reply", "buzz", "rank", "order", "pick", "skip", "end_drawing", "reveal_theme", "record", "take", "ready", "nope"];
const JUNK: unknown[] = [undefined, null, 42, "", "x".repeat(5000), {}, [], [1, "a"], { text: 5 }, true];

function seeded(seed: number) {
  let a = seed;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

console.log("\nRobustesse — messages mal formés envoyés à chaque jeu\n");

for (const mod of Object.values(GAME_REGISTRY)) {
  test(`${mod.id} : aucun plantage sur 5 × 600 messages aléatoires`, () => {
   for (const seed of [7, 11, 23, 42, 99]) {
    const rng = seeded(seed);
    let now = 1_000_000;
    const ctx = () => ({ now, rng });
    let state = mod.createState(PLAYERS.slice(0, Math.max(mod.meta.minPlayers, 4)), mod.sanitizeSettings({}), ctx());
    for (let i = 0; i < 600; i++) {
      now += 700;
      const r = rng();
      const pid = PLAYERS[Math.floor(rng() * 4)].id;
      let action: unknown;
      if (r < 0.12) action = { type: "advance" };
      else {
        const msg: Record<string, unknown> = { kind: KINDS[Math.floor(rng() * KINDS.length)] };
        for (const key of ["text", "word", "token", "targetId", "choice", "index", "order", "lines", "answer", "value", "id"]) {
          if (rng() < 0.3) msg[key] = JUNK[Math.floor(rng() * JUNK.length)];
        }
        // Le serveur écarte déjà tout message qui n'est pas un objet avec un `kind` texte.
        action = { type: "client", playerId: pid, msg };
      }
      try {
        state = mod.reduce(state, action as never, ctx()).state;
        mod.project(state, pid);
        mod.deadline(state);
        if (mod.isOver(state)) mod.results(state);
      } catch (e) {
        throw new Error(`graine ${seed}, message ${i} ${JSON.stringify(action).slice(0, 160)} → ${(e as Error).message}`);
      }
    }
   }
    assert(true, "ok");
  });
}

done();
