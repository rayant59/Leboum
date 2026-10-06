"use client";

// Panneau Admin de l'éditeur (local uniquement) : ajoute des bots dans un
// salon pour tester les mini-jeux seul. Les bots sont gérés par le serveur de
// jeu (server/index.ts → /admin/*), qui refuse tout ce qui ne vient pas du PC.

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { serverHttpUrl } from "@/lib/useRoom";
import { GAME_REGISTRY, gameInfo } from "@subtitles-party/shared";
import { REPLAY_INTRO_EVENT, useCurrentRoom, useFrozen } from "@/lib/freeze";

type Level = "facile" | "normal" | "fort";
interface AdminPlayer { id: string; name: string; isBot: boolean; connected: boolean; isHost: boolean; ready: boolean }
interface AdminRoom {
  code: string;
  phase: "lobby" | "in_game";
  gameId: string | null;
  players: AdminPlayer[];
  maxPlayers: number;
  botsPaused: boolean;
  botLevel: Level;
  timePaused: boolean;
}
type Status = { kind: "ok" | "err" | "info"; text: string } | null;

const LEVELS: { id: Level; label: string; hint: string }[] = [
  { id: "facile", label: "Facile", hint: "Se trompent souvent" },
  { id: "normal", label: "Normal", hint: "Un peu de tout" },
  { id: "fort", label: "Fort", hint: "Trouvent souvent" },
];

async function api<T>(path: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(serverHttpUrl(path), body === undefined
      ? { cache: "no-store" }
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? `Erreur ${res.status}` };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Serveur de jeu injoignable : lance « npm run dev:server »." };
  }
}

/** Tous les jeux hébergés (y compris ceux masqués du salon), triés par nom. */
const ALL_GAMES = [...Object.keys(GAME_REGISTRY), "subtitles"]
  .map((id) => ({ id, name: gameInfo(id).name }))
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

function gameName(id: string | null): string {
  if (!id) return "";
  try { return gameInfo(id).name; } catch { return id; }
}

export function AdminBots() {
  const pathname = usePathname();
  const here = /^\/room\/([A-Za-z0-9]+)/.exec(pathname ?? "")?.[1]?.toUpperCase() ?? null;
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [launchId, setLaunchId] = useState<string>("bombe");

  const refresh = useCallback(async () => {
    const r = await api<{ rooms: AdminRoom[] }>("/admin/rooms");
    if (r.ok) setRooms(r.data.rooms);
    else { setRooms([]); setStatus({ kind: "err", text: r.error }); }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(id);
  }, [refresh]);

  const code = here ?? picked ?? rooms?.[0]?.code ?? null;
  const room = rooms?.find((r) => r.code === code) ?? null;
  const bots = room?.players.filter((p) => p.isBot) ?? [];
  const connected = room?.players.filter((p) => p.connected).length ?? 0;
  const free = room ? Math.max(0, room.maxPlayers - connected) : 0;

  async function act(body: Record<string, unknown>, done?: string) {
    if (!room) return;
    setBusy(true);
    const r = await api<{ room: AdminRoom; warning?: string | null }>("/admin/bots", { room: room.code, ...body });
    setBusy(false);
    if (!r.ok) { setStatus({ kind: "err", text: r.error }); return; }
    setRooms((list) => list?.map((x) => (x.code === r.data.room.code ? r.data.room : x)) ?? list);
    setStatus(r.data.warning ? { kind: "info", text: r.data.warning } : done ? { kind: "ok", text: done } : null);
  }

  return (
    <div className="lbd-admin">
      <p className="lbd-hint" style={{ marginTop: 0 }}>
        Pour tester les mini-jeux tout seul : fige le temps pour retoucher n&apos;importe quel écran, avance étape par étape,
        lance un jeu directement, et ajoute des bots qui jouent, votent et devinent tout seuls.
      </p>

      <section className="lbd-group">
        <h3>Salon</h3>
        {rooms === null ? (
          <p className="lbd-hint">Chargement…</p>
        ) : rooms.length === 0 ? (
          <p className="lbd-hint">Aucun salon ouvert. Crée un salon sur le site, il apparaîtra ici.</p>
        ) : here ? (
          room ? <p className="lbd-roomline"><b>{room.code}</b> <span>{room.phase === "lobby" ? "au salon" : `en jeu · ${gameName(room.gameId)}`}</span></p>
               : <p className="lbd-hint">Le salon {here} n&apos;existe pas (ou plus) sur le serveur.</p>
        ) : (
          <label className="lbd-field" style={{ marginBottom: 0 }}>
            <select value={code ?? ""} onChange={(e) => setPicked(e.target.value)}>
              {rooms.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} — {r.players.filter((p) => p.connected).length} joueur(s) · {r.phase === "lobby" ? "au salon" : gameName(r.gameId)}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {room && (
        <>
          <section className="lbd-group">
            <h3>Temps &amp; écrans</h3>
            <button
              type="button"
              className={room.timePaused ? "lbd-btn lbd-freeze on" : "lbd-btn lbd-freeze"}
              disabled={busy}
              onClick={() => void act({ op: "time", paused: !room.timePaused }, room.timePaused ? "Le temps repart." : "Temps figé : rien ne bouge, tout reste cliquable.")}
            >
              {room.timePaused ? "▶  Reprendre le temps" : "⏸  Figer le temps"}
            </button>
            <p className="lbd-hint">
              Figé : les chronos, les décomptes 3·2·1 et les bots s&apos;arrêtent, mais la page reste cliquable et
              modifiable (onglet Contenu). Avance écran par écran avec « Étape suivante ».
            </p>
            <div className="lbd-row">
              <button type="button" className="lbd-btn" disabled={busy || room.phase !== "in_game"} onClick={() => void act({ op: "advance" }, "Étape suivante.")} title="Passe à la phase suivante du jeu (même si le temps est figé)">
                ⏭ Étape suivante
              </button>
              <button type="button" className="lbd-btn" disabled={room.phase !== "in_game" || here !== room.code} onClick={() => { window.dispatchEvent(new Event(REPLAY_INTRO_EVENT)); setStatus({ kind: "info", text: room.timePaused ? "Annonce affichée (elle reste tant que le temps est figé ; clique dessus pour la fermer)." : "Annonce rejouée." }); }} title="Réaffiche l'écran d'annonce du jeu (3·2·1)">
                🎬 Revoir l&apos;annonce
              </button>
            </div>
            <div className="lbd-row lbd-launch">
              <select value={launchId} onChange={(e) => setLaunchId(e.target.value)} aria-label="Jeu à lancer">
                {ALL_GAMES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button type="button" className="lbd-btn" disabled={busy} onClick={() => void act({ op: "launch", gameId: launchId }, `${gameName(launchId)} lancé.`)} title="Lance ce jeu tout de suite (arrête la partie en cours)">
                Lancer
              </button>
            </div>
          </section>

          <section className="lbd-group">
            <h3>Joueurs · {connected}/{room.maxPlayers}</h3>
            <ul className="lbd-players">
              {room.players.map((p) => (
                <li key={p.id} className={p.connected ? "" : "off"}>
                  <span className="lbd-pname">{p.name}</span>
                  {p.isHost && <span className="lbd-chip">hôte</span>}
                  {room.phase === "lobby" && p.ready && !p.isHost && <span className="lbd-chip lbd-chip-ok">prêt</span>}
                  {!p.connected && <span className="lbd-chip">absent</span>}
                  {p.isBot && (
                    <button type="button" className="lbd-icon" disabled={busy} onClick={() => void act({ op: "remove", id: p.id })} aria-label={`Retirer ${p.name}`} title="Retirer ce bot">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="lbd-row">
              <button type="button" className="lbd-btn lbd-primary" disabled={busy || free === 0} onClick={() => void act({ op: "add", count: 1 }, "Bot ajouté.")}>+ 1 bot</button>
              <button type="button" className="lbd-btn" disabled={busy || free < 3} onClick={() => void act({ op: "add", count: 3 }, "3 bots ajoutés.")}>+ 3 bots</button>
              <button type="button" className="lbd-btn" disabled={busy || free === 0} onClick={() => void act({ op: "add", count: free }, "Salon rempli.")}>Remplir</button>
            </div>
            {free === 0 && <p className="lbd-hint">Salon complet.</p>}
          </section>

          <section className="lbd-group">
            <h3>Niveau des bots</h3>
            <div className="lbd-seg" role="radiogroup" aria-label="Niveau des bots">
              {LEVELS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={room.botLevel === l.id} className={room.botLevel === l.id ? "on" : ""} disabled={busy} title={l.hint} onClick={() => void act({ op: "level", level: l.id })}>
                  {l.label}
                </button>
              ))}
            </div>
            <label className="lbd-check">
              <input type="checkbox" checked={room.botsPaused} disabled={busy} onChange={(e) => void act({ op: "pause", paused: e.target.checked })} />
              <span>Mettre les bots en pause <small>(ils ne font plus rien : pratique pour tester un écran d&apos;attente)</small></span>
            </label>
            {bots.length > 0 && (
              <div className="lbd-row">
                <button type="button" className="lbd-btn lbd-danger" disabled={busy} onClick={() => void act({ op: "clear" }, "Bots retirés.")}>Retirer tous les bots</button>
              </div>
            )}
          </section>

          <p className="lbd-hint">
            Les bots ne parlent pas pour de vrai : au Mimic ils envoient des petits bips, au Téléphone cassé des gribouillis.
            En mode oral (Mot interdit, Ni oui ni non), c&apos;est toi qui fais vivre la partie.
          </p>
        </>
      )}

      {status && <p className={`lbd-status lbd-${status.kind}`} role="status" style={{ marginTop: 12 }}>{status.text}</p>}
    </div>
  );
}

/** Pastille toujours visible quand le temps est figé (même panneau réduit). */
export function FreezePill() {
  const frozen = useFrozen();
  const code = useCurrentRoom();
  const [busy, setBusy] = useState(false);
  if (!frozen || !code) return null;
  return (
    <button
      type="button"
      className="lbd-pill"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api("/admin/bots", { room: code, op: "time", paused: false });
        setBusy(false);
      }}
      title="Le temps du salon est figé — clique pour le relancer"
    >
      <span className="lbd-pill-dot" /> Temps figé · <b>Reprendre</b>
    </button>
  );
}

export const ADMIN_CSS = `
.lbd-freeze{width:100%;padding:12px;font-size:14px}
.lbd-freeze.on{background:var(--wa);border-color:var(--wa);color:#1A1405}
.lbd-launch select{flex:1;min-width:0;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:var(--bg2);color:var(--tx);font:inherit}
.lbd-launch .lbd-btn{flex:0 0 auto}
.lbd-pill{position:fixed;z-index:2147483001;left:16px;bottom:16px;display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border:1px solid rgba(245,194,107,.5);border-radius:999px;background:#1A1405;color:#F5C26B;font:600 13px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer;box-shadow:0 12px 30px -10px rgba(0,0,0,.8)}
.lbd-pill b{color:#FFE2A8}
.lbd-pill-dot{width:8px;height:8px;border-radius:50%;background:#F5C26B;animation:lbd-blink 1.2s ease-in-out infinite}
@keyframes lbd-blink{50%{opacity:.25}}
.lbd-roomline{margin:0;display:flex;gap:8px;align-items:baseline}
.lbd-roomline b{font:700 16px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em}
.lbd-roomline span{color:var(--mu);font-size:12px}
.lbd-players{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.lbd-players li{display:flex;align-items:center;gap:6px;min-height:32px;padding:2px 4px 2px 10px;border-radius:9px;background:var(--bg2)}
.lbd-players li.off{opacity:.5}
.lbd-pname{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lbd-chip-ok{background:rgba(91,214,154,.14);color:var(--ok)}
.lbd-seg{display:flex;gap:4px;padding:3px;border-radius:10px;background:var(--bg2)}
.lbd-seg button{flex:1;padding:7px 8px;border:0;border-radius:8px;background:transparent;color:var(--mu);font:inherit;font-weight:600;cursor:pointer}
.lbd-seg button.on{background:var(--ac);color:#0B0D18}
.lbd-check{display:flex;gap:8px;align-items:flex-start;margin-top:12px;cursor:pointer}
.lbd-check input{margin-top:2px;accent-color:var(--ac)}
.lbd-check small{display:block;color:var(--mu);font-size:11px}
`;
