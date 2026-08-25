// Reconnaissance — content bank. Each entry references a REAL photo via a
// Wikipedia article subject (`wiki`, with an optional English fallback `wikiEn`).
// The actual image is resolved at runtime from the Wikimedia REST API
// (the article's lead image — a real, freely-licensed photograph) and shown with
// a source credit. No emojis, no generated placeholders.
//
// To add entries: pick a Wikipedia article whose lead image clearly depicts the
// answer, and set { wiki, question, answer, accepted, category }.

/**
 * Un sujet visuel. RECONNAISSANCE et PIXEL sont des FORMATS : n'importe quelle
 * catégorie (anime, foot, meme, voiture, monument…) peut y tomber.
 * L'image vient soit de Wikipédia (`wiki`), soit — et c'est préférable pour la
 * pop-culture — d'un fichier local déposé dans public/reco/ (`img`).
 */
export interface RecoItem {
  id: string;
  wiki: string; // fr.wikipedia article title whose lead image depicts the answer
  wikiEn?: string; // english fallback title (if the fr article lacks a good image)
  question: string;
  answer: string;
  accepted?: string[];
  category: string; // le SUJET (Anime, Sport, Marques…), pas le format
  // Optional metadata (safe to add).
  difficulty?: "easy" | "medium" | "hard" | "expert" | "wtf";
  franchise?: string; // œuvre/univers — used by the anti-repetition picker
  subcat?: string;
  /** Local image override: "/reco/mon-image.png" (fichier dans public/reco/). */
  img?: string;
  // Provenance de l'image (affichée/conservée pour créditer la source).
  sourceUrl?: string;
  sourceName?: string;
  author?: string;
  license?: string;
}

/** Normalize: lowercase, strip accents/punctuation, collapse spaces. */
export function recoNormalize(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein edit distance. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/** Accept if it matches an accepted variant after normalization, allowing a small
 *  length-scaled number of typos — but never a truly different word. */
export function recoAccepts(given: string, item: RecoItem): boolean {
  const g = recoNormalize(given);
  if (!g) return false;
  const targets = [item.answer, ...(item.accepted ?? [])].map(recoNormalize).filter(Boolean);
  for (const t of targets) {
    if (g === t) return true;
    const maxLen = Math.max(g.length, t.length);
    const tol = maxLen <= 4 ? 0 : maxLen <= 7 ? 1 : 2;
    if (tol > 0 && editDistance(g, t) <= tol) return true;
  }
  return false;
}

// prettier-ignore
export const RECO_BANK: RecoItem[] = [
  // ═══════════════════════════════════════════════════════════════════════
  //  BANQUE VIDE — VOULU.
  //  Les sujets ne viennent plus de Wikipédia : ils viennent EXCLUSIVEMENT
  //  des images déposées dans apps/web/public/reco/ et décrites dans
  //  images.txt (voir le README de ce dossier).
  //  → Pour ajouter du contenu : dépose tes images, pas de code à toucher.
  // ═══════════════════════════════════════════════════════════════════════
];

/** Pick `count` distinct items at random, categories mixed. */
// ── Sujets personnalisés (tes propres photos) ───────────────────────────────
// L'hôte dépose ses images dans apps/web/public/reco/ et décrit chacune dans
// un .txt du même dossier. Chargé par le serveur au démarrage, ADDITIF.
let CUSTOM_ITEMS: RecoItem[] = [];
export function addCustomRecoItems(items: RecoItem[]): void {
  const seen = new Set(RECO_BANK.map((i) => i.id));
  const add: RecoItem[] = [];
  for (const it of items) {
    if (!it || seen.has(it.id)) continue;
    seen.add(it.id);
    add.push(it);
  }
  CUSTOM_ITEMS = add;
}
export function customRecoCount(): number {
  return CUSTOM_ITEMS.length;
}

/**
 * Parse le manifeste des images perso. Une ligne par image :
 *     mon-image.png = Réponse | alias1 | alias2
 *     mon-image.png | Quelle marque ? = Réponse | alias
 *
 * On peut regrouper les images par CATÉGORIE avec une ligne de section :
 *     == Anime ==
 *     naruto.png = Naruto
 *     == Films ==
 *     titanic.png | Quel film ? = Titanic
 *
 * Lignes vides et lignes commençant par # ignorées.
 */
export function parseCustomRecoItems(text: string): RecoItem[] {
  const out: RecoItem[] = [];
  let n = 0;
  let currentCat = "Perso";
  for (const raw of (text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    // Section header:  == Catégorie ==   (or  [Catégorie])
    const section = line.match(/^==\s*(.+?)\s*==$/) || line.match(/^\[\s*(.+?)\s*\]$/);
    if (section) {
      currentCat = section[1].trim() || "Perso";
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const left = line.slice(0, eq).trim();
    const right = line.slice(eq + 1).trim();
    if (!left || !right) continue;
    const bar = left.indexOf("|");
    const file = (bar === -1 ? left : left.slice(0, bar)).trim();
    const question = bar === -1 ? "Qu'est-ce que c'est ?" : left.slice(bar + 1).trim();
    if (!file) continue;
    const parts = right.split("|").map((p) => p.trim()).filter(Boolean);
    n += 1;
    out.push({
      id: `cimg${n}`,
      wiki: "",
      question: question || "Qu'est-ce que c'est ?",
      answer: parts[0],
      accepted: parts.slice(1),
      category: currentCat,
      img: file.startsWith("/") ? file : `/reco/${file}`,
      sourceName: "Image locale",
    });
  }
  return out;
}

/** Toutes les catégories réellement présentes (pour l'écran de configuration). */
export function recoCategories(): string[] {
  return [...new Set(CUSTOM_ITEMS.map((i) => i.category))].sort();
}

function recoAnswerKey(it: RecoItem): string {
  return recoNormalize(it.answer);
}
function recoShape(it: RecoItem): string {
  return recoNormalize(it.question).split(" ").slice(0, 3).join(" ");
}

export function pickItems(count: number, rng: () => number = Math.random, category?: string): RecoItem[] {
  // Tous les sujets viennent des images perso (RECO_BANK est volontairement vide).
  let pool: RecoItem[] = CUSTOM_ITEMS.length ? [...RECO_BANK, ...CUSTOM_ITEMS] : RECO_BANK;
  if (category && category !== "all") {
    const f = pool.filter((q) => q.category === category);
    // An explicit choice is always honoured as soon as it has content.
    if (f.length > 0) pool = f;
  }
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const want = Math.max(1, Math.min(count, shuffled.length));
  const remaining = [...shuffled];
  const out: RecoItem[] = [];
  const span = Math.max(2, Math.min(4, Math.floor(want / 3)));

  while (out.length < want && remaining.length) {
    const recent = out.slice(-span);
    const prev = out[out.length - 1];
    const tiers: ((q: RecoItem) => boolean)[] = [
      (q) =>
        !recent.some((r) => r.category === q.category) &&
        !(q.franchise && recent.some((r) => r.franchise === q.franchise)) &&
        !recent.some((r) => recoAnswerKey(r) === recoAnswerKey(q)) &&
        !recent.some((r) => recoShape(r) === recoShape(q)),
      (q) =>
        !prev ||
        (prev.category !== q.category &&
          !(q.franchise && prev.franchise === q.franchise) &&
          recoShape(prev) !== recoShape(q)),
      (q) => !prev || prev.category !== q.category,
      () => true,
    ];
    let idx = -1;
    for (const ok of tiers) {
      idx = remaining.findIndex(ok);
      if (idx !== -1) break;
    }
    if (idx === -1) idx = 0;
    out.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return out;
}
