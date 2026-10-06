// ---------------------------------------------------------------------------
// Thème du site (couleurs, polices, CSS libre), réglé depuis la page /design.
//
//   GET  /theme                       → le thème publié (public)
//   POST /theme  {token, theme}       → publie un nouveau thème
//   POST /theme/login {token}         → vérifie le code d'accès
//
// Code d'accès : DESIGN_TOKEN (à défaut STATS_TOKEN). Sans aucun des deux, la
// publication n'est autorisée que depuis la machine elle-même (dev local).
//
// Où est rangé le design :
// - site-theme.json, à la racine du projet, SUIVI PAR GIT. En local (sans
//   THEME_FILE), « Publier » écrit dans ce fichier : un commit + push suffit
//   pour envoyer ton design en ligne avec le code.
// - THEME_FILE (en ligne, sur un disque persistant) : ce qui est publié depuis
//   le site en ligne. Le serveur lit les deux et sert LE PLUS RÉCENT.
// ---------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { EMPTY_THEME, sanitizeTheme, type SiteTheme } from "@subtitles-party/shared";

export interface StoredTheme {
  theme: SiteTheme;
  updatedAt: number | null;
}

function readStored(file: string | null): StoredTheme | null {
  if (!file || !existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as { theme?: unknown; updatedAt?: unknown };
    const theme = sanitizeTheme(raw.theme);
    return theme ? { theme, updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : null } : null;
  } catch (e) {
    console.warn(`[theme] ${file} illisible, ignoré :`, (e as Error).message);
    return null;
  }
}

export class ThemeStore {
  private current: StoredTheme = { theme: EMPTY_THEME, updatedAt: null };

  /**
   * @param file    fichier où « Publier » écrit
   * @param codeFile design livré avec le code (site-theme.json), lu en plus
   */
  constructor(private file: string | null, codeFile: string | null = null) {
    const candidates = [readStored(file), readStored(codeFile !== file ? codeFile : null)].filter((x): x is StoredTheme => !!x);
    // Le plus récent gagne (un design poussé avec le code passe devant un
    // design publié en ligne plus ancien, et inversement).
    candidates.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    if (candidates[0]) this.current = candidates[0];
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
