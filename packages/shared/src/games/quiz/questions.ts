// Quiz question bank.
//
// ARCHITECTURE (voulue) — on sépare bien :
//   1. question   2. category (le SUJET: anime, foot, memes…)   3. format
//   4. answer     5. aliases   6. difficulty   7. image + source   8. métadonnées
//
// "Quiz" / "Reconnaissance" / "Pixel" sont des FORMATS, pas des catégories :
// une question de n'importe quelle catégorie peut être jouée dans n'importe
// quel format (à condition d'avoir une image pour les formats visuels).

export type QuizType = "mcq" | "truefalse" | "free";
/** Facile → connaissance de niche → question improbable mais avec une vraie réponse. */
export type QuizDifficulty = "easy" | "medium" | "hard" | "expert" | "wtf";
/** Le format de jeu dans lequel une entrée peut tomber. */
export type QuizFormat = "quiz" | "recognition" | "pixel";

interface Base {
  id: string;
  type: QuizType;
  cat: string;
  prompt: string;
  // Optional metadata (safe to add — engine only projects id/type/cat/prompt/choices).
  difficulty?: QuizDifficulty;
  franchise?: string; // œuvre/univers, used by the anti-repetition picker
  subcat?: string;
  tags?: string[];
  /** Formats where this entry can appear. Defaults to text quiz only. */
  formats?: QuizFormat[];
  /** Visual formats: image + provenance (kept so sources can be credited). */
  imageUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  author?: string;
  license?: string;
}
export interface MCQQuestion extends Base { type: "mcq"; choices: string[]; answer: number }
export interface TFQuestion extends Base { type: "truefalse"; answer: boolean }
export interface FreeQuestion extends Base { type: "free"; answer: string; aliases?: string[] }
export type Question = MCQQuestion | TFQuestion | FreeQuestion;

/** Normalize a free-text answer: lowercase, strip accents/punctuation, collapse spaces. */
export function normalizeAnswer(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function freeAnswerMatches(given: string, q: FreeQuestion): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  const targets = [q.answer, ...(q.aliases ?? [])].map(normalizeAnswer);
  return targets.includes(g);
}

// Custom questions provided by the host via questionquizz/questions.txt (loaded
// by the server at startup). They are ADDED to the built-in bank (never replace).
let CUSTOM_QUESTIONS: Question[] = [];
export function addCustomQuestions(qs: Question[]): void {
  const seen = new Set(QUIZ_BANK.map((q) => q.id));
  const add: Question[] = [];
  for (const q of qs) {
    if (!q || seen.has(q.id)) continue;
    seen.add(q.id);
    add.push(q);
  }
  CUSTOM_QUESTIONS = add;
}
export function customQuestionCount(): number {
  return CUSTOM_QUESTIONS.length;
}

/**
 * Parse a plain-text custom-question file into free-answer questions.
 * One question per line, format:
 *     Question ? = réponse | alias1 | alias2
 * Lines that are empty, start with '#', or have no '=' are ignored.
 */
export function parseCustomQuestions(text: string): Question[] {
  const out: Question[] = [];
  const lines = (text || "").split(/\r?\n/);
  let n = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue; // no answer → skip
    const prompt = line.slice(0, eq).trim();
    const rest = line.slice(eq + 1).trim();
    if (!prompt || !rest) continue;
    const parts = rest.split("|").map((p) => p.trim()).filter(Boolean);
    const answer = parts[0];
    const aliases = parts.slice(1);
    n += 1;
    out.push({ id: `cq${n}`, type: "free", cat: "Perso", prompt, answer, aliases, difficulty: "medium" });
  }
  return out;
}

// prettier-ignore
export const QUIZ_BANK: Question[] = [
  // ═══════════════════════════════════════════════════════════════════════
  //  BANQUE VIDE — VOULU.
  //  Les questions viennent EXCLUSIVEMENT du dossier questionquizz/
  //  (fichier .txt à la racine du projet), au format :
  //      Question ? = réponse | alias1 | alias2
  //  → Pour ajouter du contenu : édite ce fichier, aucun code à toucher.
  // ═══════════════════════════════════════════════════════════════════════
];

/** Pick `count` distinct questions at random, categories mixed. */
/** Première "forme" de la question (Qui / Dans quel / Quelle marque…), utilisée
 *  pour éviter d'enchaîner deux questions formulées pareil. */
function promptShape(q: Question): string {
  return normalizeAnswer(q.prompt).split(" ").slice(0, 3).join(" ");
}

function answerText(q: Question): string {
  if (q.type === "free") return normalizeAnswer(q.answer);
  if (q.type === "mcq") return normalizeAnswer(q.choices[q.answer] ?? "");
  return String(q.answer);
}

/**
 * "Pop sauce" picker: shuffle, then greedily interleave so consecutive
 * questions never share a category, franchise, answer or phrasing — and so a
 * franchise/category can't come back too soon (spacing window).
 */
export function pickQuestions(count: number, rng: () => number = Math.random, types?: QuizType[]): Question[] {
  let pool = CUSTOM_QUESTIONS.length ? [...QUIZ_BANK, ...CUSTOM_QUESTIONS] : QUIZ_BANK;
  if (types && types.length) {
    const set = new Set(types);
    const f = pool.filter((q) => set.has(q.type));
    if (f.length >= Math.min(count, 4)) pool = f;
  }
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const want = Math.max(1, Math.min(count, shuffled.length));
  const remaining = [...shuffled];
  const out: Question[] = [];
  // How far back we look before allowing the same category/franchise again.
  const span = Math.max(2, Math.min(4, Math.floor(want / 3)));

  while (out.length < want && remaining.length) {
    const recent = out.slice(-span);
    const prev = out[out.length - 1];
    // Try strict rules first, then relax progressively so we never dead-end.
    const tiers: ((q: Question) => boolean)[] = [
      (q) =>
        !recent.some((r) => r.cat === q.cat) &&
        !(q.franchise && recent.some((r) => r.franchise === q.franchise)) &&
        !recent.some((r) => answerText(r) === answerText(q)) &&
        !recent.some((r) => promptShape(r) === promptShape(q)),
      (q) =>
        !prev ||
        (prev.cat !== q.cat &&
          !(q.franchise && prev.franchise === q.franchise) &&
          promptShape(prev) !== promptShape(q)),
      (q) => !prev || prev.cat !== q.cat,
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
