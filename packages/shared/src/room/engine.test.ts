// Zero-dependency test runner. Run with: npx tsx engine.test.ts
// Kept dependency-free on purpose so the core rules can be verified anywhere,
// including CI, without pulling a test framework into the shared package.

import {
  canStart,
  createInitialState,
  DEFAULT_CONFIG,
  PASS_MAX_PLAYERS,
  passActive,
  reduce,
} from "./engine";
import type { RoomAction, RoomState } from "./types";
import { generateRoomCode, isValidRoomCode, sanitizeName } from "./util";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  \u001b[32m✓\u001b[0m ${name}`);
  } catch (err) {
    failed++;
    console.log(`  \u001b[31m✗ ${name}\u001b[0m`);
    console.log(`      ${(err as Error).message}`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
function eq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg} — attendu ${String(expected)}, obtenu ${String(actual)}`);
  }
}

// Small helper: apply a sequence of actions and return the final state.
function run(state: RoomState, ...actions: RoomAction[]): RoomState {
  return actions.reduce((s, a) => reduce(s, a).state, state);
}

const base = () => createInitialState("ABCD", 0);

console.log("\nRoom engine\n");

test("le premier joueur qui rejoint devient l'hôte", () => {
  const s = reduce(base(), { type: "join", playerId: "p1", name: "Alice", now: 1 }).state;
  eq(s.hostId, "p1", "hostId");
  assert(s.players["p1"].isHost, "p1 devrait être hôte");
  eq(s.playerOrder.length, 1, "un seul joueur");
});

test("les joueurs suivants ne sont pas hôtes", () => {
  const s = run(
    base(),
    { type: "join", playerId: "p1", name: "Alice", now: 1 },
    { type: "join", playerId: "p2", name: "Bob", now: 2 },
  );
  assert(!s.players["p2"].isHost, "p2 ne devrait pas être hôte");
  eq(s.hostId, "p1", "hôte inchangé");
});

test("les pseudos sont nettoyés (contrôle + chevrons retirés)", () => {
  const s = reduce(base(), {
    type: "join",
    playerId: "p1",
    name: "  <script>Éve</script>  ",
    now: 1,
  }).state;
  eq(s.players["p1"].name, "scriptÉve/script", "pseudo nettoyé");
});

test("un pseudo vide est rejeté", () => {
  const r = reduce(base(), { type: "join", playerId: "p1", name: "   ", now: 1 });
  eq(r.error?.code, "invalid_name", "code d'erreur");
  eq(r.state.playerOrder.length, 0, "aucun joueur ajouté");
});

test("la room refuse un joueur de trop", () => {
  let s = base();
  for (let i = 0; i < DEFAULT_CONFIG.maxPlayers; i++) {
    s = reduce(s, { type: "join", playerId: `p${i}`, name: `J${i}`, now: i }).state;
  }
  const r = reduce(s, { type: "join", playerId: "overflow", name: "Trop", now: 99 });
  eq(r.error?.code, "room_full", "room pleine");
  eq(r.state.playerOrder.length, DEFAULT_CONFIG.maxPlayers, "taille inchangée");
});

test("re-join avec le même id = reconnexion (pas de doublon)", () => {
  let s = run(
    base(),
    { type: "join", playerId: "p1", name: "Alice", now: 1 },
    { type: "disconnect", playerId: "p1", now: 2 },
  );
  assert(!s.players["p1"].isConnected, "p1 déconnecté");
  s = reduce(s, { type: "join", playerId: "p1", name: "Alice", now: 3 }).state;
  assert(s.players["p1"].isConnected, "p1 reconnecté");
  eq(s.playerOrder.length, 1, "toujours un seul joueur");
});

test("prêt / pas prêt fonctionne en lobby", () => {
  let s = reduce(base(), { type: "join", playerId: "p1", name: "Alice", now: 1 }).state;
  s = reduce(s, { type: "set_ready", playerId: "p1", ready: true, now: 2 }).state;
  assert(s.players["p1"].isReady, "p1 prêt");
  s = reduce(s, { type: "set_ready", playerId: "p1", ready: false, now: 3 }).state;
  assert(!s.players["p1"].isReady, "p1 plus prêt");
});

test("l'hôte ne peut pas lancer sans assez de joueurs prêts", () => {
  let s = run(
    base(),
    { type: "join", playerId: "p1", name: "Alice", now: 1 },
    { type: "join", playerId: "p2", name: "Bob", now: 2 },
    { type: "set_ready", playerId: "p1", ready: true, now: 3 },
    // un seul joueur prêt (1 < 2)
  );
  assert(!canStart(s), "canStart devrait être faux (1 < 2)");
  const r = reduce(s, { type: "start_game", playerId: "p1", gameId: "subtitles", now: 5 });
  eq(r.error?.code, "not_enough_ready", "erreur pas assez de prêts");
  eq(r.state.phase, "lobby", "toujours en lobby");
});

test("un non-hôte ne peut pas lancer la partie", () => {
  const s = run(
    base(),
    { type: "join", playerId: "p1", name: "Alice", now: 1 },
    { type: "join", playerId: "p2", name: "Bob", now: 2 },
    { type: "join", playerId: "p3", name: "Cléo", now: 3 },
    { type: "set_ready", playerId: "p1", ready: true, now: 4 },
    { type: "set_ready", playerId: "p2", ready: true, now: 5 },
    { type: "set_ready", playerId: "p3", ready: true, now: 6 },
  );
  const r = reduce(s, { type: "start_game", playerId: "p2", gameId: "subtitles", now: 7 });
  eq(r.error?.code, "not_host", "seul l'hôte peut lancer");
});

test("l'hôte lance la partie quand tout est prêt", () => {
  const s = run(
    base(),
    { type: "join", playerId: "p1", name: "Alice", now: 1 },
    { type: "join", playerId: "p2", name: "Bob", now: 2 },
    { type: "join", playerId: "p3", name: "Cléo", now: 3 },
    { type: "set_ready", playerId: "p1", ready: true, now: 4 },
    { type: "set_ready", playerId: "p2", ready: true, now: 5 },
    { type: "set_ready", playerId: "p3", ready: true, now: 6 },
  );
  assert(canStart(s), "canStart devrait être vrai");
  const r = reduce(s, { type: "start_game", playerId: "p1", gameId: "subtitles", now: 7 });
  assert(!r.error, "pas d'erreur");
  eq(r.state.phase, "in_game", "phase in_game");
  eq(r.state.gameId, "subtitles", "gameId posé");
});

test("l'hôte compte comme prêt sans cliquer « Je suis prêt »", () => {
  const duo = run(
    base(),
    { type: "join", playerId: "p1", name: "Alice", now: 1 },
    { type: "join", playerId: "p2", name: "Bob", now: 2 },
    { type: "set_ready", playerId: "p2", ready: true, now: 3 },
  );
  assert(canStart(duo, "draw"), "hôte + 1 invité prêt → lançable");
  const solo = run(base(), { type: "join", playerId: "p1", name: "Alice", now: 1 });
  assert(canStart(solo, "quiz"), "hôte seul → jeu solo lançable");
  assert(!canStart(solo, "draw"), "hôte seul → jeu à 2 non lançable");
  const r = reduce(solo, { type: "start_game", playerId: "p1", gameId: "quiz", now: 5 });
  assert(!r.error, "pas d'erreur en solo");
  eq(r.state.phase, "in_game", "partie solo lancée");
});

test("le créateur du salon récupère la couronne en se reconnectant", () => {
  let s = run(
    base(),
    { type: "join", playerId: "p1", name: "Alice", now: 1 },
    { type: "join", playerId: "p2", name: "Bob", now: 2 },
    { type: "disconnect", playerId: "p1", now: 3 },
  );
  eq(s.hostId, "p2", "Bob hérite pendant l'absence");
  s = reduce(s, { type: "reconnect", playerId: "p1", now: 4 }).state;
  eq(s.hostId, "p1", "Alice reprend la couronne");
  assert(s.players["p1"].isHost && !s.players["p2"].isHost, "drapeaux isHost cohérents");
  s = reduce(s, { type: "disconnect", playerId: "p2", now: 5 }).state;
  s = reduce(s, { type: "reconnect", playerId: "p2", now: 6 }).state;
  eq(s.hostId, "p1", "un invité qui revient ne vole pas la couronne");
});

test("la déconnexion de l'hôte transfère la couronne au suivant connecté", () => {
  let s = run(
    base(),
    { type: "join", playerId: "p1", name: "Alice", now: 1 },
    { type: "join", playerId: "p2", name: "Bob", now: 2 },
    { type: "join", playerId: "p3", name: "Cléo", now: 3 },
  );
  s = reduce(s, { type: "disconnect", playerId: "p1", now: 4 }).state;
  eq(s.hostId, "p2", "p2 devient hôte");
  assert(s.players["p2"].isHost, "flag hôte sur p2");
  assert(!s.players["p1"].isHost, "p1 n'est plus hôte");
});

test("quitter retire le joueur et transfère l'hôte si besoin", () => {
  let s = run(
    base(),
    { type: "join", playerId: "p1", name: "Alice", now: 1 },
    { type: "join", playerId: "p2", name: "Bob", now: 2 },
  );
  s = reduce(s, { type: "leave", playerId: "p1", now: 3 }).state;
  assert(!s.players["p1"], "p1 retiré");
  eq(s.playerOrder.length, 1, "un joueur restant");
  eq(s.hostId, "p2", "p2 hérite de l'hôte");
});

test("la déconnexion remet le joueur à 'pas prêt'", () => {
  let s = run(
    base(),
    { type: "join", playerId: "p1", name: "Alice", now: 1 },
    { type: "set_ready", playerId: "p1", ready: true, now: 2 },
  );
  s = reduce(s, { type: "disconnect", playerId: "p1", now: 3 }).state;
  assert(!s.players["p1"].isReady, "déconnexion => plus prêt");
});

test("le reducer ne mute jamais l'état d'entrée", () => {
  const s0 = reduce(base(), { type: "join", playerId: "p1", name: "Alice", now: 1 }).state;
  const snapshot = JSON.stringify(s0);
  reduce(s0, { type: "join", playerId: "p2", name: "Bob", now: 2 });
  reduce(s0, { type: "set_ready", playerId: "p1", ready: true, now: 3 });
  eq(JSON.stringify(s0), snapshot, "s0 doit être inchangé");
});

test("les couleurs d'avatar sont déterministes et stables", () => {
  const a = reduce(base(), { type: "join", playerId: "same-id", name: "A", now: 1 }).state;
  const b = reduce(base(), { type: "join", playerId: "same-id", name: "B", now: 1 }).state;
  eq(a.players["same-id"].color, b.players["same-id"].color, "même id => même couleur");
});

console.log("\nUtils\n");

test("les codes de room sont valides et sans caractères ambigus", () => {
  let seed = 42;
  const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 200; i++) {
    const code = generateRoomCode(rng);
    assert(isValidRoomCode(code), `code invalide: ${code}`);
    assert(!/[O0I1]/.test(code), `caractère ambigu dans ${code}`);
  }
});

test("sanitizeName borne la longueur à 20", () => {
  eq(sanitizeName("x".repeat(50)).length, 20, "longueur max");
});

test("Pass Soirée : 12 joueurs pendant la soirée, puis retour à 8", () => {
  let s = base();
  s = reduce(s, { type: "activate_pass", until: 10_000, offeredBy: "Rayan", now: 0 }).state;
  assert(passActive(s, 5_000), "pass actif");
  for (let i = 0; i < PASS_MAX_PLAYERS; i++) s = reduce(s, { type: "join", playerId: `p${i}`, name: `J${i}`, now: 100 + i }).state;
  eq(s.playerOrder.length, PASS_MAX_PLAYERS, "12 joueurs acceptés");
  eq(reduce(s, { type: "join", playerId: "x", name: "X", now: 200 }).error?.code, "room_full", "13e refusé");
  let t = base();
  t = reduce(t, { type: "activate_pass", until: 10_000, offeredBy: null, now: 0 }).state;
  for (let i = 0; i < DEFAULT_CONFIG.maxPlayers; i++) t = reduce(t, { type: "join", playerId: `q${i}`, name: `Q${i}`, now: 20_000 + i }).state;
  eq(reduce(t, { type: "join", playerId: "y", name: "Y", now: 20_100 }).error?.code, "room_full", "pass expiré → 8 max");
});

test("Pass Soirée : un 2e achat ne raccourcit jamais le pass", () => {
  let s = reduce(base(), { type: "activate_pass", until: 50_000, offeredBy: "A", now: 0 }).state;
  s = reduce(s, { type: "activate_pass", until: 20_000, offeredBy: "B", now: 1 }).state;
  eq(s.pass?.activeUntil, 50_000, "échéance gardée");
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
