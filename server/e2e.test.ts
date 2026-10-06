// End-to-end test of the real server driving an ANONYMISED game with real
// WebSocket clients. Clients vote by opaque token (they never receive authors
// during voting), exactly like the browser. Run: npx tsx server/e2e.test.ts
process.env.PORT = "3999";
process.env.STATS_FILE = ""; // pas d'écriture disque pendant les tests
process.env.STATS_TOKEN = "test-token";
process.env.PASS_DEV_FAKE = "1"; // paiement simulé pour tester le Pass Soirée
process.env.PASS_FILE = "";

import { WebSocket } from "ws";
import {
  SPEED_PRESETS,
  DEFAULT_GAME_SETTINGS,
  setCustomDoublageVideos,
  parseDoublageScenes,
  addCustomQuestions,
  parseCustomQuestions,
  GAME_REGISTRY,
  type AnyGameModule,
  type GamePlayer,
} from "@subtitles-party/shared";

// Les banques intégrées (quiz, doublage) sont volontairement vides : le contenu
// vient des dossiers de l'hôte. On charge donc des données de test ici.
setCustomDoublageVideos(
  parseDoublageScenes(
    [
      "scene1.mp4 | Scene 1 | 12 = Voix 1 | Voix 2",
      "restaurant.mp4 | Au restaurant | 45 = Le client | Le serveur | Le chef",
    ].join("\n"),
  ),
);
addCustomQuestions(
  parseCustomQuestions(
    [
      "Capitale de l'Italie ? = Rome",
      "Combien de pattes a une araignee ? = 8 | huit",
      "Astre au centre du systeme solaire ? = Soleil",
      "Quel animal aboie ? = chien",
      "Capitale du Japon ? = Tokyo",
      "Plus grand ocean ? = Pacifique",
      "Combien de continents ? = 7 | sept",
      "Couleur du ciel ? = bleu",
    ].join("\n"),
  ),
);
import type { PublicGameState, DrawPublic, ServerMessage } from "@subtitles-party/shared";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  \u001b[32m✓\u001b[0m ${name}`);
  } else {
    failed++;
    console.log(`  \u001b[31m✗ ${name}\u001b[0m ${detail}`);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Client {
  ws: WebSocket;
  states: (ServerMessage & { type: "state" })[] = [];
  errors: (ServerMessage & { type: "error" })[] = [];
  reactions: (ServerMessage & { type: "reaction" })[] = [];
  speaking: (ServerMessage & { type: "speaking" })[] = [];
  chats: (ServerMessage & { type: "chat" })[] = [];
  strokes: (ServerMessage & { type: "stroke" })[] = [];
  constructor(room: string, id: string, create = true) {
    // `create=1` mirrors the "Créer un salon" flow on the home page; without it
    // the server refuses unknown codes (no room-squatting via the URL).
    this.ws = new WebSocket(`ws://localhost:3999/?room=${room}&id=${id}${create ? "&create=1" : ""}`);
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString()) as ServerMessage;
      if (m.type === "state") this.states.push(m);
      else if (m.type === "reaction") this.reactions.push(m);
      else if (m.type === "speaking") this.speaking.push(m);
      else if (m.type === "chat") this.chats.push(m);
      else if (m.type === "stroke") this.strokes.push(m);
      else if (m.type === "error") this.errors.push(m);
    });
  }
  send(m: unknown) {
    this.ws.send(JSON.stringify(m));
  }
  open() {
    return new Promise<void>((res) => this.ws.on("open", () => res()));
  }
  last() {
    return this.states[this.states.length - 1];
  }
  game(): PublicGameState | null {
    return (this.last()?.game as PublicGameState | undefined) ?? null;
  }
  drawGame(): DrawPublic | null {
    return (this.last()?.game as DrawPublic | undefined) ?? null;
  }
  /** Token of the caption with the given text, as seen by THIS client. */
  tokenForText(text: string): string | undefined {
    return this.game()?.captions.find((c) => c.lines[0] === text)?.token;
  }
}

// Jeu de test minimal (2 « tours » au chrono, l'hôte peut passer) pour
// éprouver la Soirée sans dépendre des délais des vrais jeux.
function testModule(id: string): AnyGameModule {
  type S = { players: GamePlayer[]; step: number };
  return {
    id,
    meta: { name: id, minPlayers: 1, maxPlayers: 12 },
    defaultSettings: () => ({}),
    sanitizeSettings: () => ({}),
    createState: (players: GamePlayer[]): S => ({ players, step: 0 }),
    reduce: (s: S, a: { type: string }) => ({ state: a.type === "advance" ? { ...s, step: Math.min(2, s.step + 1) } : s }),
    project: (s: S) => s,
    deadline: () => null,
    isOver: (s: S) => s.step >= 2,
    results: (s: S) => (s.step >= 2 ? { scores: Object.fromEntries(s.players.map((p, i) => [p.id, 100 - i * 10])) } : null),
  };
}
GAME_REGISTRY.zap = testModule("zap");
GAME_REGISTRY.zap2 = testModule("zap2");

async function main() {
  await import("./index");
  await sleep(200);

  console.log("\nServeur — lobby & présence\n");
  const a = new Client("GAME", "alice");
  await a.open();
  a.send({ type: "join", name: "Alice" });
  await sleep(60);
  check("le 1er joueur devient hôte", a.last()?.state.players["alice"]?.isHost === true);

  const b = new Client("GAME", "bob");
  await b.open();
  b.send({ type: "join", name: "Bob" });
  const c = new Client("GAME", "cleo");
  await c.open();
  c.send({ type: "join", name: "Cléo" });
  await sleep(80);
  check("tout le monde voit 3 joueurs", (c.last()?.state.playerOrder.length ?? 0) === 3);

  // §12 avatars
  a.send({ type: "set_avatar", avatar: "data:image/png;base64,iVBORw0KGgoAAAA=" });
  await sleep(60);
  check("avatar diffusé aux autres joueurs", (c.last()?.state.players["alice"]?.avatar ?? "").startsWith("data:image/"));
  a.send({ type: "set_avatar", avatar: "data:image/png;base64," + "A".repeat(200000) });
  await sleep(60);
  check("avatar trop lourd rejeté", c.last()?.state.players["alice"]?.avatar == null);
  a.send({ type: "set_avatar", avatar: "data:image/png;base64,iVBORw0KGgoAAAA=" });
  await sleep(40);
  a.send({ type: "set_avatar", avatar: null });
  await sleep(60);
  check("avatar retiré → retour aux initiales", c.last()?.state.players["alice"]?.avatar == null);

  a.send({ type: "set_ready", ready: true });
  b.send({ type: "set_ready", ready: true });
  c.send({ type: "set_ready", ready: true });
  await sleep(80);

  console.log("\nServeur — réglages hôte\n");
  // A non-host attempt must be ignored.
  b.send({ type: "set_settings", settings: { totalRounds: 6, speed: "relaxed" } });
  await sleep(50);
  check("un non-hôte ne peut pas changer les réglages",
    a.last()?.settings.totalRounds === DEFAULT_GAME_SETTINGS.totalRounds);
  // The host sets speed + rounds; everyone sees it.
  a.send({ type: "set_settings", settings: { totalRounds: 3, speed: "fast" } });
  await sleep(50);
  check("l'hôte règle la vitesse (diffusée à tous)", c.last()?.settings.speed === "fast");

  a.send({ type: "start_game", gameId: "subtitles" });
  await sleep(80);
  check("les réglages sont appliqués au lancement",
    a.game()?.config.writingMs === SPEED_PRESETS.fast.writingMs && a.game()?.totalRounds === 3);

  console.log("\nServeur — jeu & anonymat\n");
  check("le jeu démarre en 'watching' avec un clip", a.game()?.phase === "watching" && !!a.game()?.clip);

  a.send({ type: "skip" });
  await sleep(60);
  check("le skip de l'hôte passe à l'écriture", a.game()?.phase === "writing");

  a.send({ type: "game", action: { kind: "submit", lines: ["R1 Alice", "R1 Alice"] } });
  b.send({ type: "game", action: { kind: "submit", lines: ["R1 Bob", "R1 Bob"] } });
  await sleep(60);
  check("l'écriture ne révèle pas les textes des autres", (a.game()?.captions.length ?? 99) === 0);
  check("mais on sait combien ont écrit", (a.game()?.submittedIds.length ?? 0) === 2);

  c.send({ type: "game", action: { kind: "submit", lines: ["R1 Cléo", "R1 Cléo"] } });
  await sleep(80);
  check("après la dernière soumission, la projection commence", a.game()?.phase === "screening");
  check("la projection commence à la 1re réplique", a.game()?.screenIndex === 0);
  check("la projection montre les répliques anonymes", (a.game()?.captions.length ?? 0) === 3);

  // Anonymity: even during screening, captions must carry NO author.
  const anon = JSON.stringify(a.game()?.captions ?? []);
  check("aucun identifiant d'auteur ne fuite dans les captions", !/alice|bob|cleo|authorId/.test(anon));
  check("chaque joueur connaît son propre jeton", typeof a.game()?.yourToken === "string");

  // Host skips through the three replays to open voting.
  a.send({ type: "skip" });
  await sleep(50);
  check("le skip fait défiler la projection", a.game()?.screenIndex === 1);
  a.send({ type: "skip" });
  await sleep(50);
  a.send({ type: "skip" });
  await sleep(60);
  check("après la dernière réplique, le vote s'ouvre", a.game()?.phase === "voting");

  // Vote by token. a & c vote Bob's caption; b votes Alice's caption.
  const bobTokenForA = a.tokenForText("R1 Bob")!;
  const aliceTokenForB = b.tokenForText("R1 Alice")!;
  const bobTokenForC = c.tokenForText("R1 Bob")!;

  // self-vote rejected: alice votes her own token.
  a.send({ type: "game", action: { kind: "vote", token: a.game()!.yourToken! } });
  await sleep(50);
  check("le vote pour soi est refusé", a.errors.some((e) => e.code === "self_vote"));

  a.send({ type: "game", action: { kind: "vote", token: bobTokenForA } });
  b.send({ type: "game", action: { kind: "vote", token: aliceTokenForB } });
  c.send({ type: "game", action: { kind: "vote", token: bobTokenForC } });
  await sleep(80);
  check("après les votes, on affiche les résultats", a.game()?.phase === "results");
  check("les auteurs sont révélés aux résultats", !!a.game()?.roundResults?.length);
  check("Bob marque 2 votes (200 pts)", a.game()?.scores["bob"] === 200);
  check("Alice marque 1 vote (100 pts)", a.game()?.scores["alice"] === 100);

  // play the two remaining rounds quickly to reach the scoreboard
  async function quickRound(targetText: string) {
    a.send({ type: "skip" }); // results -> next round watching
    await sleep(50);
    a.send({ type: "skip" }); // watching -> writing
    await sleep(50);
    a.send({ type: "game", action: { kind: "submit", lines: ["A", "A"] } });
    b.send({ type: "game", action: { kind: "submit", lines: ["B", "B"] } });
    c.send({ type: "game", action: { kind: "submit", lines: ["C", "C"] } });
    await sleep(80);
    // -> screening ; skip through the three replays to voting
    a.send({ type: "skip" });
    await sleep(40);
    a.send({ type: "skip" });
    await sleep(40);
    a.send({ type: "skip" });
    await sleep(60);
    // everyone votes the same caption (chosen by text), skipping self if needed
    for (const cl of [a, b, c]) {
      const tok = cl.tokenForText(targetText);
      const mine = cl.game()?.yourToken;
      const pick = tok && tok !== mine ? tok : cl.game()?.captions.find((x) => x.token !== mine)?.token;
      if (pick) cl.send({ type: "game", action: { kind: "vote", token: pick } });
    }
    await sleep(80);
  }
  await quickRound("C"); // round 2
  check("les scores cumulent entre les manches", (a.game()?.scores["cleo"] ?? 0) > 0);
  await quickRound("A"); // round 3
  a.send({ type: "skip" }); // results -> scoreboard
  await sleep(60);
  check("après la dernière manche : tableau des scores", a.game()?.phase === "scoreboard");

  a.send({ type: "play_again" });
  await sleep(90);
  check("« Rejouer » relance une partie immédiatement", a.game()?.phase === "watching" && a.game()?.round === 1);

  console.log("\nServeur — reconnexion\n");
  const x = new Client("REJO", "x");
  await x.open();
  x.send({ type: "join", name: "X" });
  const y = new Client("REJO", "y");
  await y.open();
  y.send({ type: "join", name: "Y" });
  await sleep(80);
  x.ws.close();
  await sleep(120);
  check("la déconnexion est vue par les autres", y.last()?.state.players["x"]?.isConnected === false);
  const x2 = new Client("REJO", "x");
  await x2.open();
  await sleep(100);
  check("reconnexion sans doublon", (x2.last()?.state.playerOrder.length ?? 0) === 2);

  console.log("\nServeur — déconnexion en cours de partie\n");
  const pa = new Client("PRES", "pa");
  await pa.open();
  pa.send({ type: "join", name: "PA" });
  const pb = new Client("PRES", "pb");
  await pb.open();
  pb.send({ type: "join", name: "PB" });
  const pc = new Client("PRES", "pc");
  await pc.open();
  pc.send({ type: "join", name: "PC" });
  await sleep(90);
  pa.send({ type: "set_ready", ready: true });
  pb.send({ type: "set_ready", ready: true });
  pc.send({ type: "set_ready", ready: true });
  await sleep(90);
  pa.send({ type: "start_game", gameId: "subtitles" });
  await sleep(90);
  pa.send({ type: "skip" }); // watching -> writing
  await sleep(70);
  check("partie en écriture", pa.game()?.phase === "writing");
  pa.send({ type: "game", action: { kind: "submit", lines: ["PA", "PA"] } });
  pb.send({ type: "game", action: { kind: "submit", lines: ["PB", "PB"] } });
  await sleep(70);
  check("on attend encore le 3e joueur", pa.game()?.phase === "writing");
  pc.ws.close(); // le 3e se déconnecte sans avoir écrit
  await sleep(180);
  check("la partie avance sans attendre le joueur parti", pa.game()?.phase !== "writing");

  pa.send({ type: "react", emoji: "😂" });
  await sleep(90);
  check("une réaction est diffusée aux autres", pb.reactions.some((r) => r.emoji === "😂"));
  pa.send({ type: "react", emoji: "🤬" }); // non autorisé
  await sleep(70);
  check("les emojis non autorisés sont ignorés", !pb.reactions.some((r) => r.emoji === "🤬"));

  console.log("\nServeur — succession d'hôte en cours de partie\n");
  const ha = new Client("HOST", "ha");
  await ha.open();
  ha.send({ type: "join", name: "HA" });
  const hb = new Client("HOST", "hb");
  await hb.open();
  hb.send({ type: "join", name: "HB" });
  await sleep(90);
  check("HA est l'hôte", ha.last()?.state.players["ha"]?.isHost === true);
  ha.send({ type: "set_ready", ready: true });
  hb.send({ type: "set_ready", ready: true });
  await sleep(90);
  ha.send({ type: "start_game", gameId: "subtitles" });
  await sleep(90);
  check("partie lancée", ha.last()?.state.phase === "in_game");
  ha.ws.close(); // l'hôte se déconnecte en pleine partie
  await sleep(160);
  check("le rôle d'hôte passe au joueur restant", hb.last()?.state.hostId === "hb");
  check("le nouvel hôte peut piloter la partie", hb.last()?.state.players["hb"]?.isHost === true);

  console.log("\nServeur — répliques de secours\n");
  const sa = new Client("SAFE", "sa");
  await sa.open();
  sa.send({ type: "join", name: "SA" });
  const sb = new Client("SAFE", "sb");
  await sb.open();
  sb.send({ type: "join", name: "SB" });
  const sc = new Client("SAFE", "sc");
  await sc.open();
  sc.send({ type: "join", name: "SC" });
  await sleep(90);
  sa.send({ type: "set_ready", ready: true });
  sb.send({ type: "set_ready", ready: true });
  sc.send({ type: "set_ready", ready: true });
  await sleep(90);
  sa.send({ type: "start_game", gameId: "subtitles" });
  await sleep(90);
  sa.send({ type: "skip" }); // watching -> writing
  await sleep(70);
  check("écriture", sa.game()?.phase === "writing");
  sa.send({ type: "game", action: { kind: "submit", lines: ["vraie", "vraie"] } });
  await sleep(70);
  sa.send({ type: "skip" }); // l'hôte passe -> remplit les manquantes -> projection
  await sleep(140);
  check("le skip remplit les répliques manquantes (3 captions)", (sa.game()?.captions.length ?? 0) === 3);
  check("on passe bien à la projection", sa.game()?.phase === "screening");

  console.log("\nServeur générique — Dessin & Devinette\n");
  const da = new Client("DRAW", "da");
  await da.open();
  da.send({ type: "join", name: "DA" });
  const db = new Client("DRAW", "db");
  await db.open();
  db.send({ type: "join", name: "DB" });
  const dc = new Client("DRAW", "dc");
  await dc.open();
  dc.send({ type: "join", name: "DC" });
  await sleep(90);
  da.send({ type: "set_ready", ready: true });
  db.send({ type: "set_ready", ready: true });
  dc.send({ type: "set_ready", ready: true });
  await sleep(90);
  da.send({ type: "start_game", gameId: "draw" });
  await sleep(120);
  check("l'hôte générique lance le jeu de dessin", da.last()?.gameId === "draw");
  check("phase de choix du mot", da.drawGame()?.phase === "choosing");

  const clients = [da, db, dc];
  const drawerId = da.drawGame()?.drawerId ?? null;
  const drawer = clients.find((c) => c.drawGame()?.youAreDrawer)!;
  check("le dessinateur voit ses choix de mots", (drawer.drawGame()?.wordChoices?.length ?? 0) === 5);
  // Le mot le plus long : une faute d'une lettre y reste « presque juste »
  // (sur un mot de 3 lettres, elle ne l'est pas — test instable sinon).
  const word = drawer.drawGame()!.wordChoices!.reduce((a, b) => (b.length > a.length ? b : a));
  drawer.send({ type: "game", action: { kind: "choose_word", word } });
  await sleep(90);
  check("après le choix : phase de dessin", da.drawGame()?.phase === "drawing");
  check(
    "le mot est caché aux devineurs",
    clients.some((c) => !c.drawGame()?.youAreDrawer && c.drawGame()?.word == null),
  );

  const guesser = clients.find((c) => c.last()?.you !== drawerId)!;
  guesser.send({ type: "game", action: { kind: "guess", text: "pas le bon mot" } });
  await sleep(60);
  check("mauvaise devinette → relayée en chat", guesser.chats.some((m) => m.kind === "guess"));
  // Proposition presque juste : jamais révélée aux autres joueurs.
  const near = word.slice(0, -1) + (word.endsWith("z") ? "a" : "z");
  const other = clients.find((c) => c !== guesser && c.last()?.you !== drawerId) ?? drawer;
  guesser.send({ type: "game", action: { kind: "guess", text: near } });
  await sleep(60);
  check("presque juste : l'auteur voit « tu chauffes »", guesser.chats.some((m) => m.text.includes("tu chauffes")));
  check("presque juste : le texte n'est pas montré aux autres", !other.chats.some((m) => m.text === near));
  guesser.send({ type: "game", action: { kind: "guess", text: word } });
  await sleep(80);
  check("bonne devinette annoncée en chat", da.chats.some((m) => m.kind === "correct"));
  check("le devineur a marqué des points", (da.drawGame()?.scores[guesser.last()!.you] ?? 0) > 0);

  drawer.send({ type: "draw_stroke", stroke: { points: [{ x: 0.1, y: 0.1 }], color: "#fff", width: 3 } });
  await sleep(60);
  check("les traits sont relayés aux autres", guesser.strokes.length > 0);

  guesser.send({ type: "chat", text: "salut la compagnie" });
  await sleep(60);
  check("la discussion est relayée (kind talk)", da.chats.some((m) => m.kind === "talk" && m.text.includes("salut")));

  // Rythme (V1.1) : la manche se termine dès que TOUS les devineurs *connectés*
  // ont trouvé, même si un joueur s'est déconnecté (il ne doit plus bloquer le
  // chrono). Salon dédié pour partir d'un état propre.
  console.log("\nServeur générique — Dessin : fin anticipée avec un joueur déconnecté\n");
  const dea = new Client("DREND", "dea");
  await dea.open();
  dea.send({ type: "join", name: "DEA" });
  const deb = new Client("DREND", "deb");
  await deb.open();
  deb.send({ type: "join", name: "DEB" });
  const dec = new Client("DREND", "dec");
  await dec.open();
  dec.send({ type: "join", name: "DEC" });
  await sleep(90);
  dea.send({ type: "set_ready", ready: true });
  deb.send({ type: "set_ready", ready: true });
  dec.send({ type: "set_ready", ready: true });
  await sleep(90);
  dea.send({ type: "start_game", gameId: "draw" });
  await sleep(120);
  const deClients = [dea, deb, dec];
  const deDrawer = deClients.find((c) => c.drawGame()?.youAreDrawer)!;
  const deWord = deDrawer.drawGame()!.wordChoices![0];
  deDrawer.send({ type: "game", action: { kind: "choose_word", word: deWord } });
  await sleep(90);
  // On observe l'état via le dessinateur : il reste toujours connecté (le
  // devineur déconnecté aurait un état gelé et fausserait l'assertion).
  check("fin anticipée : phase de dessin après le choix", deDrawer.drawGame()?.phase === "drawing");
  const deGuessers = deClients.filter((c) => !c.drawGame()?.youAreDrawer);
  // Un devineur se déconnecte en pleine manche (reste dans le roster en grâce).
  deGuessers[0].ws.close();
  await sleep(120);
  check("toujours en dessin tant que le devineur restant n'a pas trouvé", deDrawer.drawGame()?.phase === "drawing");
  // Le dernier devineur connecté trouve → la manche doit se révéler AUSSITÔT.
  deGuessers[1].send({ type: "game", action: { kind: "guess", text: deWord } });
  await sleep(100);
  check("fin anticipée dès que tous les connectés ont trouvé (pas d'attente du chrono)", deDrawer.drawGame()?.phase === "reveal");

  // Cycle de vie complet (V1.1) : 2 joueurs, retour salon, relance, reconnexion,
  // rejouer. Salon dédié.
  console.log("\nServeur générique — Dessin : 2 joueurs, retour salon, reconnexion, rejouer\n");
  const dfa = new Client("DFULL", "dfa");
  await dfa.open();
  dfa.send({ type: "join", name: "DFA" });
  const dfb = new Client("DFULL", "dfb");
  await dfb.open();
  dfb.send({ type: "join", name: "DFB" });
  await sleep(90);
  dfa.send({ type: "set_ready", ready: true });
  dfb.send({ type: "set_ready", ready: true });
  await sleep(90);
  dfa.send({ type: "start_game", gameId: "draw" });
  await sleep(120);
  check("2 joueurs : le jeu de dessin démarre", dfa.last()?.gameId === "draw" && dfa.last()?.state.phase === "in_game");
  check("2 joueurs : un dessinateur est désigné", !!dfa.drawGame()?.drawerId);
  // Retour au salon (hôte)
  dfa.send({ type: "return_lobby" });
  await sleep(100);
  check("retour au salon : phase lobby, plus de jeu", dfa.last()?.state.phase === "lobby" && dfa.last()?.gameId === null);
  // Relance depuis le salon
  dfa.send({ type: "set_ready", ready: true });
  dfb.send({ type: "set_ready", ready: true });
  await sleep(90);
  dfa.send({ type: "start_game", gameId: "draw" });
  await sleep(120);
  check("relance depuis le salon : de nouveau en jeu", dfa.last()?.state.phase === "in_game" && dfa.drawGame()?.phase === "choosing");
  // Reconnexion d'un joueur en pleine partie
  dfb.ws.close();
  await sleep(120);
  check("après déconnexion : le joueur est marqué hors ligne", dfa.last()?.state.players["dfb"]?.isConnected === false);
  const dfbR = new Client("DFULL", "dfb");
  await dfbR.open();
  await sleep(150);
  check("reconnexion : le joueur reçoit l'état du jeu en cours", dfbR.last()?.gameId === "draw");
  check("reconnexion : le joueur est de nouveau en ligne", dfa.last()?.state.players["dfb"]?.isConnected === true);
  // Rejouer (hôte) → nouvelle partie immédiate
  dfa.send({ type: "play_again" });
  await sleep(120);
  check("rejouer : une nouvelle partie démarre (manche 1)", dfa.drawGame()?.phase === "choosing" && dfa.drawGame()?.round === 1);

  console.log("\nServeur générique — Faux-artiste\n");
  const fa = new Client("FAKE", "fa");
  await fa.open();
  fa.send({ type: "join", name: "FA" });
  const fb = new Client("FAKE", "fb");
  await fb.open();
  fb.send({ type: "join", name: "FB" });
  const fc = new Client("FAKE", "fc");
  await fc.open();
  fc.send({ type: "join", name: "FC" });
  await sleep(90);
  fa.send({ type: "set_ready", ready: true });
  fb.send({ type: "set_ready", ready: true });
  fc.send({ type: "set_ready", ready: true });
  await sleep(90);
  fa.send({ type: "start_game", gameId: "fakeartist" });
  await sleep(120);
  check("l'hôte lance Faux-artiste", fa.last()?.gameId === "fakeartist");
  const faClients = [fa, fb, fc];
  type FAPub = { phase: string; youAreImpostor: boolean; word: string | null; impostorId: string | null; scores: Record<string, number> };
  const pub = (c: (typeof faClients)[number]) => c.last()?.game as unknown as FAPub;
  check("phase de dessin (tout le monde dessine)", pub(fa)?.phase === "drawing");
  let impostor = faClients.find((c) => pub(c)?.youAreImpostor);
  let reals = faClients.filter((c) => !pub(c)?.youAreImpostor);
  check("exactement un imposteur", !!impostor && reals.length === 2);
  check("l'imposteur ne voit pas le mot", pub(impostor!).word === null);
  check("les joueurs réels voient le mot", reals.every((c) => typeof pub(c).word === "string"));

  // Chacun dessine sur SA toile… sans voir celles des autres avant le vote.
  fb.send({ type: "draw_stroke", stroke: { points: [{ x: 0.3, y: 0.3 }], color: "#000", width: 4 } });
  fa.send({ type: "draw_stroke", stroke: { points: [{ x: 0.6, y: 0.6 }], color: "#f00", width: 4 } });
  await sleep(60);
  check("l'auteur reçoit son propre trait (étiqueté)", fb.strokes.some((s) => s.from === "fb") && fa.strokes.some((s) => s.from === "fa"));
  check("pendant le dessin, personne ne voit la toile des autres", !fa.strokes.some((s) => s.from === "fb") && !fc.strokes.some((s) => s.from === "fa" || s.from === "fb") && !fb.strokes.some((s) => s.from === "fa"));
  // Reconnexion pendant le dessin : on ne récupère que SA toile.
  fc.ws.close();
  await sleep(60);
  const fc2 = new Client("FAKE", "fc");
  await fc2.open();
  fc2.send({ type: "join", name: "FC" });
  await sleep(90);
  check("reconnexion pendant le dessin : aucune toile des autres", fc2.strokes.length === 0);
  faClients[2] = fc2;
  if (impostor === fc) impostor = fc2;
  reals = reals.map((c) => (c === fc ? fc2 : c));

  fa.send({ type: "skip" }); // -> voting (host)
  await sleep(120);
  check("passage à la phase de vote", pub(fa)?.phase === "voting");
  check("au vote, tout le monde voit toutes les toiles", [fa, fb, fc2].every((c) => c.strokes.some((s) => s.from === "fa") && c.strokes.some((s) => s.from === "fb")));
  const impId = faClients.find((c) => pub(c)?.youAreImpostor) ? impostor!.last()!.you : "";
  reals.forEach((c) => c.send({ type: "game", action: { kind: "vote", targetId: impId } }));
  impostor!.send({ type: "game", action: { kind: "vote", targetId: reals[0].last()!.you } });
  await sleep(90);
  check("révélation après votes", pub(fa)?.phase === "reveal");
  check("l'imposteur est révélé", pub(fa)?.impostorId === impId);
  check("les accusateurs ont marqué", reals.every((c) => (pub(fa).scores[c.last()!.you] ?? 0) === 100));

  console.log("\nServeur générique — Relais\n");
  const rInfo: [string, string][] = [["ra", "RA"], ["rb", "RB"], ["rc", "RC"], ["rd", "RD"]];
  const rClients = rInfo.map(([id]) => new Client("RELAY", id));
  for (let i = 0; i < rClients.length; i++) {
    await rClients[i].open();
    rClients[i].send({ type: "join", name: rInfo[i][1] });
  }
  await sleep(110);
  rClients.forEach((c) => c.send({ type: "set_ready", ready: true }));
  await sleep(90);
  rClients[0].send({ type: "start_game", gameId: "relay" });
  await sleep(130);
  type RPub = {
    phase: string;
    drawerIds: string[];
    youAreDrawer: boolean;
    youAreActive: boolean;
    word: string | null;
    scores: Record<string, number>;
  };
  const rp = (c: Client) => c.last()?.game as unknown as RPub;
  check("l'hôte lance Relais", rClients[0].last()?.gameId === "relay");
  check("deux dessinateurs en relais", rp(rClients[0])?.drawerIds.length === 2);
  const drawers = rClients.filter((c) => rp(c).youAreDrawer);
  const guessersR = rClients.filter((c) => !rp(c).youAreDrawer);
  check("les dessinateurs voient le mot", drawers.every((c) => typeof rp(c).word === "string"));
  check("les devineurs ne voient pas le mot", guessersR.every((c) => rp(c).word === null));
  const rWord = rp(drawers[0]).word!;
  const active = drawers.find((c) => rp(c).youAreActive)!;
  const idle = drawers.find((c) => !rp(c).youAreActive)!;

  const before = guessersR[0].strokes.length;
  active.send({ type: "draw_stroke", stroke: { points: [{ x: 0.2, y: 0.2 }], color: "#000", width: 4 } });
  await sleep(60);
  check("le dessinateur actif peut dessiner", guessersR[0].strokes.length > before);
  const mid = guessersR[0].strokes.length;
  idle.send({ type: "draw_stroke", stroke: { points: [{ x: 0.5, y: 0.5 }], color: "#000", width: 4 } });
  await sleep(60);
  check("le dessinateur inactif ne peut pas dessiner", guessersR[0].strokes.length === mid);

  guessersR[0].send({ type: "game", action: { kind: "guess", text: rWord } });
  await sleep(80);
  check("un devineur trouve → chat + score", rClients[0].chats.some((m) => m.kind === "correct") && (rp(rClients[0]).scores[guessersR[0].last()!.you] ?? 0) > 0);

  console.log("\nServeur générique — Doublage\n");
  const da2 = new Client("DUB", "da");
  await da2.open();
  da2.send({ type: "join", name: "DA" });
  const db2 = new Client("DUB", "db");
  await db2.open();
  db2.send({ type: "join", name: "DB" });
  await sleep(90);
  da2.send({ type: "set_ready", ready: true });
  db2.send({ type: "set_ready", ready: true });
  await sleep(80);
  da2.send({ type: "start_game", gameId: "doublage" });
  await sleep(120);
  type DubPub = { phase: string; videoId: string | null; characters: unknown[]; playback: { playing: boolean; positionMs: number }; allReady: boolean };
  const dp = (c: Client) => c.last()?.game as unknown as DubPub;
  check("l'hôte lance Doublage (phase prépa)", da2.last()?.gameId === "doublage" && dp(da2)?.phase === "prep");
  check("une vidéo + des personnages par défaut", !!dp(da2).videoId && dp(da2).characters.length >= 2);
  da2.send({ type: "game", action: { kind: "pick_video", videoId: "cs2" } });
  await sleep(60);
  check("choix de la scène (3 personnages)", dp(da2).characters.length === 3);
  da2.send({ type: "game", action: { kind: "ready", ready: true } });
  db2.send({ type: "game", action: { kind: "ready", ready: true } });
  await sleep(60);
  check("tout le monde est prêt", dp(da2).allReady === true);
  da2.send({ type: "game", action: { kind: "start" } });
  await sleep(80);
  check("scène lancée + lecture synchronisée", dp(da2)?.phase === "dubbing" && dp(db2).playback.playing === true);
  da2.send({ type: "game", action: { kind: "control", op: "pause" } });
  await sleep(60);
  check("pause propagée à tous", dp(db2).playback.playing === false);
  da2.send({ type: "game", action: { kind: "to_result" } });
  await sleep(60);
  check("passage au résultat", dp(da2)?.phase === "result");

  // signal "qui parle" (éphémère, relayé)
  db2.speaking = [];
  da2.send({ type: "speaking", speaking: true });
  await sleep(50);
  check("le signal 'parle' est relayé aux autres", db2.speaking.some((s) => s.from === "da" && s.speaking === true));
  da2.send({ type: "speaking", speaking: false });
  await sleep(50);
  check("le signal 'se tait' est relayé", db2.speaking.some((s) => s.from === "da" && s.speaking === false));

  // ---- Quiz : question synchronisée → réponses → révélation → score → final ----
  console.log("\nServeur générique — Quiz\n");
  const qa = new Client("QUIZ", "qa");
  const qb = new Client("QUIZ", "qb");
  await Promise.all([qa.open(), qb.open()]);
  qa.send({ type: "join", name: "Q-Alice" });
  qb.send({ type: "join", name: "Q-Bob" });
  await sleep(60);
  qa.send({ type: "set_ready", ready: true });
  qb.send({ type: "set_ready", ready: true });
  await sleep(60);
  qa.send({ type: "start_game", gameId: "quiz", settings: { totalQuestions: 3, secondsPerQuestion: 20 } });
  await sleep(80);
  const qp = () => qa.last()?.game as import("@subtitles-party/shared").QuizPublic | undefined;
  check("l'hôte lance le Quiz", qa.last()?.gameId === "quiz");
  check("les deux voient la même question au même moment", qp()?.question?.id === (qb.last()?.game as any)?.question?.id && !!qp()?.question);
  check("la bonne réponse n'est pas exposée pendant la question", (qp() as any)?.question?.answer === undefined);
  const qStart = qp();
  // qa répond, qb pas encore
  qa.send({ type: "game", action: { kind: "answer", value: 0 } });
  await sleep(60);
  check("qb voit que qa a répondu (sans voir quoi)", (qb.last()?.game as any)?.answeredIds?.includes("qa") === true);
  check("qb ne voit pas sa propre réponse", (qb.last()?.game as any)?.yourAnswer == null);
  // qb répond → tous ont répondu → révélation anticipée
  qb.send({ type: "game", action: { kind: "answer", value: 0 } });
  await sleep(80);
  check("révélation dès que tous ont répondu", qp()?.phase === "reveal");
  check("le classement est présent à la révélation", (qp()?.ranking?.length ?? 0) === 2);
  void qStart;
  // laisser la partie s'enchaîner jusqu'au final (reveal ~4.5s ×3)
  const t0 = Date.now();
  while ((qp()?.phase !== "final") && Date.now() - t0 < 30000) {
    // répondre à chaque nouvelle question pour accélérer via révélation anticipée
    const g = qp();
    if (g?.phase === "question" && !g.answeredIds.includes("qa")) qa.send({ type: "game", action: { kind: "answer", value: 0 } });
    if (g?.phase === "question" && !g.answeredIds.includes("qb")) qb.send({ type: "game", action: { kind: "answer", value: 1 } });
    await sleep(300);
  }
  check("la partie atteint l'écran final", qp()?.phase === "final");
  check("des statistiques de fin sont fournies", (qp() as any)?.stats !== null);

  // ---- Reconnaissance : image+question sync → réponse libre → score → final ----
  console.log("\nServeur générique — Reconnaissance\n");
  const ra = new Client("RECO", "ra");
  const rb = new Client("RECO", "rb");
  await Promise.all([ra.open(), rb.open()]);
  ra.send({ type: "join", name: "R-Alice" });
  rb.send({ type: "join", name: "R-Bob" });
  await sleep(60);
  ra.send({ type: "set_ready", ready: true });
  rb.send({ type: "set_ready", ready: true });
  await sleep(60);
  ra.send({ type: "start_game", gameId: "reco", settings: { totalQuestions: 3, secondsPerQuestion: 20 } });
  await sleep(80);
  const rcp = () => ra.last()?.game as import("@subtitles-party/shared").RecoPublic | undefined;
  check("l'hôte lance Reconnaissance", ra.last()?.gameId === "reco");
  check("image + question diffusées", !!rcp()?.item?.img && !!rcp()?.item?.question);
  check("la réponse n'est pas exposée en question", (rcp()?.item as any)?.answer === undefined);
  ra.send({ type: "game", action: { kind: "answer", value: "x" } });
  await sleep(50);
  check("rb voit que ra a répondu (sans la réponse)", (rb.last()?.game as any)?.answeredIds?.includes("ra") === true && (rb.last()?.game as any)?.yourAnswer == null);
  rb.send({ type: "game", action: { kind: "answer", value: "y" } });
  await sleep(80);
  check("révélation dès que tous ont répondu", rcp()?.phase === "reveal");
  check("la bonne réponse est révélée", typeof rcp()?.correctText === "string");

  console.log("\nServeur — Pass Soirée (paiement simulé)\n");
  const pv = new Client("PASS", "pv");
  await pv.open();
  pv.send({ type: "join", name: "Rayan" });
  await sleep(60);
  const own = "Chat de Léa ? = Moustache\nVille du séminaire ? = Lille\nCouleur du logo ? = Orange";
  const ownPrompts = ["Chat de Léa ?", "Ville du séminaire ?", "Couleur du logo ?"];
  const prompt = () => ((pv.last()?.game as any)?.question?.prompt as string | undefined) ?? "";
  pv.send({ type: "start_game", gameId: "quiz", settings: { totalQuestions: 3, secondsPerQuestion: 20, roomQuestions: own } });
  await sleep(100);
  check("sans pass : les questions perso sont ignorées", !!prompt() && !ownPrompts.includes(prompt()));
  pv.send({ type: "return_lobby" });
  await sleep(60);
  const cfg = await (await fetch("http://localhost:3999/pass/config")).json() as { enabled: boolean };
  check("le pass est proposé quand le paiement est configuré", cfg.enabled === true);
  const bad = await fetch("http://localhost:3999/pass/checkout", { method: "POST", body: JSON.stringify({ room: "PASS", origin: "https://evil.example" }) });
  check("paiement refusé vers un site tiers", bad.status === 400);
  const co = await (await fetch("http://localhost:3999/pass/checkout", { method: "POST", body: JSON.stringify({ room: "PASS", origin: "http://localhost:3000" }) })).json() as { url: string };
  const sessionId = new URL(co.url).searchParams.get("pass") ?? "";
  check("le paiement renvoie vers le salon", co.url.startsWith("http://localhost:3000/room/PASS?pass="));
  pv.send({ type: "redeem_pass", sessionId: "fake_QUIZ_abc123" }); // salon QUIZ toujours ouvert
  await sleep(60);
  check("un faux pass pour un autre salon ne fait rien", !pv.last()?.state.pass);
  pv.send({ type: "redeem_pass", sessionId });
  await sleep(80);
  check("pass activé pour tout le salon (12 h)", (pv.last()?.state.pass?.activeUntil ?? 0) > Date.now() + 11 * 3600_000);
  check("« offert par » l'acheteur", pv.last()?.state.pass?.offeredBy === "Rayan");
  pv.send({ type: "start_game", gameId: "quiz", settings: { totalQuestions: 3, secondsPerQuestion: 20, roomQuestions: own } });
  await sleep(100);
  check("avec pass : les questions de l'hôte sont jouées", ownPrompts.includes(prompt()));
  pv.send({ type: "return_lobby" });
  await sleep(40);

  console.log("\nServeur — Soirée LeBoum (plusieurs jeux + score global)\n");
  {
    const h = new Client("SOIR", "sh");
    await h.open();
    h.send({ type: "join", name: "Hôte" });
    const g = new Client("SOIR", "sg", false);
    await g.open();
    g.send({ type: "join", name: "Invité" });
    await sleep(60);
    g.send({ type: "set_ready", ready: true });
    await sleep(40);
    const skipToEnd = async () => {
      for (let i = 0; i < 40 && !h.last()?.gameOver; i++) {
        h.send({ type: "skip" });
        await sleep(25);
      }
    };
    g.send({ type: "soiree_start", items: [{ gameId: "quiz" }] });
    await sleep(60);
    check("seul l'hôte lance une soirée", h.last()?.state.phase === "lobby" && !h.last()?.soiree);
    h.send({ type: "soiree_start", items: [] });
    await sleep(40);
    check("soirée vide refusée", h.errors.some((e) => e.code === "soiree_empty"));
    h.send({
      type: "soiree_start",
      items: [
        { gameId: "zap", settings: { secret: "x" } },
        { gameId: "fakeartist" },
        { gameId: "nope" },
        { gameId: "zap2" },
      ],
    });
    await sleep(80);
    const s0 = h.last();
    check("la soirée démarre sur le 1er jeu", s0?.state.phase === "in_game" && s0?.gameId === "zap" && s0?.soiree?.current === 0);
    check("un jeu inconnu est retiré du programme", s0?.soiree?.items.length === 3);
    check("les réglages de lancement ne sont pas diffusés", s0?.soiree?.items.every((i) => i.settings === undefined) === true);
    check("l'invité voit la soirée", g.last()?.soiree?.items.length === 3);
    await skipToEnd();
    const s1 = h.last();
    check("fin du jeu 1 signalée (gameOver)", s1?.gameOver === true);
    check("le résultat du jeu 1 est compté", s1?.soiree?.records.length === 1 && s1?.soiree?.records[0].gameId === "zap");
    const tot1 = Object.values(s1?.soiree?.totals ?? {}).reduce((a, b) => a + b, 0);
    check("points de soirée attribués (10 + 7)", tot1 === 17 && s1?.soiree?.totals.sh === 10, JSON.stringify(s1?.soiree?.totals));
    const run1 = s1?.gameRun ?? 0;
    h.send({ type: "soiree_next" });
    await sleep(80);
    const s2 = h.last();
    check("jeu suivant enchaîné sans repasser par le salon", s2?.state.phase === "in_game" && s2?.gameId === "zap2");
    check("un jeu injouable à 2 (Faux-artiste) est sauté", s2?.soiree?.current === 2 && h.chats.some((c) => c.text.includes("Faux-artiste")));
    check("nouvelle partie = nouveau numéro", (s2?.gameRun ?? 0) > run1);
    await skipToEnd();
    check("résultat du jeu 2 compté", h.last()?.soiree?.records.length === 2);
    const totBefore = JSON.stringify(h.last()?.soiree?.totals);
    h.send({ type: "play_again" });
    await sleep(60);
    await skipToEnd();
    const s3 = h.last();
    check("une revanche ne compte pas en double", s3?.soiree?.records.length === 2, totBefore + " → " + JSON.stringify(s3?.soiree?.totals));
    const tot3 = Object.values(s3?.soiree?.totals ?? {}).reduce((a, b) => a + b, 0);
    check("total cohérent après revanche (2 jeux × 17)", tot3 === 34, String(tot3));
    h.send({ type: "soiree_next" });
    await sleep(80);
    const s4 = h.last();
    check("après le dernier jeu : retour au salon", s4?.state.phase === "lobby");
    check("la soirée est terminée et garde le classement", s4?.soiree?.finished === true && s4?.soiree?.records.length === 2);
    // Phase 15 : fin de soirée — les joueurs réclament la revanche.
    g.send({ type: "soiree_vote_rematch", want: true });
    await sleep(50);
    check("fin de soirée : un invité réclame la revanche, tout le monde le voit", JSON.stringify(h.last()?.soiree?.rematchVotes) === JSON.stringify(["sg"]));
    g.send({ type: "soiree_vote_rematch", want: false });
    await sleep(50);
    check("il peut retirer sa demande", h.last()?.soiree?.rematchVotes?.length === 0);
    g.send({ type: "soiree_vote_rematch", want: true });
    h.send({ type: "soiree_vote_rematch", want: true });
    await sleep(50);
    check("demandes cumulées (2 joueurs)", h.last()?.soiree?.rematchVotes?.length === 2);
    h.send({ type: "soiree_rematch" });
    await sleep(80);
    const s5 = h.last();
    check("la revanche remet les demandes à zéro", !s5?.soiree?.rematchVotes?.length);
    check("revanche de soirée : même programme, scores à zéro", s5?.state.phase === "in_game" && s5?.gameId === "zap" && s5?.soiree?.records.length === 0);
    h.send({ type: "return_lobby" });
    await sleep(40);
    check("retour au salon en pleine soirée : la soirée continue", h.last()?.state.phase === "lobby" && h.last()?.soiree?.finished === false);
    h.send({ type: "soiree_next" });
    await sleep(80);
    check("reprise : le jeu abandonné est rejoué", h.last()?.state.phase === "in_game" && h.last()?.gameId === "zap");
    h.send({ type: "soiree_end" });
    await sleep(40);
    check("terminer la soirée ramène au salon", h.last()?.state.phase === "lobby" && h.last()?.soiree === null);
    h.ws.close();
    g.ws.close();
  }

  console.log("\nServeur générique — Qui de nous ?\n");
  {
    const ids = ["wa", "wb", "wc"];
    const cl: Client[] = [];
    for (const [i, id] of ids.entries()) {
      const c = new Client("WHOI", id, i === 0);
      await c.open();
      c.send({ type: "join", name: id.toUpperCase() });
      await sleep(30);
      cl.push(c);
    }
    cl[1].send({ type: "set_ready", ready: true });
    cl[2].send({ type: "set_ready", ready: true });
    await sleep(50);
    cl[0].send({ type: "start_game", gameId: "whois", settings: { totalRounds: 3, seconds: 30 } });
    await sleep(80);
    type W = { phase: string; question: { text: string } | null; votedIds: string[]; votes: Record<string, string> | null; elected: string[]; scores: Record<string, number> };
    const w = (c: Client) => c.last()?.game as unknown as W;
    check("Qui de nous ? démarre sur une question", cl[0].last()?.gameId === "whois" && w(cl[0])?.phase === "question" && !!w(cl[0])?.question?.text);
    cl[0].send({ type: "game", action: { kind: "vote", targetId: "wa" } });
    await sleep(40);
    check("vote pour soi refusé", cl[0].errors.some((e) => e.code === "self_vote"));
    cl[0].send({ type: "game", action: { kind: "vote", targetId: "wb" } });
    await sleep(40);
    check("les autres voient qui a voté, pas pour qui", w(cl[1]).votedIds.includes("wa") && w(cl[1]).votes === null);
    cl[1].send({ type: "game", action: { kind: "vote", targetId: "wc" } });
    cl[2].send({ type: "game", action: { kind: "vote", targetId: "wb" } });
    await sleep(60);
    check("révélation dès que tout le monde a voté", w(cl[2]).phase === "reveal" && w(cl[2]).elected.join() === "wb");
    check("points : majorité +100, élu +50", w(cl[2]).scores.wa === 100 && w(cl[2]).scores.wc === 100 && w(cl[2]).scores.wb === 50, JSON.stringify(w(cl[2]).scores));
    for (const c of cl) c.ws.close();
  }

  console.log("\nServeur générique — La Plus Drôle\n");
  {
    const ids = ["fa", "fb", "fc"];
    const cl: Client[] = [];
    for (const [i, id] of ids.entries()) {
      const c = new Client("FUNY", id, i === 0);
      await c.open();
      c.send({ type: "join", name: id.toUpperCase() });
      await sleep(30);
      cl.push(c);
    }
    cl[1].send({ type: "set_ready", ready: true });
    cl[2].send({ type: "set_ready", ready: true });
    await sleep(50);
    cl[0].send({ type: "start_game", gameId: "funny", settings: { totalRounds: 2, seconds: 60 } });
    await sleep(80);
    type F = { phase: string; prompt: string; answers: { token: string; text: string }[] | null; yourToken: string | null; results: { authorId: string; votes: number }[] | null; scores: Record<string, number> };
    const f = (c: Client) => c.last()?.game as unknown as F;
    check("La Plus Drôle démarre en écriture", cl[0].last()?.gameId === "funny" && f(cl[0])?.phase === "write" && f(cl[0]).prompt.includes("___"));
    cl[0].send({ type: "game", action: { kind: "answer", text: "réponse A" } });
    cl[1].send({ type: "game", action: { kind: "answer", text: "réponse B" } });
    await sleep(40);
    check("les réponses restent secrètes pendant l'écriture", f(cl[2]).answers === null);
    cl[2].send({ type: "game", action: { kind: "answer", text: "réponse C" } });
    await sleep(60);
    const pub = f(cl[2]);
    check("révélation anonyme (aucun auteur diffusé)", pub.phase === "reveal" && pub.answers?.length === 3 && !JSON.stringify(cl[2].last()?.game).includes("authorId"));
    cl[0].send({ type: "skip" });
    await sleep(40);
    const tokB = f(cl[1]).yourToken!;
    cl[0].send({ type: "game", action: { kind: "vote", token: f(cl[0]).yourToken } });
    await sleep(40);
    check("vote pour sa propre réponse refusé", cl[0].errors.some((e) => e.code === "self_vote"));
    cl[0].send({ type: "game", action: { kind: "vote", token: tokB } });
    cl[2].send({ type: "game", action: { kind: "vote", token: tokB } });
    cl[1].send({ type: "game", action: { kind: "vote", token: f(cl[1]).answers!.find((a) => a.token !== tokB)!.token } });
    await sleep(60);
    check("résultats : auteurs dévoilés, B gagne", f(cl[0]).phase === "results" && f(cl[0]).results?.[0].authorId === "fb" && f(cl[0]).results?.[0].votes === 2);
    check("points : 2 votes + bonus = 250", f(cl[0]).scores.fb === 250, JSON.stringify(f(cl[0]).scores));
    for (const c of cl) c.ws.close();
  }

  console.log("\nServeur générique — Imposteur\n");
  {
    const ids = ["ia", "ib", "ic", "id"];
    const cl: Client[] = [];
    for (const [i, id] of ids.entries()) {
      const c = new Client("IMPO", id, i === 0);
      await c.open();
      c.send({ type: "join", name: id.toUpperCase() });
      await sleep(30);
      cl.push(c);
    }
    for (const c of cl.slice(1)) c.send({ type: "set_ready", ready: true });
    await sleep(50);
    cl[0].send({ type: "start_game", gameId: "imposter", settings: { totalRounds: 1, seconds: 30, mode: "classique" } });
    await sleep(80);
    type I = { phase: string; yourWord: string | null; youAreImposter: boolean; currentId: string | null; order: string[]; clues: { playerId: string; text: string }[]; votedIds: string[]; accused: string[]; reveal: { imposterId: string; word: string; outcome: string } | null; scores: Record<string, number> };
    const g = (c: Client) => c.last()?.game as unknown as I;
    const byId = (id: string) => cl[ids.indexOf(id)];
    check("Imposteur démarre en phase secrète", cl[0].last()?.gameId === "imposter" && g(cl[0])?.phase === "secret");
    const imps = cl.filter((c) => g(c).youAreImposter);
    check("un seul imposteur, sans mot ; les autres partagent le même mot", imps.length === 1 && g(imps[0]).yourWord === null && new Set(cl.filter((c) => c !== imps[0]).map((c) => g(c).yourWord)).size === 1);
    const impId = ids[cl.indexOf(imps[0])];
    const citizen = cl.find((c) => c !== imps[0])!;
    check("aucun client ne reçoit l'identité de l'imposteur", !JSON.stringify(citizen.last()?.game).includes(`"imposterId"`));
    for (const c of cl) c.send({ type: "game", action: { kind: "seen" } });
    await sleep(60);
    check("tout le monde a vu sa carte → indices", g(cl[0]).phase === "clues" && !!g(cl[0]).currentId);
    for (let n = 0; n < 8 && g(cl[0]).phase === "clues"; n++) {
      byId(g(cl[0]).currentId!).send({ type: "game", action: { kind: "clue", text: `indice ${n}` } });
      await sleep(40);
    }
    check("2 tours d'indices puis vote", g(cl[0]).phase === "vote" && g(cl[0]).clues.length === 8);
    for (const [i, c] of cl.entries()) {
      const target = ids[i] === impId ? ids.find((x) => x !== impId)! : impId;
      c.send({ type: "game", action: { kind: "vote", targetId: target } });
    }
    await sleep(60);
    check("imposteur démasqué → dernière chance", g(cl[0]).phase === "guess" && g(cl[0]).accused.join() === impId);
    imps[0].send({ type: "game", action: { kind: "guess", text: "zzz" } });
    await sleep(60);
    const rv = g(cl[0]).reveal;
    check("révélation : imposteur, mot et issue", g(cl[0]).phase === "reveal" && rv?.imposterId === impId && rv?.outcome === "caught" && !!rv?.word);
    check("points : +100 par bon vote, 0 pour l'imposteur", ids.every((id) => (g(cl[0]).scores[id] ?? 0) === (id === impId ? 0 : 100)), JSON.stringify(g(cl[0]).scores));
    for (const c of cl) c.ws.close();
  }

  console.log("\nServeur générique — Téléphone cassé\n");
  {
    const ids = ["pa", "pb", "pc"];
    const cl: Client[] = [];
    for (const [i, id] of ids.entries()) {
      const c = new Client("TELE", id, i === 0);
      await c.open();
      c.send({ type: "join", name: id.toUpperCase() });
      await sleep(30);
      cl.push(c);
    }
    for (const c of cl.slice(1)) c.send({ type: "set_ready", ready: true });
    await sleep(50);
    cl[0].send({ type: "start_game", gameId: "phone", settings: { seconds: 60 } });
    await sleep(80);
    type T = { phase: string; step: number; steps: number; task: { kind: string; prev: { content: string } | null } | null; submittedIds: string[]; reveal: { chain: { entries: { content: string; kind: string }[] } } | null; scores: Record<string, number> };
    const g = (c: Client) => c.last()?.game as unknown as T;
    check("Téléphone cassé démarre : écrire une phrase", cl[0].last()?.gameId === "phone" && g(cl[0])?.task?.kind === "text" && g(cl[0]).steps === 3);
    for (const [i, c] of cl.entries()) c.send({ type: "game", action: { kind: "submit", content: `phrase de ${ids[i]}` } });
    await sleep(80);
    const prev = g(cl[1]).task?.prev?.content ?? "";
    check("étape 2 : dessiner la phrase d'un autre", g(cl[1]).step === 1 && g(cl[1]).task?.kind === "drawing" && prev.startsWith("phrase de") && prev !== "phrase de pb");
    const IMG = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
    for (const c of cl) c.send({ type: "game", action: { kind: "submit", content: IMG } });
    await sleep(80);
    check("étape 3 : décrire un dessin reçu", g(cl[2]).step === 2 && g(cl[2]).task?.prev?.content === IMG);
    for (const c of cl) c.send({ type: "game", action: { kind: "submit", content: "une description" } });
    await sleep(80);
    check("révélation de la 1re chaîne, une étape à la fois", g(cl[0]).phase === "reveal" && g(cl[0]).reveal?.chain.entries.length === 1);
    for (let i = 0; i < 9; i++) { cl[0].send({ type: "skip" }); await sleep(30); }
    await sleep(60);
    check("fin : l'album complet est diffusé", g(cl[0]).phase === "final" && (cl[0].last()?.game as { album?: unknown[] }).album?.length === 3);
    for (const c of cl) c.ws.close();
  }

  console.log("\nServeur générique — Mot interdit\n");
  {
    const ids = ["ta", "tb", "tc"];
    const cl: Client[] = [];
    for (const [i, id] of ids.entries()) {
      const c = new Client("TABU", id, i === 0);
      await c.open();
      c.send({ type: "join", name: id.toUpperCase() });
      await sleep(30);
      cl.push(c);
    }
    for (const c of cl.slice(1)) c.send({ type: "set_ready", ready: true });
    await sleep(50);
    cl[0].send({ type: "start_game", gameId: "taboo", settings: { seconds: 60, mode: "ecrit" } });
    await sleep(80);
    type M = { phase: string; giverId: string; card: { word: string; forbidden: string[] } | null; log: { kind: string; text: string }[]; scores: Record<string, number>; playedCount: number };
    const g = (c: Client) => c.last()?.game as unknown as M;
    check("Mot interdit démarre : un donneur désigné", cl[0].last()?.gameId === "taboo" && g(cl[0])?.phase === "ready" && ids.includes(g(cl[0]).giverId));
    const giver = cl[ids.indexOf(g(cl[0]).giverId)];
    const others = cl.filter((c) => c !== giver);
    giver.send({ type: "game", action: { kind: "start" } });
    await sleep(60);
    const card = g(giver).card!;
    check("seul le donneur voit la carte", !!card && others.every((c) => g(c).card === null) && !JSON.stringify(others[0].last()?.game).includes(card.word));
    giver.send({ type: "game", action: { kind: "clue", text: `pense à ${card.forbidden[1]}` } });
    await sleep(60);
    check("indice interdit refusé et jamais diffusé", giver.errors.some((e) => e.code === "forbidden_word") && !JSON.stringify(others[0].last()?.game).includes(`pense à ${card.forbidden[1]}`));
    const card2 = g(giver).card!;
    giver.send({ type: "game", action: { kind: "clue", text: "zzz premier indice" } });
    await sleep(40);
    check("indice propre diffusé aux devineurs", g(others[0]).log.some((m) => m.kind === "clue" && m.text === "zzz premier indice"));
    others[0].send({ type: "game", action: { kind: "guess", text: card2.word } });
    await sleep(60);
    const finderId = ids[cl.indexOf(others[0])];
    check("bonne réponse validée par le serveur : +100 / +100", g(cl[0]).scores[finderId] === 100 && g(cl[0]).scores[g(cl[0]).giverId] === 50, JSON.stringify(g(cl[0]).scores));
    for (const c of cl) c.ws.close();
  }

  console.log("\nServeur générique — Ni oui ni non\n");
  {
    const ids = ["ya", "yb", "yc"];
    const cl: Client[] = [];
    for (const [i, id] of ids.entries()) {
      const c = new Client("NOUI", id, i === 0);
      await c.open();
      c.send({ type: "join", name: id.toUpperCase() });
      await sleep(30);
      cl.push(c);
    }
    for (const c of cl.slice(1)) c.send({ type: "set_ready", ready: true });
    await sleep(50);
    cl[0].send({ type: "start_game", gameId: "yesno", settings: { seconds: 45, mode: "chat" } });
    await sleep(80);
    type Y = { phase: string; targetId: string; log: { text: string }[]; result: { outcome: string; catcherId: string | null; word: string | null } | null; scores: Record<string, number> };
    const g = (c: Client) => c.last()?.game as unknown as Y;
    check("Ni oui ni non démarre : une cible désignée", cl[0].last()?.gameId === "yesno" && g(cl[0])?.phase === "ready" && ids.includes(g(cl[0]).targetId));
    cl[0].send({ type: "skip" });
    await sleep(60);
    const targetId = g(cl[0]).targetId;
    const target = cl[ids.indexOf(targetId)];
    const asker = cl.find((c) => c !== target)!;
    check("le chrono démarre", g(cl[0]).phase === "hot");
    asker.send({ type: "game", action: { kind: "say", text: "Tu as faim ?" } });
    await sleep(40);
    target.send({ type: "game", action: { kind: "say", text: "Un peu" } });
    await sleep(40);
    check("les messages circulent", g(cl[0]).phase === "hot" && g(cl[0]).log.length === 2);
    target.send({ type: "game", action: { kind: "say", text: "nan pas trop" } });
    await sleep(60);
    const r = g(cl[0]).result;
    check("« nan » repéré par le serveur : la cible tombe", g(cl[0]).phase === "result" && r?.outcome === "caught" && r?.word === "nan" && r?.catcherId === ids[cl.indexOf(asker)]);
    check("le piégeur marque +150", g(cl[0]).scores[ids[cl.indexOf(asker)]] === 150);
    for (const c of cl) c.ws.close();
  }

  console.log("\nServeur générique — Devine qui\n");
  {
    const ids = ["ga", "gb", "gc"];
    const cl: Client[] = [];
    for (const [i, id] of ids.entries()) {
      const c = new Client("DQUI", id, i === 0);
      await c.open();
      c.send({ type: "join", name: id.toUpperCase() });
      await sleep(30);
      cl.push(c);
    }
    for (const c of cl.slice(1)) c.send({ type: "set_ready", ready: true });
    await sleep(50);
    cl[0].send({ type: "start_game", gameId: "guesswho", settings: { totalRounds: 1, seconds: 120 } });
    await sleep(80);
    type D = { phase: string; masterId: string; celebrity: { name: string } | null; questions: { id: number; text: string; answer: string | null }[]; left: number; finderId: string | null; scores: Record<string, number> };
    const g = (c: Client) => c.last()?.game as unknown as D;
    check("Devine qui démarre : un Maître du secret", cl[0].last()?.gameId === "guesswho" && g(cl[0])?.phase === "secret" && ids.includes(g(cl[0]).masterId));
    const master = cl[ids.indexOf(g(cl[0]).masterId)];
    const others = cl.filter((c) => c !== master);
    const name = g(master).celebrity!.name;
    check("seul le Maître connaît la personne mystère", !!name && others.every((c) => g(c).celebrity === null && !JSON.stringify(c.last()?.game).includes(name)));
    master.send({ type: "game", action: { kind: "ready" } });
    await sleep(50);
    others[0].send({ type: "game", action: { kind: "ask", text: "Est-ce un humain ?" } });
    await sleep(50);
    const q = g(master).questions[0];
    master.send({ type: "game", action: { kind: "answer", questionId: q.id, answer: "oui" } });
    await sleep(50);
    check("question posée, réponse du Maître visible par tous", g(others[1]).questions[0]?.answer === "oui" && g(others[1]).left === 19);
    others[1].send({ type: "game", action: { kind: "guess", text: name } });
    await sleep(60);
    const fid = ids[cl.indexOf(others[1])];
    check("bonne proposition : manche gagnée et secret révélé", g(cl[0]).phase === "reveal" && g(cl[0]).finderId === fid && g(others[0]).celebrity?.name === name);
    check("points : 100 + 10 × 19 et +50 au Maître", g(cl[0]).scores[fid] === 290 && g(cl[0]).scores[g(cl[0]).masterId] === 50, JSON.stringify(g(cl[0]).scores));
    for (const c of cl) c.ws.close();
  }

  console.log("\nServeur générique — Le Top\n");
  {
    const ids = ["ra", "rb"];
    const cl: Client[] = [];
    for (const [i, id] of ids.entries()) {
      const c = new Client("LTOP", id, i === 0);
      await c.open();
      c.send({ type: "join", name: id.toUpperCase() });
      await sleep(30);
      cl.push(c);
    }
    cl[1].send({ type: "set_ready", ready: true });
    await sleep(50);
    cl[0].send({ type: "start_game", gameId: "ranking", settings: { totalRounds: 2, seconds: 45, mode: "savoir" } });
    await sleep(80);
    type T = { phase: string; items: { label: string; value?: string }[]; expected: number[] | null; gained: Record<string, number> | null };
    const g = (c: Client) => c.last()?.game as unknown as T;
    check("Le Top démarre : 5 éléments, sans valeurs ni réponse", cl[0].last()?.gameId === "ranking" && g(cl[0])?.items.length === 5 && g(cl[0]).items.every((i) => !i.value) && g(cl[0]).expected === null);
    cl[0].send({ type: "game", action: { kind: "order", order: [0, 1, 2, 3, 4] } });
    cl[1].send({ type: "game", action: { kind: "order", order: [4, 3, 2, 1, 0] } });
    await sleep(80);
    const v = g(cl[0]);
    check("tout le monde a classé → révélation avec valeurs", v.phase === "reveal" && v.items.every((i) => !!i.value) && Array.isArray(v.expected));
    const { scoreOrder } = await import("../packages/shared/src/games/ranking/engine");
    check("les points correspondent au barème", v.gained!.ra === scoreOrder([0, 1, 2, 3, 4], v.expected!) && v.gained!.rb === scoreOrder([4, 3, 2, 1, 0], v.expected!), JSON.stringify(v.gained));
    for (const c of cl) c.ws.close();
  }

  console.log("\nServeur — Soirée générée (phase 14)\n");
  {
    const { generateSoiree } = await import("../packages/shared/src/soiree/generator");
    const ids = ["sa", "sb", "sc"];
    const cl: Client[] = [];
    for (const [i, id] of ids.entries()) {
      const c = new Client("GENS", id, i === 0);
      await c.open();
      c.send({ type: "join", name: id.toUpperCase() });
      await sleep(30);
      cl.push(c);
    }
    for (const c of cl.slice(1)) c.send({ type: "set_ready", ready: true });
    await sleep(50);
    const items = generateSoiree("chaos", 3).map((i) => ({ gameId: i.gameId, settings: i.settings }));
    cl[0].send({ type: "soiree_start", items });
    await sleep(100);
    const st = cl[0].last() as unknown as { gameId: string; soiree?: { items: { gameId: string }[] } };
    check("une soirée « Chaos » générée se lance sur son 1er jeu", st?.gameId === items[0].gameId && st?.soiree?.items.length === items.length, `${st?.gameId} / ${items.map((i) => i.gameId).join()}`);
    for (const c of cl) c.ws.close();
  }

  console.log("\nServeur — le grand tour : tous les jeux enchaînés dans une vraie soirée (phase 17)\n");
  {
    const { listedGames } = await import("../packages/shared/src/platform/catalog");
    const { soireeSettings } = await import("../packages/shared/src/soiree/generator");
    const ids = ["ta", "tb", "tc"];
    const cl: Client[] = [];
    for (const [i, id] of ids.entries()) {
      const c = new Client("TOUR", id, i === 0);
      await c.open();
      c.send({ type: "join", name: id.toUpperCase() });
      await sleep(30);
      cl.push(c);
    }
    for (const c of cl.slice(1)) c.send({ type: "set_ready", ready: true });
    await sleep(50);
    const h = cl[0];
    // Tous les jeux du lobby jouables à 3 (un nouveau jeu est couvert automatiquement), en version
    // express, répartis en soirées de SOIREE_MAX_ITEMS jeux maximum.
    const { SOIREE_MAX_ITEMS } = await import("../packages/shared/src/soiree/types");
    const games = listedGames().filter((g) => g.minPlayers <= 3 && g.maxPlayers >= 3).map((g) => g.id);
    const finishedGames: string[] = [];
    const stuck: string[] = [];
    let allRecorded = true;
    let totalsOk = true;
    for (let from = 0; from < games.length; from += SOIREE_MAX_ITEMS) {
      const chunk = games.slice(from, from + SOIREE_MAX_ITEMS);
      h.send({ type: "soiree_start", items: chunk.map((gameId) => ({ gameId, settings: soireeSettings(gameId, true) })) });
      await sleep(120);
      for (let k = 0; k < chunk.length; k++) {
        const gameId = h.last()?.gameId as string;
        let prevKey = "";
        let still = 0;
        for (let i = 0; i < 600 && !h.last()?.gameOver; i++) {
          h.send({ type: "skip" });
          await sleep(8);
          const key = JSON.stringify(h.last()?.game ?? null);
          still = key === prevKey ? still + 1 : 0;
          prevKey = key;
          // Phases pilotées par l'hôte (Mimic : « Lancer », « Manche suivante ») : comme dans modes.test.
          if (still > 3) for (const kind of ["start", "next"]) h.send({ type: "game", action: { kind } as never });
        }
        await sleep(40);
        if (h.last()?.gameOver) finishedGames.push(gameId);
        else stuck.push(`${gameId}@${(h.last()?.game as { phase?: string } | undefined)?.phase}`);
        h.send({ type: "soiree_next" });
        await sleep(120);
      }
      const end = h.last();
      if (end?.soiree?.records.length !== chunk.length || end?.state.phase !== "lobby" || !end?.soiree?.finished) allRecorded = false;
      const pts = (end?.soiree?.records ?? []).reduce((a, r) => a + Object.values(r.points).reduce((x, y) => x + y, 0), 0);
      const tot = Object.values(end?.soiree?.totals ?? {}).reduce((a, b) => a + b, 0);
      if (pts !== tot || tot <= 0) totalsOk = false;
      h.send({ type: "soiree_end" });
      await sleep(60);
    }
    check(`les ${games.length} jeux du lobby vont tous au bout en soirée`, stuck.length === 0 && finishedGames.length === games.length, `bloqués : ${stuck.join(", ")}`);
    check("chaque jeu enregistre son résultat et chaque soirée finit au salon", allRecorded);
    check("score global = somme des points de chaque jeu", totalsOk);
    check("le même salon et les mêmes joueurs du début à la fin", ids.every((id) => !!h.last()?.state.players[id]) && h.last()?.state.phase === "lobby");
    for (const c of cl) c.ws.close();
  }

  console.log("\nServeur — santé & statistiques anonymes\n");
  const health = await fetch("http://localhost:3999/health");
  check("/health répond ok", health.status === 200 && (await health.text()) === "ok");
  const denied = await fetch("http://localhost:3999/stats?token=faux");
  check("/stats refuse un mauvais code", denied.status === 403);
  const st = await fetch("http://localhost:3999/stats?token=test-token");
  const body = (await st.json()) as { onlineNow: number; days: Record<string, { roomsCreated: number; uniquePlayers: number; gamesStarted: Record<string, number> }> };
  const day = Object.values(body.days)[0];
  check("/stats compte des salons, joueurs et parties", !!day && day.roomsCreated > 0 && day.uniquePlayers > 0 && Object.keys(day.gamesStarted).length > 0);
  check("/stats ne contient aucun pseudo", !JSON.stringify(body).includes("Alice"));
  check("/stats compte les Pass Soirée", (day as { passes?: number }).passes === 1);

  console.log(`\n${passed} réussis, ${failed} échoués\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
