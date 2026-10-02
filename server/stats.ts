// ---------------------------------------------------------------------------
// Statistiques de fréquentation — 100 % anonymes, sans cookie.
//
// On ne stocke AUCUNE donnée personnelle : seulement des compteurs par jour
// (salons créés, joueurs uniques, parties lancées par jeu, pic de joueurs
// connectés en même temps). Les identifiants de joueurs servent uniquement à
// compter les « joueurs uniques » du jour, en mémoire, et ne sont jamais
// écrits sur le disque.
//
// Lecture : GET /stats?token=STATS_TOKEN  (JSON), utilisé par la page /stats
// du site.
// ---------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export interface DayStats {
  roomsCreated: number;
  uniquePlayers: number;
  gamesStarted: Record<string, number>;
  /** Somme des joueurs au lancement de chaque partie (→ moyenne par partie). */
  playersInGames: number;
  peakOnline: number;
  /** Pass Soirée activés (achats confirmés). */
  passes?: number;
}

export interface StatsSnapshot {
  since: string;
  onlineNow: number;
  roomsNow: number;
  days: Record<string, DayStats>;
}

const emptyDay = (): DayStats => ({ roomsCreated: 0, uniquePlayers: 0, gamesStarted: {}, playersInGames: 0, peakOnline: 0 });

/** Date du jour en heure de Paris (AAAA-MM-JJ). */
export function parisDay(now: number): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}

export class Stats {
  private days: Record<string, DayStats> = {};
  private since: string;
  private seenToday = new Set<string>();
  private seenDay = "";
  private online = 0;
  private dirty = false;

  constructor(private file: string | null, private now: () => number = Date.now) {
    this.since = new Date(this.now()).toISOString();
    if (file && existsSync(file)) {
      try {
        const raw = JSON.parse(readFileSync(file, "utf8")) as { since?: string; days?: Record<string, DayStats> };
        this.days = raw.days ?? {};
        this.since = raw.since ?? this.since;
      } catch {
        /* fichier illisible → on repart de zéro, sans planter le serveur */
      }
    }
  }

  private today(): DayStats {
    const d = parisDay(this.now());
    if (d !== this.seenDay) {
      this.seenDay = d;
      this.seenToday = new Set();
    }
    this.dirty = true;
    return (this.days[d] ??= emptyDay());
  }

  roomCreated() {
    this.today().roomsCreated++;
  }

  playerSeen(playerId: string) {
    const day = this.today();
    if (!this.seenToday.has(playerId)) {
      this.seenToday.add(playerId);
      day.uniquePlayers++;
    }
  }

  gameStarted(gameId: string, players: number) {
    const day = this.today();
    day.gamesStarted[gameId] = (day.gamesStarted[gameId] ?? 0) + 1;
    day.playersInGames += players;
  }

  passActivated() {
    const day = this.today();
    day.passes = (day.passes ?? 0) + 1;
  }

  connected() {
    this.online++;
    const day = this.today();
    if (this.online > day.peakOnline) day.peakOnline = this.online;
  }

  disconnected() {
    this.online = Math.max(0, this.online - 1);
  }

  snapshot(roomsNow: number): StatsSnapshot {
    return { since: this.since, onlineNow: this.online, roomsNow, days: this.days };
  }

  /** Écrit le fichier si quelque chose a changé (appelé périodiquement). */
  flush() {
    if (!this.file || !this.dirty) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify({ since: this.since, days: this.days }));
      this.dirty = false;
    } catch (e) {
      console.warn("[stats] écriture impossible :", (e as Error).message);
    }
  }
}
