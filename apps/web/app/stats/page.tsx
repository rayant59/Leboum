"use client";

import { useEffect, useState } from "react";
import { InfoPage } from "@/components/InfoPage";
import { serverHttpUrl } from "@/lib/useRoom";

interface DayStats { roomsCreated: number; uniquePlayers: number; gamesStarted: Record<string, number>; playersInGames: number; peakOnline: number }
interface Snapshot { since: string; onlineNow: number; roomsNow: number; days: Record<string, DayStats> }

const GAME_NAMES: Record<string, string> = {
  draw: "Boum Dessin", mimic: "Mimic Boum", quiz: "Ça te parle ?", reco: "Œil de Boum", pixel: "Pixel Panic",
  bombe: "Boum Rush", fakeartist: "Faux-artiste", relay: "Relais", doublage: "Doublage", subtitles: "Sous-titres",
};
const KEY = "lb:statsToken";
const fmt = (n: number) => n.toLocaleString("fr-FR");

export default function StatsPage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");

  async function load(t: string) {
    setError("");
    try {
      const res = await fetch(serverHttpUrl(`/stats?token=${encodeURIComponent(t)}`), { cache: "no-store" });
      if (!res.ok) { setError(res.status === 403 ? "Code incorrect." : "Statistiques pas encore activées sur le serveur (STATS_TOKEN)."); return; }
      setData((await res.json()) as Snapshot);
      try { localStorage.setItem(KEY, t); } catch { /* navigateur privé : tant pis */ }
    } catch {
      setError("Serveur de jeu injoignable pour le moment.");
    }
  }

  useEffect(() => {
    let saved = "";
    try { saved = localStorage.getItem(KEY) ?? ""; } catch { /* ignore */ }
    if (saved) { setToken(saved); void load(saved); }
  }, []);

  const days = data ? Object.entries(data.days).sort((a, b) => b[0].localeCompare(a[0])) : [];
  const last7 = days.slice(0, 7);
  const sum = (f: (d: DayStats) => number) => last7.reduce((n, [, d]) => n + f(d), 0);
  const games7 = sum((d) => Object.values(d.gamesStarted).reduce((a, b) => a + b, 0));
  const perGame: Record<string, number> = {};
  for (const [, d] of last7) for (const [g, n] of Object.entries(d.gamesStarted)) perGame[g] = (perGame[g] ?? 0) + n;

  const card = { borderRadius: 16, border: "1px solid rgb(var(--c-ink-border))", background: "rgb(var(--c-ink-surface) / .6)", padding: "16px 18px" } as const;
  const big = { fontFamily: "var(--font-display), sans-serif", fontSize: 34, fontWeight: 800, color: "rgb(var(--c-text))", lineHeight: 1.1 } as const;

  return (
    <InfoPage kicker="Réservé à l'équipe" title="Fréquentation de LeBoum">
      {!data && (
        <form onSubmit={(e) => { e.preventDefault(); void load(token); }} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Code d'accès" type="password"
            style={{ flex: "1 1 220px", borderRadius: 12, border: "1px solid rgb(var(--c-ink-border))", background: "rgb(var(--c-ink-deep))", color: "rgb(var(--c-text))", padding: "12px 14px", fontSize: 16 }} />
          <button style={{ borderRadius: 12, border: "none", background: "rgb(var(--c-gold))", color: "rgb(var(--c-ink))", fontWeight: 800, padding: "12px 20px", cursor: "pointer" }}>Voir</button>
        </form>
      )}
      {error && <p style={{ color: "#FF8A8A" }}>{error}</p>}

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <div style={card}><div style={big}>{fmt(data.onlineNow)}</div>connectés en ce moment</div>
            <div style={card}><div style={big}>{fmt(sum((d) => d.uniquePlayers))}</div>joueurs · 7 derniers jours</div>
            <div style={card}><div style={big}>{fmt(sum((d) => d.roomsCreated))}</div>salons créés · 7 j</div>
            <div style={card}><div style={big}>{fmt(games7)}</div>parties lancées · 7 j</div>
          </div>

          <h2>Jeux les plus joués (7 jours)</h2>
          {Object.keys(perGame).length === 0 ? <p>Aucune partie pour l&apos;instant.</p> : (
            <ul>
              {Object.entries(perGame).sort((a, b) => b[1] - a[1]).map(([g, n]) => <li key={g}>{GAME_NAMES[g] ?? g} — {fmt(n)}</li>)}
            </ul>
          )}

          <h2>Jour par jour</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ textAlign: "left", color: "rgb(var(--c-text-muted))" }}><th>Jour</th><th>Joueurs</th><th>Salons</th><th>Parties</th><th>Joueurs/partie</th><th>Pic simultané</th></tr></thead>
              <tbody>
                {days.slice(0, 30).map(([day, d]) => {
                  const g = Object.values(d.gamesStarted).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={day} style={{ borderTop: "1px solid #2A2350" }}>
                      <td style={{ padding: "8px 0" }}>{new Date(day + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</td>
                      <td>{fmt(d.uniquePlayers)}</td><td>{fmt(d.roomsCreated)}</td><td>{fmt(g)}</td>
                      <td>{g ? (d.playersInGames / g).toFixed(1).replace(".", ",") : "—"}</td><td>{fmt(d.peakOnline)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 13, color: "rgb(var(--c-text-faint))" }}>Comptage depuis le {new Date(data.since).toLocaleDateString("fr-FR")}. Anonyme : aucun pseudo n&apos;est enregistré.</p>
        </>
      )}
    </InfoPage>
  );
}
