// ---------------------------------------------------------------------------
// Thème du site — modifiable en direct depuis l'éditeur de design (/design).
//
// Le site lit toutes ses couleurs dans des variables CSS `--c-<nom>` (valeurs
// « R G B »). Un thème ne stocke que ce qui diffère des valeurs par défaut :
// couleurs, polices et un bloc de CSS libre. Le serveur de jeu le garde dans
// un fichier (THEME_FILE) et le sert à tous les visiteurs (GET /theme).
// ---------------------------------------------------------------------------

import { editsToCss, sanitizeEdits, type SiteEdit } from "./edits";

export type ThemeColorGroup = "Fonds" | "Textes" | "Accents" | "Reliefs des boutons";

export interface ThemeColorToken {
  name: string;
  label: string;
  group: ThemeColorGroup;
  /** Valeur d'origine, en hexadécimal. */
  hex: string;
  hint?: string;
  /** Couleur « relief » calculée automatiquement à partir d'une autre. */
  shadeOf?: string;
}

export const THEME_COLORS: readonly ThemeColorToken[] = [
  { name: "ink", label: "Fond de page", group: "Fonds", hex: "#14102A", hint: "Le fond principal du site." },
  { name: "ink-deep", label: "Fond profond", group: "Fonds", hex: "#0E0B1A", hint: "Champs de saisie, zones creusées, texte sur bouton doré." },
  { name: "ink-surface", label: "Cartes", group: "Fonds", hex: "#1C1636", hint: "Fond des cartes et panneaux." },
  { name: "ink-raised", label: "Cartes en relief", group: "Fonds", hex: "#251C45", hint: "Haut des panneaux, éléments survolés." },
  { name: "ink-border", label: "Bordures", group: "Fonds", hex: "#332A5A", hint: "Contours des cartes et séparateurs." },
  { name: "text", label: "Texte", group: "Textes", hex: "#F3EEFF" },
  { name: "text-muted", label: "Texte secondaire", group: "Textes", hex: "#A79FC7" },
  { name: "text-faint", label: "Texte discret", group: "Textes", hex: "#6E6796", hint: "Petites étiquettes, indices." },
  { name: "gold", label: "Doré (accent principal)", group: "Accents", hex: "#FFC24B", hint: "Boutons principaux, titres, focus." },
  { name: "magenta", label: "Rose", group: "Accents", hex: "#FF4D8D" },
  { name: "mint", label: "Menthe (prêt / validé)", group: "Accents", hex: "#46E0B0" },
  { name: "violet", label: "Violet", group: "Accents", hex: "#8B7DF6" },
  { name: "cyan", label: "Cyan", group: "Accents", hex: "#4CC9F0" },
  { name: "orange", label: "Orange", group: "Accents", hex: "#FF6B4D" },
  { name: "danger", label: "Erreur", group: "Accents", hex: "#FF5C5C" },
  { name: "gold-dark", label: "Relief doré", group: "Reliefs des boutons", hex: "#B47F16", shadeOf: "gold" },
  { name: "magenta-dark", label: "Relief rose", group: "Reliefs des boutons", hex: "#A1315F", shadeOf: "magenta" },
  { name: "mint-dark", label: "Relief menthe", group: "Reliefs des boutons", hex: "#1E8F65", shadeOf: "mint" },
];

export interface ThemeFont {
  /** Nom Google Fonts (ex. « Space Grotesk »). */
  family: string;
  /** Graisses chargées (Google Fonts css2), ex. « 400;700 ». Vide = une seule. */
  weights: string;
}

export type ThemeFontRole = "display" | "body" | "mono";

export const THEME_FONT_ROLES: readonly { role: ThemeFontRole; label: string; fallback: string }[] = [
  { role: "display", label: "Titres et boutons", fallback: "system-ui, sans-serif" },
  { role: "body", label: "Texte courant", fallback: "system-ui, sans-serif" },
  { role: "mono", label: "Étiquettes (mono)", fallback: "ui-monospace, monospace" },
];

const W5 = "400;500;600;700;800";
export const THEME_FONTS: readonly ThemeFont[] = [
  { family: "Bricolage Grotesque", weights: W5 },
  { family: "Poppins", weights: W5 },
  { family: "Montserrat", weights: W5 },
  { family: "Outfit", weights: W5 },
  { family: "Sora", weights: W5 },
  { family: "Space Grotesk", weights: "400;500;600;700" },
  { family: "Syne", weights: W5 },
  { family: "Unbounded", weights: W5 },
  { family: "Fredoka", weights: "400;500;600;700" },
  { family: "Baloo 2", weights: W5 },
  { family: "Rubik", weights: W5 },
  { family: "Nunito", weights: W5 },
  { family: "Quicksand", weights: "400;500;600;700" },
  { family: "Comfortaa", weights: "400;500;600;700" },
  { family: "DM Sans", weights: W5 },
  { family: "Manrope", weights: W5 },
  { family: "Inter", weights: W5 },
  { family: "Lexend", weights: W5 },
  { family: "Chakra Petch", weights: "400;500;600;700" },
  { family: "Righteous", weights: "" },
  { family: "Bungee", weights: "" },
  { family: "Lilita One", weights: "" },
  { family: "Archivo Black", weights: "" },
  { family: "Bebas Neue", weights: "" },
  { family: "Pacifico", weights: "" },
  { family: "Press Start 2P", weights: "" },
  { family: "Space Mono", weights: "400;700" },
  { family: "JetBrains Mono", weights: "400;500;700" },
  { family: "IBM Plex Mono", weights: "400;500;700" },
  { family: "Fira Code", weights: "400;500;700" },
  { family: "DM Mono", weights: "400;500" },
];

export interface SiteTheme {
  v: 1;
  /** Nom de couleur → « #RRGGBB ». Absent = valeur d'origine. */
  colors: Record<string, string>;
  /** Rôle → famille de THEME_FONTS. Absent = police d'origine. */
  fonts: Partial<Record<ThemeFontRole, string>>;
  /** CSS libre ajouté à la fin de la page (pour tout le reste). */
  css: string;
  /** Textes, éléments cachés / déplacés / ajoutés à la souris (voir edits.ts). */
  edits: SiteEdit[];
}

export const EMPTY_THEME: SiteTheme = { v: 1, colors: {}, fonts: {}, css: "", edits: [] };
export const THEME_CSS_MAX = 20_000;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Nettoie un thème venu de l'extérieur. Renvoie null s'il est inutilisable. */
export function sanitizeTheme(input: unknown): SiteTheme | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const colors: Record<string, string> = {};
  if (raw.colors && typeof raw.colors === "object") {
    for (const t of THEME_COLORS) {
      const v = (raw.colors as Record<string, unknown>)[t.name];
      if (typeof v === "string" && HEX.test(v)) colors[t.name] = v.toUpperCase();
    }
  }
  const fonts: SiteTheme["fonts"] = {};
  if (raw.fonts && typeof raw.fonts === "object") {
    for (const { role } of THEME_FONT_ROLES) {
      const v = (raw.fonts as Record<string, unknown>)[role];
      if (typeof v === "string" && THEME_FONTS.some((f) => f.family === v)) fonts[role] = v;
    }
  }
  const css = typeof raw.css === "string" ? raw.css.slice(0, THEME_CSS_MAX) : "";
  return { v: 1, colors, fonts, css, edits: sanitizeEdits(raw.edits) };
}

export function hexToTriplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Feuille de style qui applique le thème (variables CSS + CSS libre). */
export function themeToCss(theme: SiteTheme): string {
  const vars = THEME_COLORS.filter((t) => theme.colors[t.name]).map((t) => `--c-${t.name}:${hexToTriplet(theme.colors[t.name])};`);
  const fonts = THEME_FONT_ROLES.filter((r) => theme.fonts[r.role]).map((r) => `--font-${r.role}:'${theme.fonts[r.role]}',${r.fallback};`);
  let out = "";
  // html:root : passe devant les valeurs d'origine quel que soit l'ordre des feuilles.
  if (vars.length) out += `html:root{${vars.join("")}}\n`;
  // Les polices d'origine sont posées sur <html> par Next.js : on les remplace
  // sur <body>, ce qui couvre toute la page.
  if (fonts.length) out += `body{${fonts.join("")}}\n`;
  const edits = editsToCss(theme.edits);
  if (edits) out += `/* Éléments modifiés à la souris */\n${edits}\n`;
  if (theme.css.trim()) out += `/* CSS libre */\n${theme.css}\n`;
  return out;
}

/** Adresse Google Fonts des polices choisies (null si aucune). */
export function themeFontsUrl(theme: SiteTheme): string | null {
  const fams = [...new Set(Object.values(theme.fonts))].map((name) => THEME_FONTS.find((f) => f.family === name)).filter((f): f is ThemeFont => !!f);
  if (!fams.length) return null;
  const q = fams.map((f) => `family=${f.family.replace(/ /g, "+")}${f.weights ? `:wght@${f.weights}` : ""}`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

// --- Petits outils de couleur (éditeur) -------------------------------------

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Assombrit une couleur (0 → identique, 1 → noir). */
export function darken(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex);
  return toHex([r * (1 - amount), g * (1 - amount), b * (1 - amount)]);
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = rgb(hex).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Couleur effective d'un thème (sa valeur, sinon celle d'origine). */
export function themeColor(theme: SiteTheme, name: string): string {
  return theme.colors[name] ?? THEME_COLORS.find((t) => t.name === name)?.hex ?? "#000000";
}

/** Thèmes tout prêts proposés dans l'éditeur. */
export const THEME_PRESETS: readonly { name: string; colors: Record<string, string> }[] = [
  { name: "Boum (origine)", colors: {} },
  {
    name: "Néon",
    colors: { ink: "#0A0A14", "ink-deep": "#05050B", "ink-surface": "#12121F", "ink-raised": "#1B1B2E", "ink-border": "#2A2A45", text: "#F2F4FF", "text-muted": "#9EA3C7", "text-faint": "#646A94", gold: "#39FF88", "gold-dark": "#1F9A52", magenta: "#FF2BD6", "magenta-dark": "#9C1A83", mint: "#2BF0FF", "mint-dark": "#19909A" },
  },
  {
    name: "Océan",
    colors: { ink: "#0B1A2A", "ink-deep": "#06111C", "ink-surface": "#112538", "ink-raised": "#173049", "ink-border": "#24425F", text: "#EAF6FF", "text-muted": "#9DB8CF", "text-faint": "#62809B", gold: "#FFD166", "gold-dark": "#B38A2E", magenta: "#EF476F", "magenta-dark": "#A12C4A", mint: "#06D6A0", "mint-dark": "#03936D" },
  },
  {
    name: "Coucher de soleil",
    colors: { ink: "#1E0F1C", "ink-deep": "#140A13", "ink-surface": "#2A1527", "ink-raised": "#371C33", "ink-border": "#4D2A47", text: "#FFF1EA", "text-muted": "#D2A9B4", "text-faint": "#94697A", gold: "#FF9F43", "gold-dark": "#B3672A", magenta: "#FF4F79", "magenta-dark": "#A9304F", mint: "#7BE0AD", "mint-dark": "#3E9A6E" },
  },
  {
    name: "Forêt",
    colors: { ink: "#0F1A14", "ink-deep": "#09110C", "ink-surface": "#15241B", "ink-raised": "#1C3024", "ink-border": "#2B4636", text: "#EEF7EF", "text-muted": "#A3BFA9", "text-faint": "#6A8A72", gold: "#E9C46A", "gold-dark": "#A1832F", magenta: "#F4845F", "magenta-dark": "#A9553A", mint: "#8FE388", "mint-dark": "#4E9A49" },
  },
];
