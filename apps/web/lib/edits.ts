// Applique les modifications de contenu (textes, liens, images, éléments
// ajoutés) sur la page, et les ré-applique quand React redessine.
// Les styles (cacher, déplacer, couleurs…) passent par le CSS du thème, qui
// cible l'attribut data-lbe posé ici sur chaque élément retrouvé.

import { routeKey, type SiteEdit } from "@subtitles-party/shared";

/** Éléments qui ne comptent pas dans les chemins (outils, scripts…). */
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "NOSCRIPT", "TEMPLATE", "NEXT-ROUTE-ANNOUNCER"]);
export function isTooling(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return true;
  const c = el.classList;
  return c.contains("lbe-added") || c.contains("lbd") || c.contains("lbd-fab") || c.contains("lbe-ui");
}

function contentChildren(el: Element): Element[] {
  const out: Element[] = [];
  for (const c of Array.from(el.children)) if (!isTooling(c)) out.push(c);
  return out;
}

/** Chemin stable d'un élément depuis <body> (sans compter nos ajouts). */
export function pathOf(el: Element): string | null {
  const segs: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body) {
    const parent: Element | null = cur.parentElement;
    if (!parent) return null;
    const i = contentChildren(parent).indexOf(cur);
    if (i < 0) return null;
    segs.unshift(`${cur.tagName.toLowerCase()}:nth-child(${i + 1})`);
    cur = parent;
  }
  return cur === document.body && segs.length ? segs.join(" > ") : null;
}

function resolvePath(path: string): Element | null {
  let cur: Element = document.body;
  for (const seg of path.split(" > ")) {
    const m = /^([a-z0-9-]+):nth-child\((\d+)\)$/.exec(seg);
    if (!m) return null;
    const next: Element | undefined = contentChildren(cur)[Number(m[2]) - 1];
    if (!next || next.tagName.toLowerCase() !== m[1]) return null;
    cur = next;
  }
  return cur;
}

// Texte d'origine des morceaux de texte qu'on a remplacés.
const original = new WeakMap<Text, string>();

/** Morceaux de texte « directs » d'un élément (ceux qu'on peut réécrire). */
export function textNodesOf(el: Element): Text[] {
  const out: Text[] = [];
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE && ((original.get(n as Text) ?? n.nodeValue ?? "").trim() || original.has(n as Text))) out.push(n as Text);
  }
  return out;
}
export function originalText(n: Text): string {
  return original.get(n) ?? n.nodeValue ?? "";
}

/**
 * Empreinte d'un élément, pour être sûr de retrouver le bon :
 * - son propre texte d'origine (« Joueurs » pour « Joueurs <span>3/8</span> ») ;
 * - sinon ses classes (« @flex items-center… ») ;
 * - sinon tout son texte (« #… ») ;
 * - sinon sa structure (« %button,img:brush.png,… ») : un bloc sans texte ni
 *   classe (barre d'outils, icône…) n'est plus confondu avec un autre bloc
 *   vide d'un autre écran.
 */
export function fingerprint(el: Element): string {
  if (el.tagName === "IMG") return "img:" + (el.getAttribute("data-lbe-src0") ?? el.getAttribute("src") ?? "").slice(0, 110);
  let own = "";
  for (const n of Array.from(el.childNodes)) if (n.nodeType === Node.TEXT_NODE) own += original.get(n as Text) ?? n.nodeValue ?? "";
  own = own.replace(/\s+/g, " ").trim();
  if (own) return own.slice(0, 120);
  const cls = (el.getAttribute("class") ?? "").replace(/\s+/g, " ").trim();
  if (cls) return ("@" + cls).slice(0, 120);
  let s = "";
  const walk = (n: Node) => {
    if (s.length > 160) return;
    if (n.nodeType === Node.TEXT_NODE) s += original.get(n as Text) ?? n.nodeValue ?? "";
    else if (n.nodeType === Node.ELEMENT_NODE && !isTooling(n as Element)) n.childNodes.forEach(walk);
  };
  el.childNodes.forEach(walk);
  const text = s.replace(/\s+/g, " ").trim();
  if (text) return ("#" + text).slice(0, 120);
  return ("%" + structureOf(el)).slice(0, 120);
}

/** Résumé de la structure d'un bloc sans texte (balises, images, tracés). */
function structureOf(el: Element): string {
  const parts: string[] = [el.tagName.toLowerCase()];
  const walk = (n: Element, depth: number) => {
    for (const c of Array.from(n.children)) {
      if (parts.length >= 14 || isTooling(c)) continue;
      let p = c.tagName.toLowerCase();
      if (c.tagName === "IMG") p += ":" + (c.getAttribute("data-lbe-src0") ?? c.getAttribute("src") ?? "").split("/").pop()?.split("?")[0];
      else if (c.tagName.toLowerCase() === "path") p += ":" + (c.getAttribute("d") ?? "").slice(0, 8);
      parts.push(p);
      if (depth < 3) walk(c, depth + 1);
    }
  };
  walk(el, 0);
  return parts.join(",");
}

/** Texte complet (pour les anciennes empreintes « # » vides). */
function deepText(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** L'élément correspond-il à l'empreinte enregistrée ? */
function fpMatches(el: Element, fp: string): boolean {
  if (!fp) return true;
  // Anciennes modifications : « # » seul = bloc sans aucun texte.
  if (fp === "#") return !deepText(el) && !(el.getAttribute("class") ?? "").trim() && !Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.nodeValue ?? "").trim());
  return fingerprint(el) === fp;
}

// --- Aperçu pendant un glisser (déplacer / redimensionner) -------------------
// On ne touche JAMAIS au style propre de l'élément (style="…" posé par React) :
// le retirer à la fin cassait la mise en page (ex. une barre d'outils en
// « display:flex » qui se retrouvait empilée). L'aperçu passe par une règle CSS
// temporaire, retirée à la fin du geste.
let previewEl: HTMLStyleElement | null = null;
export function setPreview(el: Element | null, css: string | null) {
  document.querySelectorAll("[data-lbe-preview]").forEach((x) => { if (x !== el || !css) x.removeAttribute("data-lbe-preview"); });
  if (!el || !css) {
    if (previewEl) previewEl.textContent = "";
    return;
  }
  if (!previewEl) {
    previewEl = document.createElement("style");
    previewEl.id = "lbe-preview";
  }
  if (previewEl.parentNode !== document.head || document.head.lastElementChild !== previewEl) document.head.appendChild(previewEl);
  el.setAttribute("data-lbe-preview", "");
  previewEl.textContent = `html body [data-lbe-preview]{${css}}`;
}

function tag(el: Element, id: string) {
  const cur = (el.getAttribute("data-lbe") ?? "").split(" ").filter(Boolean);
  if (!cur.includes(id)) el.setAttribute("data-lbe", [...cur, id].join(" "));
}
function untag(el: Element, id: string) {
  const cur = (el.getAttribute("data-lbe") ?? "").split(" ").filter((x) => x && x !== id);
  if (cur.length) el.setAttribute("data-lbe", cur.join(" "));
  else el.removeAttribute("data-lbe");
}

/** Retrouve l'élément visé par une modification sur la page actuelle. */
export function findTarget(e: SiteEdit): Element | null {
  const tagged = document.querySelector(`[data-lbe~="${e.id}"]:not(.lbe-added)`);
  if (tagged && pathOf(tagged) === e.path) return tagged;
  const el = resolvePath(e.path);
  if (el && el.tagName.toLowerCase() === e.tag && fpMatches(el, e.fp)) return el;
  // La page a bougé : on cherche le même élément (même balise, même empreinte) ailleurs.
  if (e.fp.length >= 3) {
    const probe = e.fp.startsWith("@") || e.fp.startsWith("img:") ? "" : e.fp.replace(/^#/, "").slice(0, 24);
    for (const cand of Array.from(document.body.getElementsByTagName(e.tag))) {
      if (isTooling(cand) || cand.closest(".lbd, .lbe-ui")) continue;
      if (probe && !(cand.textContent ?? "").includes(probe)) continue;
      if (fingerprint(cand) === e.fp) return cand;
    }
  }
  return null;
}

let edits: SiteEdit[] = [];
let observer: MutationObserver | null = null;
let scheduled = 0;
let applying = false;

export function setEdits(next: SiteEdit[]) {
  edits = next;
  start();
  schedule();
}

let lastRun = 0;
function schedule() {
  if (scheduled) return;
  // Au plus ~12 fois par seconde : les jeux redessinent souvent la page.
  const wait = Math.max(0, 80 - (performance.now() - lastRun));
  scheduled = window.setTimeout(() => {
    window.requestAnimationFrame(() => {
      scheduled = 0;
      lastRun = performance.now();
      applyNow();
    });
  }, wait);
}

function start() {
  if (observer || typeof window === "undefined") return;
  observer = new MutationObserver(() => { if (!applying) schedule(); });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  // Un lien modifié doit gagner sur la navigation de Next.js (<Link>).
  document.addEventListener("click", (ev) => {
    const a = (ev.target as Element | null)?.closest?.("a[data-lbe-href]");
    if (!a || document.documentElement.hasAttribute("data-lbe-picking")) return;
    ev.preventDefault();
    ev.stopPropagation();
    const href = a.getAttribute("data-lbe-href")!;
    if (a.getAttribute("target") === "_blank") window.open(href, "_blank", "noopener");
    else window.location.assign(href);
  }, true);
}

function makeAdded(e: SiteEdit): HTMLElement {
  const kind = e.add!.kind;
  const el =
    kind === "image" ? document.createElement("img")
    : kind === "button" ? document.createElement("a")
    : kind === "title" ? document.createElement("h2")
    : document.createElement("p");
  el.className = kind === "button" ? "lbe-added arc arc-p" : "lbe-added";
  el.setAttribute("data-kind", kind);
  el.setAttribute("data-lbe", e.id);
  return el;
}

function fillAdded(el: HTMLElement, e: SiteEdit) {
  const kind = e.add!.kind;
  if (kind === "image") {
    const src = e.src ?? "";
    if (el.getAttribute("src") !== src) el.setAttribute("src", src);
    const alt = e.texts?.[0] ?? "";
    if (el.getAttribute("alt") !== alt) el.setAttribute("alt", alt);
    return;
  }
  const text = e.texts?.[0] ?? (kind === "button" ? "Nouveau bouton" : kind === "title" ? "Nouveau titre" : "Nouveau texte");
  if (el.textContent !== text) el.textContent = text;
  if (kind === "button") {
    const href = e.href ?? "/";
    if (el.getAttribute("href") !== href) el.setAttribute("href", href);
  }
}

/** Applique tout ce qui concerne la page actuelle. */
export function applyNow() {
  if (typeof document === "undefined") return;
  if (!edits.length && !document.querySelector("[data-lbe]")) return;
  applying = true;
  try {
    const route = routeKey(window.location.pathname);
    const active = new Set<string>();
    for (const e of edits) {
      if (e.route !== "*" && e.route !== route) continue;
      const target = findTarget(e);
      if (e.add) {
        let el = document.querySelector<HTMLElement>(`.lbe-added[data-lbe="${e.id}"]`);
        if (!target) { el?.remove(); continue; }
        active.add(e.id);
        if (!el || el.getAttribute("data-kind") !== e.add.kind) { el?.remove(); el = makeAdded(e); }
        // Placé juste avant / après son ancre, à la suite de nos autres ajouts.
        if (e.add.where === "after") {
          if (!isAfterAddedChain(target, el)) lastOfChain(target, "next").after(el);
        } else if (!isBeforeAddedChain(target, el)) lastOfChain(target, "prev").before(el);
        fillAdded(el, e);
        continue;
      }
      if (!target) continue;
      active.add(e.id);
      tag(target, e.id);
      if (e.texts) {
        const nodes = textNodesOf(target);
        e.texts.forEach((t, i) => {
          const n = nodes[i];
          if (!n || t === null) return;
          if (!original.has(n)) original.set(n, n.nodeValue ?? "");
          if (n.nodeValue !== t) n.nodeValue = t;
        });
      }
      if (e.href !== undefined && target.tagName === "A") {
        if (!target.hasAttribute("data-lbe-href0")) target.setAttribute("data-lbe-href0", target.getAttribute("href") ?? "");
        if (target.getAttribute("data-lbe-href") !== e.href) target.setAttribute("data-lbe-href", e.href);
        if (target.getAttribute("href") !== e.href) target.setAttribute("href", e.href);
      }
      if (e.src !== undefined && target.tagName === "IMG") {
        if (!target.hasAttribute("data-lbe-src0")) target.setAttribute("data-lbe-src0", target.getAttribute("src") ?? "");
        if (target.getAttribute("src") !== e.src) { target.removeAttribute("srcset"); target.setAttribute("src", e.src); }
      }
    }
    // Ce qui n'est plus d'actualité : on retire nos traces.
    document.querySelectorAll<HTMLElement>(".lbe-added").forEach((el) => {
      if (!active.has(el.getAttribute("data-lbe") ?? "")) el.remove();
    });
    document.querySelectorAll("[data-lbe]:not(.lbe-added)").forEach((el) => {
      for (const id of (el.getAttribute("data-lbe") ?? "").split(" ")) {
        if (id && !active.has(id)) restore(el, id);
      }
    });
  } finally {
    // Laisse passer les notifications de nos propres changements.
    observer?.takeRecords();
    applying = false;
  }
}

function lastOfChain(anchor: Element, dir: "next" | "prev"): Element {
  let cur = anchor;
  for (;;) {
    const s = dir === "next" ? cur.nextElementSibling : cur.previousElementSibling;
    if (!s || !s.classList.contains("lbe-added")) return cur;
    cur = s;
  }
}
function isAfterAddedChain(anchor: Element, el: Element): boolean {
  let s = anchor.nextElementSibling;
  while (s && s.classList.contains("lbe-added")) { if (s === el) return true; s = s.nextElementSibling; }
  return false;
}
function isBeforeAddedChain(anchor: Element, el: Element): boolean {
  let s = anchor.previousElementSibling;
  while (s && s.classList.contains("lbe-added")) { if (s === el) return true; s = s.previousElementSibling; }
  return false;
}

/** Annule les effets d'une modification supprimée. */
function restore(el: Element, id: string) {
  untag(el, id);
  if (el.hasAttribute("data-lbe")) return; // une autre modification s'en occupe encore
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE && original.has(n as Text)) {
      n.nodeValue = original.get(n as Text)!;
      original.delete(n as Text);
    }
  }
  const href0 = el.getAttribute("data-lbe-href0");
  if (href0 !== null) { el.setAttribute("href", href0); el.removeAttribute("data-lbe-href0"); }
  el.removeAttribute("data-lbe-href");
  const src0 = el.getAttribute("data-lbe-src0");
  if (src0 !== null) { el.setAttribute("src", src0); el.removeAttribute("data-lbe-src0"); }
}
