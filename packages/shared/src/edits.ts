// ---------------------------------------------------------------------------
// Modifications de contenu faites à la souris dans l'éditeur (/design) :
// changer un texte, un lien ou une image, cacher, déplacer, restyler un
// élément, ou en ajouter un nouveau à côté d'un élément existant.
//
// Un élément est retrouvé par son chemin depuis <body> (« div:nth-child(2) >
// h1:nth-child(1) ») ET son empreinte (son texte d'origine) : si la page
// change de forme, une modification ne s'applique jamais au mauvais élément.
// ---------------------------------------------------------------------------

export interface EditStyle {
  color?: string;
  background?: string;
  /** px */
  fontSize?: number;
  fontWeight?: number;
  textAlign?: "left" | "center" | "right";
  /** px, sur les 4 côtés */
  padding?: number;
  margin?: number;
  radius?: number;
  /** 0 à 100 */
  opacity?: number;
  /** Décalage en px (déplacement à la souris). */
  x?: number;
  y?: number;
  hidden?: boolean;
  /** Élément « en ligne » déplacé : passé en inline-block pour pouvoir bouger. */
  inline?: boolean;
  /** Taille imposée (px), réglée avec les poignées. */
  width?: number;
  height?: number;
}

export type AddedKind = "text" | "title" | "button" | "image";

export interface SiteEdit {
  id: string;
  /** Page : « / », « /room/* »… ou « * » pour toutes les pages. */
  route: string;
  /** Chemin de l'élément (ou de l'élément d'ancrage pour un ajout). */
  path: string;
  tag: string;
  /** Empreinte : texte d'origine de l'élément (120 caractères max). */
  fp: string;
  /** Nouveaux textes, dans l'ordre des morceaux de texte de l'élément (null = inchangé). */
  texts?: (string | null)[];
  href?: string;
  src?: string;
  style?: EditStyle;
  /** Présent = élément AJOUTÉ, placé avant/après l'élément d'ancrage. */
  add?: { kind: AddedKind; where: "before" | "after" };
}

export const EDITS_MAX = 400;
const ID = /^[a-z0-9]{4,16}$/;
const ROUTE = /^(\*|\/[\w\-/*]{0,80})$/;
const SEG = "[a-z][a-z0-9-]{0,30}:nth-child\\(\\d{1,4}\\)";
const PATH = new RegExp(`^${SEG}( > ${SEG}){0,60}$`);
const TAG = /^[a-z][a-z0-9-]{0,30}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const HREF = /^(https?:\/\/|\/|#|mailto:)[^\s"'<>\\]*$/;
const SRC = /^(https?:\/\/|\/)[^\s"'<>\\]*$/;
const KINDS: AddedKind[] = ["text", "title", "button", "image"];

const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(max, Math.max(min, v))) : undefined;

function sanitizeStyle(raw: unknown): EditStyle | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const s: EditStyle = {};
  if (typeof r.color === "string" && HEX.test(r.color)) s.color = r.color.toUpperCase();
  if (typeof r.background === "string" && HEX.test(r.background)) s.background = r.background.toUpperCase();
  s.fontSize = num(r.fontSize, 6, 200);
  s.fontWeight = num(r.fontWeight, 100, 900);
  if (r.textAlign === "left" || r.textAlign === "center" || r.textAlign === "right") s.textAlign = r.textAlign;
  s.padding = num(r.padding, 0, 200);
  s.margin = num(r.margin, -200, 200);
  s.radius = num(r.radius, 0, 999);
  s.opacity = num(r.opacity, 0, 100);
  s.x = num(r.x, -3000, 3000);
  s.y = num(r.y, -3000, 3000);
  s.width = num(r.width, 1, 4000);
  s.height = num(r.height, 1, 4000);
  if (r.hidden === true) s.hidden = true;
  if (r.inline === true && (s.x || s.y)) s.inline = true;
  for (const k of Object.keys(s) as (keyof EditStyle)[]) if (s[k] === undefined) delete s[k];
  return Object.keys(s).length ? s : undefined;
}

export function sanitizeEdit(raw: unknown): SiteEdit | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !ID.test(r.id)) return null;
  if (typeof r.route !== "string" || !ROUTE.test(r.route)) return null;
  if (typeof r.path !== "string" || !PATH.test(r.path)) return null;
  if (typeof r.tag !== "string" || !TAG.test(r.tag)) return null;
  const e: SiteEdit = { id: r.id, route: r.route, path: r.path, tag: r.tag, fp: typeof r.fp === "string" ? r.fp.slice(0, 120) : "" };
  if (Array.isArray(r.texts)) {
    e.texts = r.texts.slice(0, 20).map((t) => (typeof t === "string" ? t.slice(0, 2000) : null));
    if (!e.texts.some((t) => t !== null)) delete e.texts;
  }
  if (typeof r.href === "string" && r.href.length <= 500 && HREF.test(r.href)) e.href = r.href;
  if (typeof r.src === "string" && r.src.length <= 1000 && SRC.test(r.src)) e.src = r.src;
  const style = sanitizeStyle(r.style);
  if (style) e.style = style;
  if (r.add && typeof r.add === "object") {
    const a = r.add as Record<string, unknown>;
    if (!KINDS.includes(a.kind as AddedKind)) return null;
    e.add = { kind: a.kind as AddedKind, where: a.where === "before" ? "before" : "after" };
  }
  return e;
}

export function sanitizeEdits(raw: unknown): SiteEdit[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SiteEdit[] = [];
  for (const r of raw) {
    const e = sanitizeEdit(r);
    if (e && !seen.has(e.id)) { seen.add(e.id); out.push(e); }
    if (out.length >= EDITS_MAX) break;
  }
  return out;
}

/** Une modification est-elle vide (rien à appliquer) ? */
export function editIsEmpty(e: SiteEdit): boolean {
  return !e.add && !e.texts?.some((t) => t !== null) && !e.href && !e.src && !e.style;
}

/** Règles CSS des styles posés à la souris (ciblent [data-lbe~="id"]). */
export function editsToCss(edits: readonly SiteEdit[]): string {
  const rules: string[] = [];
  if (edits.some((e) => e.add)) {
    rules.push(
      ".lbe-added{display:block;box-sizing:border-box;max-width:100%}",
      ".lbe-added[data-kind=title]{font-family:var(--font-display),system-ui,sans-serif;font-weight:800;font-size:28px;line-height:1.15;color:rgb(var(--c-text))}",
      ".lbe-added[data-kind=text]{font-size:16px;line-height:1.55;color:rgb(var(--c-text-muted));white-space:pre-line}",
      "a.lbe-added[data-kind=button]{display:inline-flex;width:auto;text-decoration:none}",
      "img.lbe-added{height:auto;border-radius:12px}",
    );
  }
  for (const e of edits) {
    const s = e.style;
    if (!s) continue;
    const d: string[] = [];
    if (s.hidden) d.push("display:none");
    else if (s.inline && (s.x || s.y)) d.push("display:inline-block");
    if (s.color) d.push(`color:${s.color}`);
    if (s.background) d.push(`background:${s.background}`);
    if (s.fontSize != null) d.push(`font-size:${s.fontSize}px`);
    if (s.fontWeight != null) d.push(`font-weight:${s.fontWeight}`);
    if (s.textAlign) d.push(`text-align:${s.textAlign}`);
    if (s.padding != null) d.push(`padding:${s.padding}px`);
    if (s.margin != null) d.push(`margin:${s.margin}px`);
    if (s.radius != null) d.push(`border-radius:${s.radius}px`);
    if (s.opacity != null) d.push(`opacity:${s.opacity / 100}`);
    if (s.x || s.y) d.push(`translate:${s.x ?? 0}px ${s.y ?? 0}px`);
    if (s.width != null) d.push(`width:${s.width}px`, "max-width:none", "min-width:0", "box-sizing:border-box");
    if (s.height != null) d.push(`height:${s.height}px`, "max-height:none", "min-height:0", "box-sizing:border-box");
    if (d.length) rules.push(`[data-lbe~="${e.id}"]{${d.map((x) => x + " !important").join(";")}}`);
  }
  return rules.join("\n");
}

/** Clé de page d'une adresse : les salons partagent « /room/* ». */
export function routeKey(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (/^\/room\/[^/]+/.test(p)) return "/room/*";
  return p;
}

export function newEditId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}
