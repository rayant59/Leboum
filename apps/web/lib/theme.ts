// Thème du site côté navigateur : application en direct, cache local et
// échanges avec le serveur de jeu (GET/POST /theme). Voir aussi
// packages/shared/src/theme.ts (le format) et components/DesignPanel.tsx.

import { EMPTY_THEME, sanitizeTheme, themeFontsUrl, themeToCss, type SiteTheme } from "@subtitles-party/shared";
import { serverHttpUrl } from "@/lib/useRoom";
import { setEdits } from "@/lib/edits";

const K = {
  /** Dernier thème publié connu (JSON). */
  published: "lb:theme",
  /** Feuille de style actuellement appliquée (lue avant l'affichage). */
  css: "lb:themeCss",
  fonts: "lb:themeFonts",
  /** Brouillon de l'éditeur (JSON). */
  draft: "lb:themeDraft",
  /** Présent = éditeur ouvert (seulement en local). */
  token: "lb:design",
};

function get(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function put(key: string, value: string | null) {
  try {
    if (value == null || value === "") localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* navigation privée : tant pis, le thème s'applique quand même */ }
}

/** Applique un thème à la page, tout de suite. */
export function applyTheme(theme: SiteTheme) {
  const css = themeToCss(theme);
  const fonts = themeFontsUrl(theme);
  let style = document.getElementById("lb-theme") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "lb-theme";
  }
  style.textContent = css;
  document.head.appendChild(style); // toujours en dernier : il passe devant le reste
  let link = document.getElementById("lb-theme-fonts") as HTMLLinkElement | null;
  if (fonts) {
    if (!link) {
      link = document.createElement("link");
      link.id = "lb-theme-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== fonts) link.href = fonts;
  } else link?.remove();
  put(K.css, css);
  put(K.fonts, fonts);
  setEdits(theme.edits);
}

export function cachedPublished(): SiteTheme {
  try { return sanitizeTheme(JSON.parse(get(K.published) ?? "null")) ?? EMPTY_THEME; } catch { return EMPTY_THEME; }
}

/** Thème publié sur le serveur (null si injoignable). */
export async function fetchPublished(): Promise<{ theme: SiteTheme; updatedAt: number | null } | null> {
  try {
    const res = await fetch(serverHttpUrl("/theme"), { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { theme?: unknown; updatedAt?: number | null };
    const theme = sanitizeTheme(data.theme) ?? EMPTY_THEME;
    put(K.published, JSON.stringify(theme));
    return { theme, updatedAt: data.updatedAt ?? null };
  } catch {
    return null;
  }
}

export async function publishTheme(theme: SiteTheme): Promise<{ ok: true; updatedAt: number | null } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(serverHttpUrl("/theme"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });
    if (res.ok) {
      put(K.published, JSON.stringify(theme));
      const data = (await res.json().catch(() => ({}))) as { updatedAt?: number | null };
      return { ok: true, updatedAt: data.updatedAt ?? null };
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, status: res.status, error: data.error ?? "Publication impossible." };
  } catch {
    return { ok: false, status: 0, error: "Serveur de jeu injoignable." };
  }
}

/**
 * L'éditeur n'existe qu'en local : site lancé avec `npm run dev:web` et ouvert
 * sur ce PC (localhost). En ligne, il n'est même pas proposé — et le serveur
 * refuse de toute façon d'enregistrer quoi que ce soit.
 */
export function editorAllowedHere(): boolean {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return false;
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
}

export async function designLogin(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!editorAllowedHere()) return { ok: false, error: "L'éditeur ne marche qu'en local : ouvre http://localhost:3000/design sur ton PC." };
  try {
    const res = await fetch(serverHttpUrl("/theme/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (res.ok) {
      put(K.token, "local");
      return { ok: true };
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? "Connexion impossible." };
  } catch {
    return { ok: false, error: "Serveur de jeu injoignable." };
  }
}

export function designToken(): string | null {
  return editorAllowedHere() ? get(K.token) : null;
}
export function designLogout() {
  put(K.token, null);
}

/**
 * Brouillon de l'éditeur, lié à la version publiée sur laquelle il a été fait
 * (`base`) : si le design publié a changé entre-temps (push d'un nouveau
 * site-theme.json…), l'ancien brouillon n'est pas ré-appliqué par-dessus.
 */
export function loadDraft(base: number | null): SiteTheme | null {
  try {
    const raw = JSON.parse(get(K.draft) ?? "null") as { base?: unknown; theme?: unknown } | null;
    if (!raw || raw.base !== (base ?? 0)) return null;
    return sanitizeTheme(raw.theme);
  } catch { return null; }
}
export function hasDraft(): boolean {
  return !!get(K.draft);
}
export function saveDraft(theme: SiteTheme | null, base: number | null) {
  put(K.draft, theme ? JSON.stringify({ base: base ?? 0, theme }) : null);
}
