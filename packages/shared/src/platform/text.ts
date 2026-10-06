// Comparaison de mots tolérante, partagée par les jeux où l'on devine ou
// interdit des mots (Imposteur, Mot interdit…).
import { typoDistance } from "../room/util";

/** Minuscules, sans accents, œ → oe, ponctuation → espace, sans article en tête. */
export function normalizeWord(s: string): string {
  return (typeof s === "string" ? s : s == null ? "" : String(s))
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(le|la|les|l|un|une|des|du|de|d) /, "")
    .replace(/\s+/g, " ");
}

/** Bonne réponse ? Accents, articles, pluriel en -s/-x, et 1 faute dès 5 lettres. */
export function isWordGuess(guess: string, word: string): boolean {
  const g = normalizeWord(guess);
  const w = normalizeWord(word);
  if (!g || !w) return false;
  if (g === w) return true;
  const sing = (x: string) => x.replace(/[sx]$/, "");
  if (sing(g) === sing(w)) return true;
  return w.length >= 5 && typoDistance(g, w) <= 1;
}

/** Racine grossière d'un mot (pour attraper « danser » quand « danse » est interdit). */
function stem(x: string): string {
  return x.length >= 6 ? x.slice(0, x.length - 2) : x.replace(/[sx]$/, "");
}

/**
 * Premier mot interdit présent dans `text` (null sinon). Un terme d'un seul mot
 * est attrapé sous ses variantes (pluriel, conjugaison simple : « dents »,
 * « danser ») ; un terme de plusieurs mots doit apparaître tel quel.
 */
export function findForbidden(text: string, terms: string[]): string | null {
  const clue = normalizeWord(text);
  if (!clue) return null;
  const tokens = clue.split(" ");
  const padded = ` ${clue} `;
  for (const term of terms) {
    const f = normalizeWord(term);
    if (!f) continue;
    if (f.includes(" ")) {
      if (padded.includes(` ${f} `)) return term;
      continue;
    }
    const fs = stem(f);
    for (const t of tokens) {
      if (t === f || stem(t) === fs) return term;
      if (f.length >= 5 && t.length >= fs.length && t.startsWith(fs)) return term;
    }
  }
  return null;
}
