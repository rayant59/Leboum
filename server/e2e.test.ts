// End-to-end test of the real server driving an ANONYMISED game with real
// WebSocket clients. Clients vote by opaque token (they never receive authors
// during voting), exactly like the browser. Run: npx tsx server/e2e.test.ts
process.env.PORT = "3999";

import { WebSocket } from "ws";
import { SPEED_PRESETS, DEFAULT_GAME_SETTINGS } from "@subtitles-party/shared";
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
  const word = drawer.drawGame()!.wordChoices![0];
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
  const impostor = faClients.find((c) => pub(c)?.youAreImpostor);
  const reals = faClients.filter((c) => !pub(c)?.youAreImpostor);
  check("exactement un imposteur", !!impostor && reals.length === 2);
  check("l'imposteur ne voit pas le mot", pub(impostor!).word === null);
  check("les joueurs réels voient le mot", reals.every((c) => typeof pub(c).word === "string"));

  // n'importe qui peut dessiner en faux-artiste
  fb.send({ type: "draw_stroke", stroke: { points: [{ x: 0.3, y: 0.3 }], color: "#000", width: 4 } });
  await sleep(50);
  check("un non-dessinateur peut dessiner en faux-artiste", fa.strokes.length > 0);
  check("le trait est étiqueté avec son auteur", fa.strokes.some((s) => s.from === "fb"));
  // toiles indépendantes : deux auteurs distincts sont bien tracés
  fa.send({ type: "draw_stroke", stroke: { points: [{ x: 0.6, y: 0.6 }], color: "#f00", width: 4 } });
  await sleep(50);
  check("chaque toile porte son propre auteur", fc.strokes.some((s) => s.from === "fa") && fc.strokes.some((s) => s.from === "fb"));

  fa.send({ type: "skip" }); // -> voting (host)
  await sleep(90);
  check("passage à la phase de vote", pub(fa)?.phase === "voting");
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
  da2.send({ type: "game", action: { kind: "pick_video", videoId: "restaurant" } });
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

  console.log(`\n${passed} réussis, ${failed} échoués\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
