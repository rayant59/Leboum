// ---------------------------------------------------------------------------
// Thème du site (couleurs, polices, CSS libre), réglé depuis la page /design.
//
//   GET  /theme                       → le thème publié (public)
//   POST /theme  {token, theme}       → publie un nouveau thème
//   POST /theme/login {token}         → vérifie le code d'accès
//
// Code d'accès : DESIGN_TOKEN (à défaut STATS_TOKEN). Sans aucun des deux, la
// publication n'est autorisée que depuis la machine elle-même (dev local).
// Sauvegarde : THEME_FILE (par défaut data/theme.json, disque persistant en prod).
// ---------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { EMPTY_THEME, sanitizeTheme, type SiteTheme } from "@subtitles-party/shared";

export interface StoredTheme {
  theme: SiteTheme;
  updatedAt: number | null;
}

export class ThemeStore {
  private current: StoredTheme = { theme: EMPTY_THEME, updatedAt: null };

  constructor(private file: string | null) {
    if (file && existsSync(file)) {
      try {
        const raw = JSON.parse(readFileSync(file, "utf8")) as { theme?: unknown; updatedAt?: unknown };
        const theme = sanitizeTheme(raw.theme);
        if (theme) this.current = { theme, updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : null };
      } catch (e) {
        console.warn("[theme] fichier illisible, thème d'origine utilisé :", (e as Error).message);
      }
    }
  }

  get(): StoredTheme {
    return this.current;
  }

  /** Remplace le thème. Renvoie null si l'entrée est invalide. */
  set(input: unknown, now: number): StoredTheme | null {
    const theme = sanitizeTheme(input);
    if (!theme) return null;
    this.current = { theme, updatedAt: now };
    if (this.file) {
      mkdirSync(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.current, null, 2));
      renameSync(tmp, this.file);
    }
    return this.current;
  }
}

/** Le code fourni ouvre-t-il l'éditeur ? */
export function designAllowed(token: unknown, configured: string | undefined, remoteAddress: string | undefined): boolean {
  if (configured) return typeof token === "string" && token.length > 0 && token === configured;
  // Pas de code configuré : seulement en local (npm run dev:server sur ce PC).
  const a = remoteAddress ?? "";
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}
