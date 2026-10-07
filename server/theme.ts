// ---------------------------------------------------------------------------
// Thème du site (couleurs, polices, CSS libre, retouches à la souris), réglé
// depuis la page /design — UNIQUEMENT EN LOCAL, sur ton PC.
//
//   GET  /theme         → le design actuel (public : tous les visiteurs le lisent)
//   POST /theme {theme} → enregistre un nouveau design   } refusés sauf depuis
//   POST /theme/login   → vérifie que l'éditeur est permis } ce PC (voir plus bas)
//
// Le design est rangé dans site-theme.json, à la racine du projet, SUIVI PAR
// GIT : « Publier » écrit dans ce fichier, puis commit + push l'envoie en ligne.
// En ligne, le serveur ne fait que LIRE ce fichier : personne ne peut rien y
// modifier depuis Internet.
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

/**
 * Brouillon de l'éditeur, SAUVEGARDÉ AUTOMATIQUEMENT à chaque modification
 * (data/site-theme.draft.json, ignoré par git). Il survit à un rechargement,
 * à un redémarrage et à un changement de navigateur. « Publier » le recopie
 * dans site-theme.json, le fichier qui part sur GitHub.
 */
export interface StoredDraft {
  theme: SiteTheme;
  /** `updatedAt` du design publié sur lequel ce brouillon a été commencé. */
  base: number | null;
  savedAt: number;
}

export class DraftStore {
  private current: StoredDraft | null = null;

  constructor(private file: string | null) {
    if (!file || !existsSync(file)) return;
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as { theme?: unknown; base?: unknown; savedAt?: unknown };
      const theme = sanitizeTheme(raw.theme);
      if (theme) this.current = { theme, base: typeof raw.base === "number" ? raw.base : null, savedAt: typeof raw.savedAt === "number" ? raw.savedAt : 0 };
    } catch (e) {
      console.warn(`[theme] brouillon ${file} illisible, ignoré :`, (e as Error).message);
    }
  }

  get(): StoredDraft | null {
    return this.current;
  }

  /** Enregistre le brouillon (`null` = plus de brouillon). */
  set(input: unknown, base: number | null, now: number): StoredDraft | null | false {
    if (input === null) {
      this.current = null;
      this.write();
      return null;
    }
    const theme = sanitizeTheme(input);
    if (!theme) return false;
    this.current = { theme, base, savedAt: now };
    this.write();
    return this.current;
  }

  private write() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.current, null, 2));
    renameSync(tmp, this.file);
  }
}

/**
 * L'éditeur est-il permis pour cette requête ? Seulement si elle vient de la
 * machine elle-même (localhost) ET ne passe par aucun proxy : un serveur en
 * ligne reçoit toujours ses visiteurs via un proxy (en-têtes X-Forwarded-*),
 * donc il refuse tout, même si quelqu'un trouvait l'adresse.
 */
export function designAllowed(remoteAddress: string | undefined, headers: Record<string, string | string[] | undefined>): boolean {
  const a = remoteAddress ?? "";
  const loopback = a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
  const proxied = ["x-forwarded-for", "x-forwarded-host", "x-real-ip", "forwarded", "via"].some((h) => headers[h] !== undefined);
  return loopback && !proxied && process.env.DESIGN_EDITOR !== "off";
}
