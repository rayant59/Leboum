// Word bank: each word carries a hidden theme (never shown unless the drawer
// chooses to reveal it). Words are drawn PURELY at random across the whole bank
// — no difficulty rating, no weighting, no balancing. A very simple word can be
// followed by a fiction character, an action, etc. Full randomness decides.

export interface WordEntry {
  word: string;
  theme: string;
}

// Optional custom words provided by the host via motdessin/mots.txt (loaded by
// the server at startup). When set & non-empty, they replace the built-in bank.
let CUSTOM_WORDS: WordEntry[] | null = null;
export function setCustomWords(words: string[]): void {
  const cleaned = [
    ...new Set(
      words
        .map((w) => w.trim())
        .filter((w) => w.length > 0 && !w.startsWith("#")),
    ),
  ];
  // Each custom word gets its own theme label so the "one word per theme"
  // picker treats them fairly (they mix in instead of collapsing to one).
  CUSTOM_WORDS = cleaned.length ? cleaned.map((word, i) => ({ word, theme: `Perso ${i + 1}` })) : null;
}
export function hasCustomWords(): boolean {
  return !!(CUSTOM_WORDS && CUSTOM_WORDS.length);
}
export function customWordCount(): number {
  return CUSTOM_WORDS?.length ?? 0;
}

// prettier-ignore
export const WORD_BANK: WordEntry[] = [
  // ─────────────────────────────────────────────────────────────────────────
  //  Banque nettoyée : uniquement des mots COURANTS et FACILES À DESSINER.
  //  Les concepts abstraits (amour, silence, gravité…) et les mots rares ou
  //  ambigus (ornithorynque, morse, téléphérique…) ont été retirés — ils
  //  cassaient le rythme du jeu. Doublons supprimés.
  // ─────────────────────────────────────────────────────────────────────────
  // Animaux
  { word: "chat", theme: "Animaux" }, { word: "chien", theme: "Animaux" }, { word: "éléphant", theme: "Animaux" },
  { word: "girafe", theme: "Animaux" }, { word: "lion", theme: "Animaux" }, { word: "tigre", theme: "Animaux" },
  { word: "souris", theme: "Animaux" }, { word: "lapin", theme: "Animaux" }, { word: "poisson", theme: "Animaux" },
  { word: "oiseau", theme: "Animaux" }, { word: "vache", theme: "Animaux" }, { word: "cochon", theme: "Animaux" },
  { word: "mouton", theme: "Animaux" }, { word: "cheval", theme: "Animaux" }, { word: "âne", theme: "Animaux" },
  { word: "poule", theme: "Animaux" }, { word: "canard", theme: "Animaux" }, { word: "pingouin", theme: "Animaux" },
  { word: "ours", theme: "Animaux" }, { word: "singe", theme: "Animaux" }, { word: "renard", theme: "Animaux" },
  { word: "loup", theme: "Animaux" }, { word: "écureuil", theme: "Animaux" }, { word: "hérisson", theme: "Animaux" },
  { word: "escargot", theme: "Animaux" }, { word: "papillon", theme: "Animaux" }, { word: "abeille", theme: "Animaux" },
  { word: "coccinelle", theme: "Animaux" }, { word: "araignée", theme: "Animaux" }, { word: "fourmi", theme: "Animaux" },
  { word: "grenouille", theme: "Animaux" }, { word: "tortue", theme: "Animaux" }, { word: "serpent", theme: "Animaux" },
  { word: "crocodile", theme: "Animaux" }, { word: "dauphin", theme: "Animaux" }, { word: "requin", theme: "Animaux" },
  { word: "baleine", theme: "Animaux" }, { word: "pieuvre", theme: "Animaux" }, { word: "crabe", theme: "Animaux" },
  { word: "hibou", theme: "Animaux" }, { word: "perroquet", theme: "Animaux" }, { word: "kangourou", theme: "Animaux" },
  { word: "panda", theme: "Animaux" }, { word: "koala", theme: "Animaux" }, { word: "zèbre", theme: "Animaux" },
  { word: "gorille", theme: "Animaux" }, { word: "rhinocéros", theme: "Animaux" }, { word: "hippopotame", theme: "Animaux" },
  { word: "chameau", theme: "Animaux" }, { word: "dinosaure", theme: "Animaux" }, { word: "poussin", theme: "Animaux" },
  { word: "chauve-souris", theme: "Animaux" }, { word: "caméléon", theme: "Animaux" }, { word: "mammouth", theme: "Animaux" },
  // Nourriture
  { word: "pizza", theme: "Nourriture" }, { word: "banane", theme: "Nourriture" }, { word: "hamburger", theme: "Nourriture" },
  { word: "pomme", theme: "Nourriture" }, { word: "croissant", theme: "Nourriture" }, { word: "sushi", theme: "Nourriture" },
  { word: "pain", theme: "Nourriture" }, { word: "œuf", theme: "Nourriture" }, { word: "baguette", theme: "Nourriture" },
  { word: "fromage", theme: "Nourriture" }, { word: "glace", theme: "Nourriture" }, { word: "gâteau", theme: "Nourriture" },
  { word: "frites", theme: "Nourriture" }, { word: "tacos", theme: "Nourriture" }, { word: "ananas", theme: "Nourriture" },
  { word: "cerise", theme: "Nourriture" }, { word: "pastèque", theme: "Nourriture" }, { word: "carotte", theme: "Nourriture" },
  { word: "champignon", theme: "Nourriture" }, { word: "spaghetti", theme: "Nourriture" }, { word: "donut", theme: "Nourriture" },
  { word: "popcorn", theme: "Nourriture" }, { word: "crêpe", theme: "Nourriture" }, { word: "sandwich", theme: "Nourriture" },
  { word: "hot-dog", theme: "Nourriture" }, { word: "kebab", theme: "Nourriture" }, { word: "soupe", theme: "Nourriture" },
  { word: "salade", theme: "Nourriture" }, { word: "fraise", theme: "Nourriture" }, { word: "raisin", theme: "Nourriture" },
  { word: "citron", theme: "Nourriture" }, { word: "orange", theme: "Nourriture" }, { word: "kiwi", theme: "Nourriture" },
  { word: "avocat", theme: "Nourriture" }, { word: "brocoli", theme: "Nourriture" }, { word: "maïs", theme: "Nourriture" },
  { word: "chocolat", theme: "Nourriture" }, { word: "cookie", theme: "Nourriture" }, { word: "bonbon", theme: "Nourriture" },
  { word: "sucette", theme: "Nourriture" }, { word: "cupcake", theme: "Nourriture" }, { word: "tarte", theme: "Nourriture" },
  // Objets
  { word: "horloge", theme: "Objets" }, { word: "téléphone", theme: "Objets" }, { word: "parapluie", theme: "Objets" },
  { word: "lunettes", theme: "Objets" }, { word: "ampoule", theme: "Objets" }, { word: "cadenas", theme: "Objets" },
  { word: "clé", theme: "Objets" }, { word: "marteau", theme: "Objets" }, { word: "tournevis", theme: "Objets" },
  { word: "ciseaux", theme: "Objets" }, { word: "pinceau", theme: "Objets" }, { word: "crayon", theme: "Objets" },
  { word: "gomme", theme: "Objets" }, { word: "règle", theme: "Objets" }, { word: "livre", theme: "Objets" },
  { word: "bougie", theme: "Objets" }, { word: "lampe", theme: "Objets" }, { word: "montre", theme: "Objets" },
  { word: "réveil", theme: "Objets" }, { word: "valise", theme: "Objets" }, { word: "sac à dos", theme: "Objets" },
  { word: "ballon", theme: "Objets" }, { word: "cadeau", theme: "Objets" }, { word: "échelle", theme: "Objets" },
  { word: "balai", theme: "Objets" }, { word: "loupe", theme: "Objets" }, { word: "seau", theme: "Objets" },
  { word: "miroir", theme: "Objets" }, { word: "peigne", theme: "Objets" }, { word: "brosse à dents", theme: "Objets" },
  { word: "appareil photo", theme: "Objets" }, { word: "manette de jeu", theme: "Objets" }, { word: "ordinateur", theme: "Objets" },
  { word: "clé USB", theme: "Objets" }, { word: "aimant", theme: "Objets" }, { word: "arrosoir", theme: "Objets" },
  { word: "cerf-volant", theme: "Objets" }, { word: "sablier", theme: "Objets" }, { word: "tasse", theme: "Objets" },
  { word: "bouteille", theme: "Objets" }, { word: "assiette", theme: "Objets" }, { word: "fourchette", theme: "Objets" },
  // Maison / quotidien
  { word: "maison", theme: "Maison" }, { word: "porte", theme: "Maison" }, { word: "fenêtre", theme: "Maison" },
  { word: "chaise", theme: "Maison" }, { word: "table", theme: "Maison" }, { word: "lit", theme: "Maison" },
  { word: "canapé", theme: "Maison" }, { word: "télévision", theme: "Maison" }, { word: "réfrigérateur", theme: "Maison" },
  { word: "baignoire", theme: "Maison" }, { word: "douche", theme: "Maison" }, { word: "toilettes", theme: "Maison" },
  { word: "escalier", theme: "Maison" }, { word: "cheminée", theme: "Maison" }, { word: "clé", theme: "Maison" },
  { word: "horloge murale", theme: "Maison" }, { word: "tapis", theme: "Maison" }, { word: "rideau", theme: "Maison" },
  // Vêtements
  { word: "chapeau", theme: "Vêtements" }, { word: "casquette", theme: "Vêtements" }, { word: "chaussure", theme: "Vêtements" },
  { word: "botte", theme: "Vêtements" }, { word: "chaussette", theme: "Vêtements" }, { word: "gant", theme: "Vêtements" },
  { word: "écharpe", theme: "Vêtements" }, { word: "t-shirt", theme: "Vêtements" }, { word: "pantalon", theme: "Vêtements" },
  { word: "robe", theme: "Vêtements" }, { word: "jupe", theme: "Vêtements" }, { word: "cravate", theme: "Vêtements" },
  { word: "manteau", theme: "Vêtements" }, { word: "pull", theme: "Vêtements" }, { word: "short", theme: "Vêtements" },
  { word: "couronne", theme: "Vêtements" }, { word: "nœud papillon", theme: "Vêtements" }, { word: "sac à main", theme: "Vêtements" },
  // Nature
  { word: "arbre", theme: "Nature" }, { word: "fleur", theme: "Nature" }, { word: "soleil", theme: "Nature" },
  { word: "lune", theme: "Nature" }, { word: "étoile", theme: "Nature" }, { word: "nuage", theme: "Nature" },
  { word: "pluie", theme: "Nature" }, { word: "neige", theme: "Nature" }, { word: "arc-en-ciel", theme: "Nature" },
  { word: "volcan", theme: "Nature" }, { word: "cascade", theme: "Nature" }, { word: "éclair", theme: "Nature" },
  { word: "cactus", theme: "Nature" }, { word: "champignon", theme: "Nature" }, { word: "tournesol", theme: "Nature" },
  { word: "rose", theme: "Nature" }, { word: "palmier", theme: "Nature" }, { word: "sapin", theme: "Nature" },
  { word: "feuille", theme: "Nature" }, { word: "montagne", theme: "Nature" }, { word: "île", theme: "Nature" },
  { word: "planète", theme: "Nature" }, { word: "flocon de neige", theme: "Nature" }, { word: "feu de camp", theme: "Nature" },
  // Lieux
  { word: "plage", theme: "Lieux" }, { word: "château", theme: "Lieux" }, { word: "hôpital", theme: "Lieux" },
  { word: "aéroport", theme: "Lieux" }, { word: "phare", theme: "Lieux" }, { word: "igloo", theme: "Lieux" },
  { word: "tour Eiffel", theme: "Lieux" }, { word: "pyramide", theme: "Lieux" }, { word: "moulin", theme: "Lieux" },
  { word: "gratte-ciel", theme: "Lieux" }, { word: "cirque", theme: "Lieux" }, { word: "prison", theme: "Lieux" },
  { word: "école", theme: "Lieux" }, { word: "stade", theme: "Lieux" }, { word: "supermarché", theme: "Lieux" },
  { word: "église", theme: "Lieux" }, { word: "grotte", theme: "Lieux" }, { word: "pont", theme: "Lieux" },
  { word: "ferme", theme: "Lieux" }, { word: "tente", theme: "Lieux" },
  // Métiers
  { word: "pompier", theme: "Métiers" }, { word: "médecin", theme: "Métiers" }, { word: "cuisinier", theme: "Métiers" },
  { word: "policier", theme: "Métiers" }, { word: "astronaute", theme: "Métiers" }, { word: "facteur", theme: "Métiers" },
  { word: "magicien", theme: "Métiers" }, { word: "pirate", theme: "Métiers" }, { word: "chevalier", theme: "Métiers" },
  { word: "jardinier", theme: "Métiers" }, { word: "clown", theme: "Métiers" }, { word: "boulanger", theme: "Métiers" },
  { word: "peintre", theme: "Métiers" }, { word: "détective", theme: "Métiers" }, { word: "cow-boy", theme: "Métiers" },
  { word: "professeur", theme: "Métiers" }, { word: "footballeur", theme: "Métiers" }, { word: "roi", theme: "Métiers" },
  { word: "reine", theme: "Métiers" }, { word: "ninja", theme: "Métiers" },
  // Actions / verbes
  { word: "courir", theme: "Actions" }, { word: "dormir", theme: "Actions" }, { word: "nager", theme: "Actions" },
  { word: "manger", theme: "Actions" }, { word: "pleurer", theme: "Actions" }, { word: "sauter", theme: "Actions" },
  { word: "danser", theme: "Actions" }, { word: "chanter", theme: "Actions" }, { word: "cuisiner", theme: "Actions" },
  { word: "pêcher", theme: "Actions" }, { word: "grimper", theme: "Actions" }, { word: "éternuer", theme: "Actions" },
  { word: "bâiller", theme: "Actions" }, { word: "jongler", theme: "Actions" }, { word: "applaudir", theme: "Actions" },
  { word: "rire", theme: "Actions" }, { word: "boire", theme: "Actions" }, { word: "tomber", theme: "Actions" },
  { word: "se brosser les dents", theme: "Actions" }, { word: "se cacher", theme: "Actions" }, { word: "conduire", theme: "Actions" },
  { word: "crier", theme: "Actions" }, { word: "saluer", theme: "Actions" }, { word: "lire", theme: "Actions" },
  // Sports
  { word: "football", theme: "Sports" }, { word: "basket", theme: "Sports" }, { word: "tennis", theme: "Sports" },
  { word: "ski", theme: "Sports" }, { word: "boxe", theme: "Sports" }, { word: "surf", theme: "Sports" },
  { word: "escalade", theme: "Sports" }, { word: "plongée", theme: "Sports" }, { word: "patinage", theme: "Sports" },
  { word: "skateboard", theme: "Sports" }, { word: "golf", theme: "Sports" }, { word: "bowling", theme: "Sports" },
  { word: "vélo", theme: "Sports" }, { word: "natation", theme: "Sports" }, { word: "gymnastique", theme: "Sports" },
  { word: "tir à l'arc", theme: "Sports" }, { word: "ping-pong", theme: "Sports" }, { word: "fléchettes", theme: "Sports" },
  // Transports
  { word: "voiture", theme: "Transports" }, { word: "vélo", theme: "Transports" }, { word: "fusée", theme: "Transports" },
  { word: "montgolfière", theme: "Transports" }, { word: "sous-marin", theme: "Transports" }, { word: "hélicoptère", theme: "Transports" },
  { word: "trottinette", theme: "Transports" }, { word: "tracteur", theme: "Transports" }, { word: "voilier", theme: "Transports" },
  { word: "train", theme: "Transports" }, { word: "avion", theme: "Transports" }, { word: "moto", theme: "Transports" },
  { word: "bateau", theme: "Transports" }, { word: "camion", theme: "Transports" }, { word: "bus", theme: "Transports" },
  { word: "ambulance", theme: "Transports" }, { word: "montagnes russes", theme: "Transports" }, { word: "brouette", theme: "Transports" },
  // Musique
  { word: "guitare", theme: "Musique" }, { word: "piano", theme: "Musique" }, { word: "trompette", theme: "Musique" },
  { word: "batterie", theme: "Musique" }, { word: "casque audio", theme: "Musique" }, { word: "violon", theme: "Musique" },
  { word: "microphone", theme: "Musique" }, { word: "note de musique", theme: "Musique" }, { word: "saxophone", theme: "Musique" },
  // Corps
  { word: "squelette", theme: "Corps" }, { word: "cerveau", theme: "Corps" }, { word: "cœur", theme: "Corps" },
  { word: "œil", theme: "Corps" }, { word: "main", theme: "Corps" }, { word: "pied", theme: "Corps" },
  { word: "nez", theme: "Corps" }, { word: "bouche", theme: "Corps" }, { word: "oreille", theme: "Corps" },
  { word: "dent", theme: "Corps" }, { word: "moustache", theme: "Corps" }, { word: "langue", theme: "Corps" },
  // Personnages (prompts de dessin simples, pas de reproduction d'œuvre)
  { word: "Mario", theme: "Personnages" }, { word: "Luigi", theme: "Personnages" }, { word: "Pikachu", theme: "Personnages" },
  { word: "Batman", theme: "Personnages" }, { word: "Superman", theme: "Personnages" }, { word: "Spider-Man", theme: "Personnages" },
  { word: "Bob l'éponge", theme: "Personnages" }, { word: "Sonic", theme: "Personnages" }, { word: "Shrek", theme: "Personnages" },
  { word: "Pac-Man", theme: "Personnages" }, { word: "Mickey Mouse", theme: "Personnages" }, { word: "Hulk", theme: "Personnages" },
  { word: "Iron Man", theme: "Personnages" }, { word: "Elsa", theme: "Personnages" }, { word: "Minion", theme: "Personnages" },
  { word: "Harry Potter", theme: "Personnages" }, { word: "Dark Vador", theme: "Personnages" }, { word: "Yoda", theme: "Personnages" },
  { word: "père Noël", theme: "Personnages" }, { word: "sirène", theme: "Personnages" }, { word: "dragon", theme: "Personnages" },
  // Culture pop / créatures
  { word: "robot", theme: "Culture pop" }, { word: "soucoupe volante", theme: "Culture pop" }, { word: "licorne", theme: "Culture pop" },
  { word: "zombie", theme: "Culture pop" }, { word: "vampire", theme: "Culture pop" }, { word: "fantôme", theme: "Culture pop" },
  { word: "sorcière", theme: "Culture pop" }, { word: "momie", theme: "Culture pop" }, { word: "extraterrestre", theme: "Culture pop" },
  { word: "super-héros", theme: "Culture pop" }, { word: "épée laser", theme: "Culture pop" }, { word: "trophée", theme: "Culture pop" },
  { word: "feu d'artifice", theme: "Culture pop" }, { word: "émoji", theme: "Culture pop" }, { word: "selfie", theme: "Culture pop" },
];
const UNIQUE_BANK: WordEntry[] = WORD_BANK.filter(
  (e, i, a) => a.findIndex((x) => x.word.toLowerCase() === e.word.toLowerCase()) === i,
);

/**
 * Pick `count` distinct entries fully at random across the whole bank.
 * An optional theme filter (lobby chips) may narrow the pool; difficulty no
 * longer exists — randomness alone decides.
 */
export function pickWordEntries(
  count: number,
  rng: () => number = Math.random,
  themes?: string[],
  /** Mots déjà proposés dans la partie — ils ne peuvent plus ressortir. */
  exclude?: readonly string[],
): WordEntry[] {
  const shuffle = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  let pool = UNIQUE_BANK;
  if (themes && themes.length) {
    const set = new Set(themes);
    const f = pool.filter((e) => set.has(e.theme));
    if (f.length >= count) pool = f;
  }
  // Custom words (from motdessin/mots.txt) are ADDED to the pool — the built-in
  // words are kept. They stay available whatever the theme selection.
  if (CUSTOM_WORDS && CUSTOM_WORDS.length) {
    pool = [...pool, ...CUSTOM_WORDS];
  }
  // Drop everything already used this game. If that would leave too little to
  // choose from, we relax (a very long game shouldn't dead-end).
  if (exclude && exclude.length) {
    const used = new Set(exclude);
    const fresh = pool.filter((e) => !used.has(e.word));
    if (fresh.length >= count) pool = fresh;
  }
  count = Math.max(1, count);

  // Group by theme so the proposed words are unrelated to one another:
  // we take at most one word per distinct theme first.
  const byTheme = new Map<string, WordEntry[]>();
  for (const e of pool) {
    const list = byTheme.get(e.theme);
    if (list) list.push(e);
    else byTheme.set(e.theme, [e]);
  }
  const themeOrder = shuffle([...byTheme.keys()]);
  const picked: WordEntry[] = [];
  const used = new Set<string>();
  for (const th of themeOrder) {
    if (picked.length >= count) break;
    const w = shuffle([...byTheme.get(th)!]).find((e) => !used.has(e.word));
    if (w) { picked.push(w); used.add(w.word); }
  }
  // If there are fewer distinct themes than `count`, fill the rest at random.
  if (picked.length < count) {
    for (const e of shuffle(pool.filter((e) => !used.has(e.word)))) {
      if (picked.length >= count) break;
      picked.push(e); used.add(e.word);
    }
  }
  return shuffle(picked);
}

/** All distinct themes present in the bank (for the optional lobby theme picker). */
export const DRAW_THEMES: string[] = [...new Set(UNIQUE_BANK.map((e) => e.theme))];

/** Back-compat helper: just the words. */
export function pickWords(count: number, rng: () => number = Math.random): string[] {
  return pickWordEntries(count, rng).map((e) => e.word);
}

export const WORD_LIST: string[] = UNIQUE_BANK.map((e) => e.word);
