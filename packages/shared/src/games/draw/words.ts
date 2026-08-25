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
  // Animaux
  { word: "chat", theme: "Animaux" }, { word: "chien", theme: "Animaux" }, { word: "éléphant", theme: "Animaux" },
  { word: "girafe", theme: "Animaux" }, { word: "lion", theme: "Animaux" }, { word: "tigre", theme: "Animaux" },
  { word: "pingouin", theme: "Animaux" }, { word: "hérisson", theme: "Animaux" }, { word: "pieuvre", theme: "Animaux" },
  { word: "caméléon", theme: "Animaux" }, { word: "ornithorynque", theme: "Animaux" }, { word: "escargot", theme: "Animaux" },
  { word: "papillon", theme: "Animaux" }, { word: "chauve-souris", theme: "Animaux" }, { word: "kangourou", theme: "Animaux" },
  { word: "crocodile", theme: "Animaux" }, { word: "dauphin", theme: "Animaux" }, { word: "requin", theme: "Animaux" },
  { word: "abeille", theme: "Animaux" }, { word: "araignée", theme: "Animaux" }, { word: "grenouille", theme: "Animaux" },
  { word: "tortue", theme: "Animaux" }, { word: "hibou", theme: "Animaux" }, { word: "flamant rose", theme: "Animaux" },
  { word: "écureuil", theme: "Animaux" }, { word: "serpent", theme: "Animaux" }, { word: "cheval", theme: "Animaux" },
  { word: "renard", theme: "Animaux" }, { word: "panda", theme: "Animaux" }, { word: "koala", theme: "Animaux" },
  { word: "méduse", theme: "Animaux" }, { word: "hippocampe", theme: "Animaux" }, { word: "loup", theme: "Animaux" },
  { word: "coccinelle", theme: "Animaux" }, { word: "paon", theme: "Animaux" }, { word: "mammouth", theme: "Animaux" },
  // Nourriture
  { word: "pizza", theme: "Nourriture" }, { word: "banane", theme: "Nourriture" }, { word: "hamburger", theme: "Nourriture" },
  { word: "pomme de terre", theme: "Nourriture" }, { word: "croissant", theme: "Nourriture" }, { word: "sushi", theme: "Nourriture" },
  { word: "barbe à papa", theme: "Nourriture" }, { word: "œuf au plat", theme: "Nourriture" }, { word: "brochette", theme: "Nourriture" },
  { word: "camembert", theme: "Nourriture" }, { word: "baguette", theme: "Nourriture" }, { word: "glace", theme: "Nourriture" },
  { word: "gâteau", theme: "Nourriture" }, { word: "frites", theme: "Nourriture" }, { word: "tacos", theme: "Nourriture" },
  { word: "ananas", theme: "Nourriture" }, { word: "cerise", theme: "Nourriture" }, { word: "pastèque", theme: "Nourriture" },
  { word: "carotte", theme: "Nourriture" }, { word: "champignon", theme: "Nourriture" }, { word: "spaghetti", theme: "Nourriture" },
  { word: "donut", theme: "Nourriture" }, { word: "popcorn", theme: "Nourriture" }, { word: "bretzel", theme: "Nourriture" },
  { word: "crêpe", theme: "Nourriture" }, { word: "fromage", theme: "Nourriture" }, { word: "cornichon", theme: "Nourriture" },
  // Objets
  { word: "horloge", theme: "Objets" }, { word: "téléphone", theme: "Objets" }, { word: "parapluie", theme: "Objets" },
  { word: "lunettes", theme: "Objets" }, { word: "ampoule", theme: "Objets" }, { word: "boussole", theme: "Objets" },
  { word: "cadenas", theme: "Objets" }, { word: "télescope", theme: "Objets" }, { word: "machine à laver", theme: "Objets" },
  { word: "tourne-disque", theme: "Objets" }, { word: "cadeau", theme: "Objets" }, { word: "trésor", theme: "Objets" },
  { word: "carte au trésor", theme: "Objets" }, { word: "parachute", theme: "Objets" }, { word: "échelle", theme: "Objets" },
  { word: "ciseaux", theme: "Objets" }, { word: "marteau", theme: "Objets" }, { word: "clé", theme: "Objets" },
  { word: "bougie", theme: "Objets" }, { word: "aimant", theme: "Objets" }, { word: "balai", theme: "Objets" },
  { word: "réveil", theme: "Objets" }, { word: "appareil photo", theme: "Objets" }, { word: "ballon de baudruche", theme: "Objets" },
  { word: "tire-bouchon", theme: "Objets" }, { word: "sablier", theme: "Objets" }, { word: "boule à neige", theme: "Objets" },
  { word: "extincteur", theme: "Objets" }, { word: "brosse à dents", theme: "Objets" }, { word: "cerf-volant", theme: "Objets" },
  // Nature
  { word: "arc-en-ciel", theme: "Nature" }, { word: "volcan", theme: "Nature" }, { word: "cascade", theme: "Nature" },
  { word: "tornade", theme: "Nature" }, { word: "cactus", theme: "Nature" }, { word: "flocon de neige", theme: "Nature" },
  { word: "éclair", theme: "Nature" }, { word: "planète", theme: "Nature" }, { word: "comète", theme: "Nature" },
  { word: "feu de camp", theme: "Nature" }, { word: "montagne", theme: "Nature" }, { word: "île", theme: "Nature" },
  { word: "soleil", theme: "Nature" }, { word: "lune", theme: "Nature" }, { word: "étoile filante", theme: "Nature" },
  { word: "tournesol", theme: "Nature" }, { word: "champignon", theme: "Nature" }, { word: "trèfle à quatre feuilles", theme: "Nature" },
  { word: "goutte d'eau", theme: "Nature" }, { word: "désert", theme: "Nature" },
  // Lieux
  { word: "plage", theme: "Lieux" }, { word: "château", theme: "Lieux" }, { word: "hôpital", theme: "Lieux" },
  { word: "aéroport", theme: "Lieux" }, { word: "phare", theme: "Lieux" }, { word: "igloo", theme: "Lieux" },
  { word: "tour Eiffel", theme: "Lieux" }, { word: "pyramide", theme: "Lieux" }, { word: "moulin", theme: "Lieux" },
  { word: "gratte-ciel", theme: "Lieux" }, { word: "cirque", theme: "Lieux" }, { word: "prison", theme: "Lieux" },
  { word: "école", theme: "Lieux" }, { word: "stade", theme: "Lieux" }, { word: "supermarché", theme: "Lieux" },
  { word: "cabane dans un arbre", theme: "Lieux" }, { word: "grotte", theme: "Lieux" }, { word: "statue de la Liberté", theme: "Lieux" },
  { word: "Colisée", theme: "Lieux" }, { word: "tente de camping", theme: "Lieux" },
  // Métiers
  { word: "pompier", theme: "Métiers" }, { word: "médecin", theme: "Métiers" }, { word: "cuisinier", theme: "Métiers" },
  { word: "policier", theme: "Métiers" }, { word: "astronaute", theme: "Métiers" }, { word: "facteur", theme: "Métiers" },
  { word: "magicien", theme: "Métiers" }, { word: "pirate", theme: "Métiers" }, { word: "chevalier", theme: "Métiers" },
  { word: "jardinier", theme: "Métiers" }, { word: "vétérinaire", theme: "Métiers" }, { word: "clown", theme: "Métiers" },
  { word: "boulanger", theme: "Métiers" }, { word: "peintre", theme: "Métiers" }, { word: "scientifique", theme: "Métiers" },
  { word: "détective", theme: "Métiers" }, { word: "ninja", theme: "Métiers" }, { word: "cow-boy", theme: "Métiers" },
  { word: "plongeur", theme: "Métiers" }, { word: "juge", theme: "Métiers" },
  // Actions / verbes
  { word: "courir", theme: "Actions" }, { word: "dormir", theme: "Actions" }, { word: "nager", theme: "Actions" },
  { word: "manger", theme: "Actions" }, { word: "pleurer", theme: "Actions" }, { word: "sauter", theme: "Actions" },
  { word: "danser", theme: "Actions" }, { word: "chanter", theme: "Actions" }, { word: "fumer", theme: "Actions" },
  { word: "cuisiner", theme: "Actions" }, { word: "pêcher", theme: "Actions" }, { word: "grimper", theme: "Actions" },
  { word: "éternuer", theme: "Actions" }, { word: "bâiller", theme: "Actions" }, { word: "jongler", theme: "Actions" },
  { word: "applaudir", theme: "Actions" }, { word: "rire", theme: "Actions" }, { word: "boire", theme: "Actions" },
  { word: "tomber", theme: "Actions" }, { word: "voler", theme: "Actions" }, { word: "embrasser", theme: "Actions" },
  { word: "se brosser les dents", theme: "Actions" }, { word: "se cacher", theme: "Actions" }, { word: "réfléchir", theme: "Actions" },
  { word: "conduire", theme: "Actions" }, { word: "crier", theme: "Actions" }, { word: "tricoter", theme: "Actions" },
  // Sports
  { word: "football", theme: "Sports" }, { word: "basket", theme: "Sports" }, { word: "tennis", theme: "Sports" },
  { word: "ski", theme: "Sports" }, { word: "boxe", theme: "Sports" }, { word: "surf", theme: "Sports" },
  { word: "escalade", theme: "Sports" }, { word: "plongée", theme: "Sports" }, { word: "patinage", theme: "Sports" },
  { word: "skateboard", theme: "Sports" }, { word: "golf", theme: "Sports" }, { word: "bowling", theme: "Sports" },
  { word: "yoga", theme: "Sports" }, { word: "escrime", theme: "Sports" }, { word: "haltérophilie", theme: "Sports" },
  { word: "tir à l'arc", theme: "Sports" }, { word: "parapente", theme: "Sports" }, { word: "ping-pong", theme: "Sports" },
  // Transports
  { word: "vélo", theme: "Transports" }, { word: "fusée", theme: "Transports" }, { word: "montgolfière", theme: "Transports" },
  { word: "sous-marin", theme: "Transports" }, { word: "hélicoptère", theme: "Transports" }, { word: "trottinette", theme: "Transports" },
  { word: "voiture de course", theme: "Transports" }, { word: "tracteur", theme: "Transports" }, { word: "voilier", theme: "Transports" },
  { word: "train", theme: "Transports" }, { word: "avion", theme: "Transports" }, { word: "moto", theme: "Transports" },
  { word: "téléphérique", theme: "Transports" }, { word: "brouette", theme: "Transports" },
  // Musique
  { word: "guitare", theme: "Musique" }, { word: "piano", theme: "Musique" }, { word: "trompette", theme: "Musique" },
  { word: "batterie", theme: "Musique" }, { word: "casque audio", theme: "Musique" }, { word: "violon", theme: "Musique" },
  { word: "accordéon", theme: "Musique" }, { word: "microphone", theme: "Musique" }, { word: "note de musique", theme: "Musique" },
  // Corps / concepts
  { word: "squelette", theme: "Corps" }, { word: "cerveau", theme: "Corps" }, { word: "cœur", theme: "Corps" },
  { word: "empreinte", theme: "Concepts" }, { word: "ombre", theme: "Concepts" }, { word: "équilibre", theme: "Concepts" },
  { word: "feu d'artifice", theme: "Concepts" }, { word: "temps qui passe", theme: "Concepts" }, { word: "amour", theme: "Concepts" },
  { word: "silence", theme: "Concepts" }, { word: "gravité", theme: "Concepts" }, { word: "reflet", theme: "Concepts" },
  // Personnages de fiction (simples prompts de dessin, pas de reproduction d'œuvre)
  { word: "Mario", theme: "Personnages" }, { word: "Luigi", theme: "Personnages" }, { word: "Pikachu", theme: "Personnages" },
  { word: "Homer Simpson", theme: "Personnages" }, { word: "Bart Simpson", theme: "Personnages" }, { word: "Dark Vador", theme: "Personnages" },
  { word: "Batman", theme: "Personnages" }, { word: "Superman", theme: "Personnages" }, { word: "Spider-Man", theme: "Personnages" },
  { word: "Bob l'éponge", theme: "Personnages" }, { word: "Sonic", theme: "Personnages" }, { word: "Yoda", theme: "Personnages" },
  { word: "Gollum", theme: "Personnages" }, { word: "Shrek", theme: "Personnages" }, { word: "Pac-Man", theme: "Personnages" },
  { word: "Mickey Mouse", theme: "Personnages" }, { word: "Donald Duck", theme: "Personnages" }, { word: "Goku", theme: "Personnages" },
  { word: "Naruto", theme: "Personnages" }, { word: "Pikachu", theme: "Personnages" }, { word: "Harry Potter", theme: "Personnages" },
  { word: "Dark Vador", theme: "Personnages" }, { word: "Iron Man", theme: "Personnages" }, { word: "Hulk", theme: "Personnages" },
  { word: "Elsa", theme: "Personnages" }, { word: "Buzz l'Éclair", theme: "Personnages" }, { word: "Woody", theme: "Personnages" },
  { word: "Stitch", theme: "Personnages" }, { word: "Minion", theme: "Personnages" }, { word: "Pokémon", theme: "Personnages" },
  { word: "Kirby", theme: "Personnages" }, { word: "Bowser", theme: "Personnages" }, { word: "Zelda", theme: "Personnages" },
  { word: "père Noël", theme: "Personnages" }, { word: "sirène", theme: "Personnages" }, { word: "dragon", theme: "Personnages" },
  // Culture pop / trucs à représenter
  { word: "manette de jeu", theme: "Culture pop" }, { word: "casque VR", theme: "Culture pop" }, { word: "selfie", theme: "Culture pop" },
  { word: "émoji", theme: "Culture pop" }, { word: "robot", theme: "Culture pop" }, { word: "soucoupe volante", theme: "Culture pop" },
  { word: "licorne", theme: "Culture pop" }, { word: "zombie", theme: "Culture pop" }, { word: "vampire", theme: "Culture pop" },
  { word: "super-héros", theme: "Culture pop" }, { word: "fantôme", theme: "Culture pop" }, { word: "extraterrestre", theme: "Culture pop" },
  { word: "creeper Minecraft", theme: "Culture pop" }, { word: "épée laser", theme: "Culture pop" }, { word: "boule de cristal", theme: "Culture pop" },
  { word: "momie", theme: "Culture pop" }, { word: "sorcière", theme: "Culture pop" }, { word: "yéti", theme: "Culture pop" },
  { word: "loup-garou", theme: "Culture pop" }, { word: "trophée", theme: "Culture pop" },
  // ═══════════ EXTENSIONS (beaucoup plus de mots) ═══════════
  // Animaux
  { word: "zèbre", theme: "Animaux" }, { word: "rhinocéros", theme: "Animaux" }, { word: "hippopotame", theme: "Animaux" },
  { word: "gorille", theme: "Animaux" }, { word: "kangourou roux", theme: "Animaux" }, { word: "autruche", theme: "Animaux" },
  { word: "toucan", theme: "Animaux" }, { word: "perroquet", theme: "Animaux" }, { word: "cygne", theme: "Animaux" },
  { word: "phoque", theme: "Animaux" }, { word: "morse", theme: "Animaux" }, { word: "otarie", theme: "Animaux" },
  { word: "baleine", theme: "Animaux" }, { word: "orque", theme: "Animaux" }, { word: "raton laveur", theme: "Animaux" },
  { word: "castor", theme: "Animaux" }, { word: "loutre", theme: "Animaux" }, { word: "chameau", theme: "Animaux" },
  { word: "dromadaire", theme: "Animaux" }, { word: "lama", theme: "Animaux" }, { word: "âne", theme: "Animaux" },
  { word: "cochon", theme: "Animaux" }, { word: "mouton", theme: "Animaux" }, { word: "chèvre", theme: "Animaux" },
  { word: "poule", theme: "Animaux" }, { word: "coq", theme: "Animaux" }, { word: "canard", theme: "Animaux" },
  { word: "libellule", theme: "Animaux" }, { word: "sauterelle", theme: "Animaux" }, { word: "fourmi", theme: "Animaux" },
  { word: "scorpion", theme: "Animaux" }, { word: "crabe", theme: "Animaux" }, { word: "homard", theme: "Animaux" },
  { word: "étoile de mer", theme: "Animaux" }, { word: "hérisson", theme: "Animaux" }, { word: "taupe", theme: "Animaux" },
  // Nourriture
  { word: "cupcake", theme: "Nourriture" }, { word: "muffin", theme: "Nourriture" }, { word: "sucette", theme: "Nourriture" },
  { word: "sandwich", theme: "Nourriture" }, { word: "hot-dog", theme: "Nourriture" }, { word: "kebab", theme: "Nourriture" },
  { word: "raviolis", theme: "Nourriture" }, { word: "soupe", theme: "Nourriture" }, { word: "salade", theme: "Nourriture" },
  { word: "fraise", theme: "Nourriture" }, { word: "raisin", theme: "Nourriture" }, { word: "citron", theme: "Nourriture" },
  { word: "orange", theme: "Nourriture" }, { word: "kiwi", theme: "Nourriture" }, { word: "noix de coco", theme: "Nourriture" },
  { word: "avocat", theme: "Nourriture" }, { word: "brocoli", theme: "Nourriture" }, { word: "maïs", theme: "Nourriture" },
  { word: "poivron", theme: "Nourriture" }, { word: "oignon", theme: "Nourriture" }, { word: "chocolat", theme: "Nourriture" },
  { word: "sucre d'orge", theme: "Nourriture" }, { word: "miel", theme: "Nourriture" }, { word: "cookie", theme: "Nourriture" },
  { word: "macaron", theme: "Nourriture" }, { word: "bonbon", theme: "Nourriture" }, { word: "tarte", theme: "Nourriture" },
  // Objets
  { word: "clé", theme: "Objets" }, { word: "marteau", theme: "Objets" }, { word: "tournevis", theme: "Objets" },
  { word: "ciseaux", theme: "Objets" }, { word: "pinceau", theme: "Objets" }, { word: "crayon", theme: "Objets" },
  { word: "gomme", theme: "Objets" }, { word: "règle", theme: "Objets" }, { word: "agrafeuse", theme: "Objets" },
  { word: "bougie", theme: "Objets" }, { word: "lampe de poche", theme: "Objets" }, { word: "batterie", theme: "Objets" },
  { word: "casque", theme: "Objets" }, { word: "montre", theme: "Objets" }, { word: "réveil", theme: "Objets" },
  { word: "valise", theme: "Objets" }, { word: "sac à dos", theme: "Objets" }, { word: "portefeuille", theme: "Objets" },
  { word: "clé USB", theme: "Objets" }, { word: "manette", theme: "Objets" }, { word: "aimant", theme: "Objets" },
  { word: "loupe", theme: "Objets" }, { word: "seau", theme: "Objets" }, { word: "échelle", theme: "Objets" },
  { word: "brosse à dents", theme: "Objets" }, { word: "peigne", theme: "Objets" }, { word: "miroir", theme: "Objets" },
  { word: "balai", theme: "Objets" }, { word: "arrosoir", theme: "Objets" }, { word: "thermomètre", theme: "Objets" },
  // Nature
  { word: "volcan", theme: "Nature" }, { word: "cascade", theme: "Nature" }, { word: "arc-en-ciel", theme: "Nature" },
  { word: "éclair", theme: "Nature" }, { word: "tornade", theme: "Nature" }, { word: "flocon de neige", theme: "Nature" },
  { word: "cactus", theme: "Nature" }, { word: "champignon", theme: "Nature" }, { word: "trèfle", theme: "Nature" },
  { word: "tournesol", theme: "Nature" }, { word: "rose", theme: "Nature" }, { word: "palmier", theme: "Nature" },
  { word: "sapin", theme: "Nature" }, { word: "feuille", theme: "Nature" }, { word: "montagne", theme: "Nature" },
  { word: "île", theme: "Nature" }, { word: "désert", theme: "Nature" }, { word: "planète", theme: "Nature" },
  { word: "comète", theme: "Nature" }, { word: "galaxie", theme: "Nature" },
  // Transports
  { word: "montgolfière", theme: "Transports" }, { word: "hélicoptère", theme: "Transports" }, { word: "sous-marin", theme: "Transports" },
  { word: "fusée", theme: "Transports" }, { word: "trottinette", theme: "Transports" }, { word: "skateboard", theme: "Transports" },
  { word: "tracteur", theme: "Transports" }, { word: "camion", theme: "Transports" }, { word: "ambulance", theme: "Transports" },
  { word: "voilier", theme: "Transports" }, { word: "canoë", theme: "Transports" }, { word: "téléphérique", theme: "Transports" },
  { word: "montagnes russes", theme: "Transports" }, { word: "métro", theme: "Transports" }, { word: "brouette", theme: "Transports" },
  // Sports
  { word: "basket", theme: "Sports" }, { word: "tennis", theme: "Sports" }, { word: "ski", theme: "Sports" },
  { word: "surf", theme: "Sports" }, { word: "plongée", theme: "Sports" }, { word: "boxe", theme: "Sports" },
  { word: "escalade", theme: "Sports" }, { word: "gymnastique", theme: "Sports" }, { word: "patinage", theme: "Sports" },
  { word: "bowling", theme: "Sports" }, { word: "fléchettes", theme: "Sports" }, { word: "golf", theme: "Sports" },
  { word: "haltérophilie", theme: "Sports" }, { word: "tir à l'arc", theme: "Sports" }, { word: "yoga", theme: "Sports" },
  // Lieux
  { word: "château", theme: "Lieux" }, { word: "phare", theme: "Lieux" }, { word: "igloo", theme: "Lieux" },
  { word: "moulin", theme: "Lieux" }, { word: "pyramide", theme: "Lieux" }, { word: "gratte-ciel", theme: "Lieux" },
  { word: "cirque", theme: "Lieux" }, { word: "hôpital", theme: "Lieux" }, { word: "école", theme: "Lieux" },
  { word: "bibliothèque", theme: "Lieux" }, { word: "aéroport", theme: "Lieux" }, { word: "stade", theme: "Lieux" },
  { word: "supermarché", theme: "Lieux" }, { word: "plage", theme: "Lieux" }, { word: "grotte", theme: "Lieux" },
  // Métiers
  { word: "pompier", theme: "Métiers" }, { word: "médecin", theme: "Métiers" }, { word: "policier", theme: "Métiers" },
  { word: "cuisinier", theme: "Métiers" }, { word: "astronaute", theme: "Métiers" }, { word: "pirate", theme: "Métiers" },
  { word: "magicien", theme: "Métiers" }, { word: "clown", theme: "Métiers" }, { word: "facteur", theme: "Métiers" },
  { word: "jardinier", theme: "Métiers" }, { word: "peintre", theme: "Métiers" }, { word: "photographe", theme: "Métiers" },
  { word: "détective", theme: "Métiers" }, { word: "boulanger", theme: "Métiers" }, { word: "scientifique", theme: "Métiers" },
  // Corps
  { word: "cerveau", theme: "Corps" }, { word: "cœur", theme: "Corps" }, { word: "squelette", theme: "Corps" },
  { word: "empreinte", theme: "Corps" }, { word: "moustache", theme: "Corps" }, { word: "sourcil", theme: "Corps" },
  { word: "langue", theme: "Corps" }, { word: "oreille", theme: "Corps" },
  // Musique
  { word: "guitare", theme: "Musique" }, { word: "piano", theme: "Musique" }, { word: "batterie musicale", theme: "Musique" },
  { word: "trompette", theme: "Musique" }, { word: "violon", theme: "Musique" }, { word: "saxophone", theme: "Musique" },
  { word: "microphone", theme: "Musique" }, { word: "casque audio", theme: "Musique" }, { word: "note de musique", theme: "Musique" },
  // Actions
  { word: "dormir", theme: "Actions" }, { word: "courir", theme: "Actions" }, { word: "sauter", theme: "Actions" },
  { word: "nager", theme: "Actions" }, { word: "pleurer", theme: "Actions" }, { word: "rire", theme: "Actions" },
  { word: "danser", theme: "Actions" }, { word: "éternuer", theme: "Actions" }, { word: "applaudir", theme: "Actions" },
  { word: "chuchoter", theme: "Actions" }, { word: "escalader", theme: "Actions" }, { word: "plonger", theme: "Actions" },
  // Culture pop / Personnages (génériques, non copyrightés)
  { word: "robot", theme: "Personnages" }, { word: "extraterrestre", theme: "Personnages" }, { word: "zombie", theme: "Personnages" },
  { word: "vampire", theme: "Personnages" }, { word: "sorcière", theme: "Personnages" }, { word: "fantôme", theme: "Personnages" },
  { word: "dragon", theme: "Personnages" }, { word: "licorne", theme: "Personnages" }, { word: "sirène", theme: "Personnages" },
  { word: "chevalier", theme: "Personnages" }, { word: "roi", theme: "Personnages" }, { word: "reine", theme: "Personnages" },
  { word: "ninja", theme: "Personnages" }, { word: "cowboy", theme: "Personnages" }, { word: "yéti", theme: "Personnages" },
  { word: "momie", theme: "Personnages" }, { word: "cyclope", theme: "Personnages" }, { word: "super-héros", theme: "Personnages" },
  // Concepts
  { word: "amour", theme: "Concepts" }, { word: "temps", theme: "Concepts" }, { word: "chance", theme: "Concepts" },
  { word: "silence", theme: "Concepts" }, { word: "gravité", theme: "Concepts" }, { word: "infini", theme: "Concepts" },
  { word: "équilibre", theme: "Concepts" }, { word: "liberté", theme: "Concepts" },
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
