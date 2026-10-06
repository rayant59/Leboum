// ---------------------------------------------------------------------------
// Bombe (BombParty) — dictionnaire & génération de syllabes.
//
// Le vrai dictionnaire français (~330k mots) est chargé par le SERVEUR au
// démarrage depuis motbombe/*.txt (exactement comme motdessin/ pour le dessin),
// puis injecté ici via `setBombeDictionary`. Le moteur (pur) ne fait que lire
// l'ensemble déjà chargé : aucune I/O, aucun réseau, testable seul.
//
// Si aucun fichier n'est présent, un petit dictionnaire de secours prend le
// relais pour que le jeu reste jouable en développement.
// ---------------------------------------------------------------------------

import { WORD_BANK } from "../draw/words";
import { tabooBank } from "../taboo/cards";

/** Normalise un mot : minuscules, sans accents, lettres a-z uniquement. */
export function bombeNormalize(s: string): string {
  return (typeof s === "string" ? s : s == null ? "" : String(s))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

// --- petit dictionnaire de secours (dev sans fichier) ----------------------
const FALLBACK_WORDS = [
  "arbre", "voiture", "canard", "gare", "guitare", "depart", "renard", "phare", "art", "part",
  "maison", "raison", "saison", "oiseau", "maïs", "pays", "essai", "balai", "travail", "email",
  "ordinateur", "amour", "toujours", "bonjour", "cours", "tour", "four", "jour", "velours", "secours",
  "ballon", "maison", "avion", "camion", "bouton", "mouton", "salon", "poisson", "boisson", "chanson",
  "fromage", "nuage", "village", "voyage", "image", "orage", "plage", "garage", "courage", "message",
  "dragon", "wagon", "citron", "flacon", "balcon", "faucon", "glacon", "flocon", "bacon", "cocon",
  "table", "sable", "cable", "fable", "diable", "capable", "aimable", "notable", "minable", "durable",
  "chat", "chien", "cheval", "chaise", "chocolat", "chance", "chaud", "chose", "marche", "bouche",
  "train", "brun", "trois", "droit", "fruit", "bruit", "gratter", "premier", "propre", "prendre",
  "porte", "sortir", "mortel", "cortege", "escorte", "confort", "effort", "sport", "porter", "reporter",
];

// --- état chargé -----------------------------------------------------------
let DICT = new Set<string>(FALLBACK_WORDS.map(bombeNormalize).filter(Boolean));
let LOADED_FROM_FILE = false;

// Index : pour chaque syllabe (2 & 3 lettres) → nombre de mots qui la contiennent.
let SYLL2 = new Map<string, number>();
let SYLL3 = new Map<string, number>();
// Bassins de syllabes réellement jouables (ni triviales, ni impossibles).
let POOL2: string[] = [];
let POOL3: string[] = [];

// Bandes de fréquence (nombre de mots contenant la syllabe).
// Réglé « plus facile » : on remonte le plancher (syllabes plus courantes,
// donc plus faciles) et le plafond (on autorise aussi les syllabes très
// courantes, les plus simples à compléter).
// Le dico contient toutes les formes conjuguées : un seuil bas laissait passer
// des paires très dures à l'oral (« XC », « LM », « SF »…) portées par une
// seule famille de verbes. 1500 garde ~195 syllabes à 2 lettres, toutes jouables.
const BAND2_MIN = 1500, BAND2_MAX = 40000; // 2 lettres : plus courantes = plus faciles
const BAND3_MIN = 600,  BAND3_MAX = 18000; // 3 lettres : uniquement les plus courantes

// Syllabes « qui se lisent bien » : on écarte les groupes de lettres durs ou
// bizarres à l'oral (« hl », « yh », « ffl », « ngr »…), même s'ils sont
// fréquents dans le dictionnaire (formes conjuguées).
const VOWELS = new Set("aeiouy".split(""));
/** Groupes de 2 consonnes faciles (début ou milieu de mots courants). */
const EASY_CLUSTERS = new Set([
  "ch", "ph", "th", "gn", "qu",
  "bl", "cl", "fl", "gl", "pl",
  "br", "cr", "dr", "fr", "gr", "pr", "tr", "vr",
  "st", "sp", "sc", "nt", "nd", "mp", "mb", "nc", "rt", "rd", "rs", "ct",
  "ll", "ss", "tt", "rr", "nn", "mm", "pp", "ff", "cc",
]);

export function isFriendlySyllable(syll: string): boolean {
  const s = bombeNormalize(syll);
  if (s.length < 2 || s.length > 3) return false;
  // Le « y » seulement au contact d'une voyelle (« ya », « oy »…), jamais « yh », « ty »…
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "y") continue;
    const near = [s[i - 1], s[i + 1]].filter(Boolean);
    if (!near.some((c) => "aeiou".includes(c))) return false;
  }
  // « h » muet seulement après c / p / t (ch, ph, th) ou devant une voyelle.
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "h") continue;
    const prev = s[i - 1], next = s[i + 1];
    if (prev && !"cpt".includes(prev) && !(next && VOWELS.has(next))) return false;
    if (!prev && next && !VOWELS.has(next)) return false;
  }
  if (!s.split("").some((c) => VOWELS.has(c))) {
    // Pas de voyelle : seulement un groupe facile de 2 lettres (jamais 3).
    return s.length === 2 && EASY_CLUSTERS.has(s);
  }
  // 2 lettres (« rp », « nv »…) ou début de 3 lettres (« nfi », « rba »…) :
  // pas de paire de consonnes difficile à lire.
  const head = s.slice(0, 2);
  if (!VOWELS.has(head[0]) && !VOWELS.has(head[1]) && !EASY_CLUSTERS.has(head)) return false;
  if (s.length === 2) return true;
  // 3 lettres : jamais trois consonnes (« ffl », « ngr », « chr »…).
  return s.split("").some((c) => VOWELS.has(c)) && !(/[^aeiouy]{3}/.test(s));
}

function buildIndex(): void {
  SYLL2 = new Map();
  SYLL3 = new Map();
  for (const w of DICT) {
    const seen2 = new Set<string>();
    const seen3 = new Set<string>();
    for (let i = 0; i + 2 <= w.length; i++) seen2.add(w.slice(i, i + 2));
    for (let i = 0; i + 3 <= w.length; i++) seen3.add(w.slice(i, i + 3));
    for (const s of seen2) SYLL2.set(s, (SYLL2.get(s) ?? 0) + 1);
    for (const s of seen3) SYLL3.set(s, (SYLL3.get(s) ?? 0) + 1);
  }
  POOL2 = [...SYLL2.entries()].filter(([k, v]) => v >= BAND2_MIN && v <= BAND2_MAX && isFriendlySyllable(k)).map(([k]) => k);
  POOL3 = [...SYLL3.entries()].filter(([k, v]) => v >= BAND3_MIN && v <= BAND3_MAX && isFriendlySyllable(k)).map(([k]) => k);
  // Sécurité : si le dico de secours est trop petit pour remplir une bande,
  // on relâche les seuils (mais jamais le filtre « se lit bien »).
  if (POOL2.length < 8) POOL2 = [...SYLL2.entries()].filter(([k, v]) => v >= 3 && isFriendlySyllable(k)).map(([k]) => k);
  if (POOL3.length < 8) POOL3 = [...SYLL3.entries()].filter(([k, v]) => v >= 2 && isFriendlySyllable(k)).map(([k]) => k);
}
buildIndex();

/**
 * Remplace le dictionnaire par les mots fournis (chargés d'un fichier par le
 * serveur). Reconstruit l'index des syllabes. Additif → non : on remplace,
 * comme setCustomWords pour le dessin.
 */
export function setBombeDictionary(words: string[]): void {
  const next = new Set<string>();
  for (const raw of words) {
    const w = bombeNormalize(raw);
    if (w.length >= 2) next.add(w);
  }
  if (next.size === 0) return; // fichier vide → on garde le secours
  DICT = next;
  LOADED_FROM_FILE = true;
  buildIndex();
}

export function bombeDictSize(): number {
  return DICT.size;
}
export function bombeLoadedFromFile(): boolean {
  return LOADED_FROM_FILE;
}

/** Le mot (déjà normalisé) existe-t-il dans le dictionnaire ? */
export function isBombeWord(normalized: string): boolean {
  return DICT.has(normalized);
}

/** Combien de mots du dico contiennent cette syllabe (pour l'aide/debug). */
export function bombeSyllableCount(syll: string): number {
  const s = bombeNormalize(syll);
  return (s.length === 3 ? SYLL3.get(s) : SYLL2.get(s)) ?? 0;
}

function pickFrom<T>(arr: T[], rng: () => number): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Tire une syllabe RÉELLEMENT jouable :
 *  - présente dans assez de mots (bande de fréquence) ;
 *  - de longueur comprise entre min et max lettres ;
 *  - différente des syllabes récentes (anti-répétition).
 * Le 2-lettres est privilégié (feeling BombParty classique).
 */
export function pickBombeSyllable(
  rng: () => number,
  opts?: { minLetters?: number; maxLetters?: number; exclude?: readonly string[] },
): string {
  const min = Math.max(2, Math.min(3, opts?.minLetters ?? 2));
  const max = Math.max(min, Math.min(3, opts?.maxLetters ?? 3));
  const recent = new Set((opts?.exclude ?? []).map(bombeNormalize));

  // Choix de la longueur : si les deux sont permises, ~88% de 2-lettres.
  // (Les 3-lettres sont les plus dures : on les tire rarement pour alléger.)
  let useThree: boolean;
  if (min === 3) useThree = true;
  else if (max === 2) useThree = false;
  else useThree = rng() < 0.12;

  const primary = useThree ? POOL3 : POOL2;
  const secondary = useThree ? POOL2 : POOL3;

  const tryPool = (pool: string[]): string | null => {
    const fresh = pool.filter((s) => !recent.has(s));
    const pick = pickFrom(fresh.length ? fresh : pool, rng);
    return pick;
  };

  const chosen = tryPool(primary) ?? tryPool(secondary) ?? pickFrom([...SYLL2.keys()].filter(isFriendlySyllable), rng) ?? "ar";
  return chosen;
}

/**
 * Quelques mots du dico contenant la syllabe — affichés pendant la pause
 * d'explosion pour « apprendre » des mots qu'on aurait pu jouer.
 * On privilégie des mots courts et lisibles (3 à 10 lettres).
 */
// Mots « de tous les jours » (banques des autres jeux + mots perso du dessin) :
// proposés en priorité comme exemples, car le grand dictionnaire ne dit pas
// quels mots sont courants.
const COMMON = new Map<string, string>(); // forme normalisée → forme affichée (avec accents)
/** Ajoute des mots courants (expressions découpées en mots). */
export function addBombeCommonWords(words: readonly string[]): void {
  for (const raw of words) {
    for (const part of String(raw).split(/[\s'’-]+/)) {
      const w = bombeNormalize(part);
      const shown = part.trim().toLowerCase();
      if (w.length >= 3 && !COMMON.has(w) && /^[a-zàâäçéèêëîïôöùûüÿœæ]+$/.test(shown)) COMMON.set(w, shown);
    }
  }
}
addBombeCommonWords(WORD_BANK.map((e) => e.word));
addBombeCommonWords(tabooBank().flatMap((c) => [c.word, ...c.forbidden]));

// Terminaisons de conjugaison / formes rares : on évite de les proposer en
// exemple (« déployasse », « bornoyant »…) au profit de mots de tous les jours.
const RARE_ENDINGS = /(asse|asses|assent|assiez|assions|ames|ates|erent|irent|urent|ussent|issent|ions|iez|aient|erai|eras|erons|erez|eront|erais|erait|eraient|irai|iras|irons|irez|iront|ant|ants|ait|ais|ats|ees|es|ez|ent|ent)$/;

/** Note de « banalité » d'un mot (plus bas = plus courant / plus lisible). */
function exampleRank(w: string): number {
  let r = 0;
  if (RARE_ENDINGS.test(w)) r += 3;
  else if (w.endsWith("s") || w.endsWith("x")) r += 1; // pluriel : correct mais moins parlant
  if (w.length < 4) r += 1;
  if (w.length > 8) r += w.length - 8;
  if (/[wkxyz]/.test(w.replace(/y/g, w.includes("y") ? "" : "y"))) r += 1;
  return r;
}

export function bombeExampleWords(
  syllable: string,
  count = 4,
  rng: () => number = Math.random,
  exclude: readonly string[] = [],
): string[] {
  const s = bombeNormalize(syllable);
  if (!s) return [];
  const skip = new Set(exclude.map(bombeNormalize));
  const matches: string[] = [];
  for (const w of DICT) {
    if (w.length < 3 || w.length > 10) continue;
    if (skip.has(w) || !w.includes(s)) continue;
    matches.push(w);
    if (matches.length >= 4000) break; // échantillon suffisant, on ne scanne pas tout
  }
  if (matches.length === 0 && COMMON.size === 0) return [];
  // 1) D'abord des mots courants (et valides dans le dictionnaire du jeu).
  const common = [...COMMON.entries()].filter(([w]) => w.includes(s) && !skip.has(w) && DICT.has(w)).map(([, shown]) => shown);
  const out0: string[] = [];
  const pickedCommon = new Set<number>();
  while (out0.length < Math.min(count, common.length)) {
    const idx = Math.floor(rng() * common.length);
    if (pickedCommon.has(idx)) continue;
    pickedCommon.add(idx);
    out0.push(common[idx]);
  }
  if (out0.length >= count || matches.length === 0) return out0;
  // 2) Complète avec les mots du dictionnaire les plus « banals » (meilleure note).
  const ranked = matches.map((w) => [w, exampleRank(w)] as const).sort((a, b) => a[1] - b[1]);
  const best = ranked[0][1];
  let pool = ranked.filter(([, r]) => r <= best).map(([w]) => w);
  if (pool.length < count) pool = ranked.slice(0, Math.max(count, Math.min(ranked.length, 40))).map(([w]) => w);
  const taken = new Set(out0.map(bombeNormalize));
  pool = pool.filter((w) => !taken.has(w));
  const out: string[] = [...out0];
  const used = new Set<number>();
  const n = Math.min(count, out0.length + pool.length);
  while (out.length < n && used.size < pool.length) {
    let idx = Math.floor(rng() * pool.length);
    let guard = 0;
    while (used.has(idx) && guard++ < 30) idx = Math.floor(rng() * pool.length);
    if (used.has(idx)) break;
    used.add(idx);
    out.push(pool[idx]);
  }
  return out;
}

/** Un mot proposé est-il valide pour cette syllabe (contient la syllabe + dico) ? */
export function bombeWordMatches(word: string, syllable: string): { ok: boolean; reason?: "empty" | "syllable" | "unknown" } {
  const w = bombeNormalize(word);
  const s = bombeNormalize(syllable);
  if (!w) return { ok: false, reason: "empty" };
  if (!w.includes(s)) return { ok: false, reason: "syllable" };
  if (!DICT.has(w)) return { ok: false, reason: "unknown" };
  return { ok: true };
}
