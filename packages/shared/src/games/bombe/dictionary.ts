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

/** Normalise un mot : minuscules, sans accents, lettres a-z uniquement. */
export function bombeNormalize(s: string): string {
  return (s || "")
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
const BAND2_MIN = 120,  BAND2_MAX = 12000; // 2 lettres : ~230 combis jouables
const BAND3_MIN = 30,   BAND3_MAX = 4000;  // 3 lettres : plus dur

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
  POOL2 = [...SYLL2.entries()].filter(([, v]) => v >= BAND2_MIN && v <= BAND2_MAX).map(([k]) => k);
  POOL3 = [...SYLL3.entries()].filter(([, v]) => v >= BAND3_MIN && v <= BAND3_MAX).map(([k]) => k);
  // Sécurité : si le dico de secours est trop petit pour remplir une bande,
  // on relâche les seuils pour ne jamais tomber sur un bassin vide.
  if (POOL2.length < 8) POOL2 = [...SYLL2.entries()].filter(([, v]) => v >= 3).map(([k]) => k);
  if (POOL3.length < 8) POOL3 = [...SYLL3.entries()].filter(([, v]) => v >= 2).map(([k]) => k);
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

  // Choix de la longueur : si les deux sont permises, 70% de 2-lettres.
  let useThree: boolean;
  if (min === 3) useThree = true;
  else if (max === 2) useThree = false;
  else useThree = rng() < 0.3;

  const primary = useThree ? POOL3 : POOL2;
  const secondary = useThree ? POOL2 : POOL3;

  const tryPool = (pool: string[]): string | null => {
    const fresh = pool.filter((s) => !recent.has(s));
    const pick = pickFrom(fresh.length ? fresh : pool, rng);
    return pick;
  };

  const chosen = tryPool(primary) ?? tryPool(secondary) ?? pickFrom([...SYLL2.keys()], rng) ?? "ar";
  return chosen;
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
