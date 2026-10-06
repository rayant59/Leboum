// Bots de test, de bout en bout : le vrai serveur, un vrai client humain, et
// des bots ajoutés via l'API Admin (réservée au PC local).
// Run: npx tsx server/bots.test.ts
process.env.PORT = "3998";
process.env.STATS_FILE = "";
process.env.PASS_FILE = "";
process.env.THEME_FILE = "";

import { WebSocket } from "ws";
import { addCustomQuestions, parseCustomQuestions, type ServerMessage } from "@subtitles-party/shared";
import { botDrawingPng, botVoiceWav } from "./botMedia";

addCustomQuestions(parseCustomQuestions([
  "Capitale de l'Italie ? = Rome", "Capitale du Japon ? = Tokyo", "Couleur du ciel ? = bleu", "Quel animal aboie ? = chien",
].join("\n")));

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { passed++; console.log(`  \u001b[32m✓\u001b[0m ${name}`); }
  else { failed++; console.log(`  \u001b[31m✗ ${name}\u001b[0m ${detail}`); }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type StateMsg = ServerMessage & { type: "state" };

async function main() {
  await import("./index");
  await sleep(300);
  const base = "http://127.0.0.1:3998";
  const admin = async (body: unknown) => {
    const r = await fetch(`${base}/admin/bots`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, data: (await r.json()) as { ok?: boolean; error?: string; added?: string[]; room?: { players: { id: string; isBot: boolean; ready: boolean }[]; botsPaused: boolean; botLevel: string } } };
  };

  console.log("médias des bots");
  {
    const png = botDrawingPng(Math.random);
    check("dessin PNG valide (accepté par Téléphone cassé)", /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png) && png.length < 200_000, `${png.length} o`);
    const wav = botVoiceWav(Math.random);
    check("prise de voix WAV assez légère pour Mimic", wav.startsWith("data:audio/wav;base64,UklGR") && wav.length < 260_000, `${wav.length} o`);
  }

  console.log("API Admin");
  const r0 = await admin({ room: "NOPE", op: "add", count: 2 });
  check("salon inconnu → 404", r0.status === 404);

  const states: StateMsg[] = [];
  const ws = new WebSocket("ws://localhost:3998/?room=BOTS&id=human&create=1");
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString()) as ServerMessage;
    if (m.type === "state") states.push(m);
  });
  await new Promise((r) => ws.once("open", r));
  ws.send(JSON.stringify({ type: "join", name: "Rayan" }));
  await sleep(150);

  const r1 = await admin({ room: "bots", op: "add", count: 3 });
  check("ajout de 3 bots", r1.status === 200 && r1.data.added?.length === 3, JSON.stringify(r1.data));
  const rooms = (await (await fetch(`${base}/admin/rooms`)).json()) as { rooms: { code: string; players: { isBot: boolean }[] }[] };
  const info = rooms.rooms.find((x) => x.code === "BOTS");
  check("le salon apparaît dans la liste Admin, avec ses bots", !!info && info.players.filter((p) => p.isBot).length === 3);

  await sleep(2000);
  const last = () => states[states.length - 1] as StateMsg & { paused?: boolean };
  const bots = () => Object.values(last().state.players).filter((p) => p.isBot);
  check("le client voit les 3 bots", bots().length === 3);
  check("les bots se mettent prêts tout seuls", bots().every((p) => p.isReady));
  check("l'humain reste l'hôte", last().state.hostId === "human");

  const r2 = await admin({ room: "BOTS", op: "level", level: "fort" });
  check("niveau des bots réglable", r2.status === 200 && r2.data.room?.botLevel === "fort");
  const r3 = await admin({ room: "BOTS", op: "level", level: "dieu" });
  check("niveau inconnu refusé", r3.status === 400);

  console.log("partie de quiz avec les bots");
  ws.send(JSON.stringify({ type: "start_game", gameId: "quiz", settings: { totalQuestions: 2, secondsPerQuestion: 10, mode: "classic" } }));
  let answered = -1;
  const t0 = Date.now();
  let botAnswers = 0;
  while (Date.now() - t0 < 60_000) {
    await sleep(200);
    const s = last();
    if (s.gameId !== "quiz" || !s.game) continue;
    const g = s.game as { phase: string; index: number; answeredIds: string[]; yourAnswer: unknown };
    if (g.phase === "question") {
      botAnswers = Math.max(botAnswers, g.answeredIds.filter((id) => id.startsWith("bot-")).length);
      if (answered !== g.index && g.answeredIds.filter((id) => id.startsWith("bot-")).length === 3) {
        answered = g.index;
        ws.send(JSON.stringify({ type: "game", action: { kind: "answer", value: "Rome" } }));
      }
    }
    if (s.gameOver) break;
  }
  check("les bots répondent aux questions", botAnswers === 3);
  check("la partie se termine (bots + humain)", !!last().gameOver, `phase ${(last().game as { phase?: string } | null)?.phase}`);

  console.log("temps figé, étape suivante, lancement direct");
  {
    const rl = await admin({ room: "BOTS", op: "launch", gameId: "whois" });
    check("lancer un jeu directement depuis l'Admin", rl.status === 200, JSON.stringify(rl.data).slice(0, 200));
    await sleep(300);
    check("le client est passé sur ce jeu", last().gameId === "whois" && last().state.phase === "in_game");
    const rp = await admin({ room: "BOTS", op: "time", paused: true });
    await sleep(150);
    check("temps figé (Admin + message aux clients)", (rp.data.room as { timePaused?: boolean } | undefined)?.timePaused === true && last().paused === true);
    const frozenTime = last().serverTime;
    const g0 = last().game as { phase: string; round: number; deadline: number | null };
    await sleep(1500);
    const ra = await admin({ room: "BOTS", op: "advance" });
    await sleep(150);
    const g1 = last().game as { phase: string; round: number };
    check("« Étape suivante » marche même figé", ra.status === 200 && g1.phase !== g0.phase, `${g0.phase} → ${g1.phase}`);
    check("l'horloge envoyée aux clients ne bouge plus", last().serverTime === frozenTime, `${last().serverTime - frozenTime} ms`);
    await admin({ room: "BOTS", op: "advance" }); // révélation → question suivante
    await sleep(2500);
    const g2 = last().game as { phase: string; votedIds: string[]; deadline: number | null };
    check("bots à l'arrêt quand le temps est figé", g2.phase === "question" && g2.votedIds.length === 0, `${g2.phase} ${g2.votedIds.length}`);
    const statesBefore = states.length;
    await sleep(1000);
    check("aucun chrono ne fait avancer le jeu", states.length === statesBefore);
    await admin({ room: "BOTS", op: "time", paused: false });
    await sleep(150);
    check("reprise : l'horloge repart d'où elle s'était arrêtée", last().paused === false && last().serverTime - frozenTime < 1500, `${last().serverTime - frozenTime} ms`);
    const t0 = Date.now();
    while (Date.now() - t0 < 8000 && (last().game as { votedIds: string[] }).votedIds.length < 3) await sleep(200);
    check("après la reprise, les bots rejouent", (last().game as { votedIds: string[] }).votedIds.length >= 3);
    const rbad = await admin({ room: "BOTS", op: "launch", gameId: "nimporte" });
    check("jeu inconnu refusé", rbad.status === 409);
  }

  console.log("pause et retrait");
  const r4 = await admin({ room: "BOTS", op: "pause", paused: true });
  check("pause des bots", r4.status === 200 && r4.data.room?.botsPaused === true);
  const botId = r1.data.added![0];
  const r5 = await admin({ room: "BOTS", op: "remove", id: botId });
  check("retrait d'un bot", r5.status === 200 && !r5.data.room?.players.some((p) => p.id === botId));
  await sleep(200);
  check("le client ne voit plus ce bot", !last().state.players[botId]);
  const r6 = await admin({ room: "BOTS", op: "clear" });
  check("retirer tous les bots", r6.status === 200 && !r6.data.room?.players.some((p) => p.isBot));
  const r7 = await admin({ room: "BOTS", op: "add", count: 20 });
  check("pas plus de bots que de places", r7.status === 200 && (r7.data.added?.length ?? 0) === 7 && !!(r7.data as { warning?: string }).warning, JSON.stringify(r7.data).slice(0, 200));

  ws.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
