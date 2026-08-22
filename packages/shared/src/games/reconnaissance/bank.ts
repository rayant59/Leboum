// Reconnaissance — content bank. Each entry references a REAL photo via a
// Wikipedia article subject (`wiki`, with an optional English fallback `wikiEn`).
// The actual image is resolved at runtime from the Wikimedia REST API
// (the article's lead image — a real, freely-licensed photograph) and shown with
// a source credit. No emojis, no generated placeholders.
//
// To add entries: pick a Wikipedia article whose lead image clearly depicts the
// answer, and set { wiki, question, answer, accepted, category }.

export interface RecoItem {
  id: string;
  wiki: string; // fr.wikipedia article title whose lead image depicts the answer
  wikiEn?: string; // english fallback title (if the fr article lacks a good image)
  question: string;
  answer: string;
  accepted?: string[];
  category: string; // stored, not necessarily shown
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
  // 🐾 Animaux — mélange d'évidents et de plus pointus
  { id: "axolotl", wiki: "Axolotl", wikiEn: "Axolotl", question: "Quel est cet animal ?", answer: "Axolotl", category: "Animaux" },
  { id: "pangolin", wiki: "Pangolin", wikiEn: "Pangolin", question: "Quel est cet animal ?", answer: "Pangolin", category: "Animaux" },
  { id: "okapi", wiki: "Okapi", wikiEn: "Okapi", question: "Quel est cet animal ?", answer: "Okapi", category: "Animaux" },
  { id: "quokka", wiki: "Quokka", wikiEn: "Quokka", question: "Quel est cet animal ?", answer: "Quokka", category: "Animaux" },
  { id: "capybara", wiki: "Capybara", wikiEn: "Capybara", question: "Quel est cet animal ?", answer: "Capybara", accepted: ["cabiai"], category: "Animaux" },
  { id: "narval", wiki: "Narval", wikiEn: "Narwhal", question: "Quel est cet animal ?", answer: "Narval", category: "Animaux" },
  { id: "fennec", wiki: "Fennec", wikiEn: "Fennec fox", question: "Quel est cet animal ?", answer: "Fennec", category: "Animaux" },
  { id: "ornitho", wiki: "Ornithorynque", wikiEn: "Platypus", question: "Quel est cet animal ?", answer: "Ornithorynque", category: "Animaux" },
  { id: "raton", wiki: "Raton laveur", wikiEn: "Raccoon", question: "Quel est cet animal ?", answer: "Raton laveur", category: "Animaux" },
  { id: "toucan", wiki: "Toucan", wikiEn: "Toucan", question: "Quel est cet animal ?", answer: "Toucan", category: "Animaux" },
  { id: "cameleon", wiki: "Caméléon", wikiEn: "Chameleon", question: "Quel est cet animal ?", answer: "Caméléon", category: "Animaux" },
  { id: "tapir", wiki: "Tapir", wikiEn: "Tapir", question: "Quel est cet animal ?", answer: "Tapir", category: "Animaux" },
  { id: "suricate", wiki: "Suricate", wikiEn: "Meerkat", question: "Quel est cet animal ?", answer: "Suricate", accepted: ["surikate"], category: "Animaux" },
  { id: "lynx", wiki: "Lynx", wikiEn: "Lynx", question: "Quel est cet animal ?", answer: "Lynx", category: "Animaux" },
  { id: "flamant", wiki: "Flamant rose", wikiEn: "Flamingo", question: "Quel est cet animal ?", answer: "Flamant rose", accepted: ["flamant"], category: "Animaux" },
  // 🏛️ Monuments
  { id: "eiffel", wiki: "Tour Eiffel", wikiEn: "Eiffel Tower", question: "Quel est ce monument ?", answer: "Tour Eiffel", accepted: ["la tour eiffel"], category: "Monuments" },
  { id: "colisee", wiki: "Colisée", wikiEn: "Colosseum", question: "Quel est ce monument ?", answer: "Colisée", accepted: ["colisee de rome", "colosseum"], category: "Monuments" },
  { id: "taj", wiki: "Taj Mahal", wikiEn: "Taj Mahal", question: "Quel est ce monument ?", answer: "Taj Mahal", category: "Monuments" },
  { id: "liberty", wiki: "Statue de la Liberté", wikiEn: "Statue of Liberty", question: "Quel est ce monument ?", answer: "Statue de la Liberté", category: "Monuments" },
  { id: "bigben", wiki: "Big Ben", wikiEn: "Big Ben", question: "Quel est ce monument ?", answer: "Big Ben", category: "Monuments" },
  { id: "sagrada", wiki: "Sagrada Família", wikiEn: "Sagrada Família", question: "Quel est ce monument ?", answer: "Sagrada Familia", accepted: ["la sagrada familia"], category: "Monuments" },
  { id: "montsm", wiki: "Mont-Saint-Michel", wikiEn: "Mont-Saint-Michel", question: "Quel est ce monument ?", answer: "Mont Saint-Michel", category: "Monuments" },
  { id: "pise", wiki: "Tour de Pise", wikiEn: "Leaning Tower of Pisa", question: "Quel est ce monument ?", answer: "Tour de Pise", accepted: ["tour penchee de pise"], category: "Monuments" },
  { id: "stonehenge", wiki: "Stonehenge", wikiEn: "Stonehenge", question: "Quel est ce monument ?", answer: "Stonehenge", category: "Monuments" },
  { id: "sphinx", wiki: "Sphinx de Gizeh", wikiEn: "Great Sphinx of Giza", question: "Quel est ce monument ?", answer: "Sphinx de Gizeh", accepted: ["le sphinx", "sphinx"], category: "Monuments" },
  // 🌍 Lieux
  { id: "machu", wiki: "Machu Picchu", wikiEn: "Machu Picchu", question: "Quel est ce lieu ?", answer: "Machu Picchu", category: "Lieux" },
  { id: "petra", wiki: "Pétra", wikiEn: "Petra", question: "Quel est ce lieu ?", answer: "Pétra", category: "Lieux" },
  { id: "santorin", wiki: "Santorin", wikiEn: "Santorini", question: "Quel est ce lieu ?", answer: "Santorin", category: "Lieux" },
  // 🎲 Objets
  { id: "rubik", wiki: "Rubik's Cube", wikiEn: "Rubik's Cube", question: "Qu'est-ce que c'est ?", answer: "Rubik's Cube", accepted: ["rubiks cube", "cube rubik"], category: "Objets" },
  { id: "accordeon", wiki: "Accordéon", wikiEn: "Accordion", question: "Quel est cet instrument ?", answer: "Accordéon", category: "Objets" },
  { id: "sushi", wiki: "Sushi", wikiEn: "Sushi", question: "Quel est ce plat ?", answer: "Sushi", category: "Nourriture" },
  // — extensions —
  { id: "koala", wiki: "Koala", wikiEn: "Koala", question: "Quel est cet animal ?", answer: "Koala", category: "Animaux" },
  { id: "zebre", wiki: "Zèbre", wikiEn: "Zebra", question: "Quel est cet animal ?", answer: "Zèbre", category: "Animaux" },
  { id: "kangourou", wiki: "Kangourou", wikiEn: "Kangaroo", question: "Quel est cet animal ?", answer: "Kangourou", category: "Animaux" },
  { id: "panda", wiki: "Panda géant", wikiEn: "Giant panda", question: "Quel est cet animal ?", answer: "Panda", accepted: ["panda geant"], category: "Animaux" },
  { id: "paon", wiki: "Paon bleu", wikiEn: "Indian peafowl", question: "Quel est cet animal ?", answer: "Paon", category: "Animaux" },
  { id: "herisson", wiki: "Hérisson", wikiEn: "Hedgehog", question: "Quel est cet animal ?", answer: "Hérisson", category: "Animaux" },
  { id: "loutre", wiki: "Loutre", wikiEn: "Otter", question: "Quel est cet animal ?", answer: "Loutre", category: "Animaux" },
  { id: "ecureuil", wiki: "Écureuil", wikiEn: "Squirrel", question: "Quel est cet animal ?", answer: "Écureuil", category: "Animaux" },
  { id: "girafe", wiki: "Girafe", wikiEn: "Giraffe", question: "Quel est cet animal ?", answer: "Girafe", category: "Animaux" },
  { id: "hippopo", wiki: "Hippopotame", wikiEn: "Hippopotamus", question: "Quel est cet animal ?", answer: "Hippopotame", accepted: ["hippo"], category: "Animaux" },
  // Monuments / lieux
  { id: "goldengate", wiki: "Golden Gate Bridge", wikiEn: "Golden Gate Bridge", question: "Quel est ce monument ?", answer: "Golden Gate", accepted: ["golden gate bridge", "pont du golden gate"], category: "Monuments" },
  { id: "sydney", wiki: "Opéra de Sydney", wikiEn: "Sydney Opera House", question: "Quel est ce monument ?", answer: "Opéra de Sydney", accepted: ["sydney opera house"], category: "Monuments" },
  { id: "angkor", wiki: "Angkor Vat", wikiEn: "Angkor Wat", question: "Quel est ce lieu ?", answer: "Angkor Vat", accepted: ["angkor"], category: "Lieux" },
  { id: "parthenon", wiki: "Parthénon", wikiEn: "Parthenon", question: "Quel est ce monument ?", answer: "Parthénon", accepted: ["acropole"], category: "Monuments" },
  { id: "muraille", wiki: "Grande Muraille", wikiEn: "Great Wall of China", question: "Quel est ce monument ?", answer: "Grande Muraille de Chine", accepted: ["muraille de chine", "grande muraille"], category: "Monuments" },
  { id: "chichen", wiki: "Chichén Itzá", wikiEn: "Chichen Itza", question: "Quel est ce lieu ?", answer: "Chichén Itzá", accepted: ["chichen itza"], category: "Lieux" },
  // Objets
  { id: "montgolfiere", wiki: "Montgolfière", wikiEn: "Hot air balloon", question: "Qu'est-ce que c'est ?", answer: "Montgolfière", accepted: ["ballon a air chaud"], category: "Objets" },
  { id: "boussole", wiki: "Boussole", wikiEn: "Compass", question: "Quel est cet objet ?", answer: "Boussole", category: "Objets" },
  // Nourriture
  { id: "bretzel", wiki: "Bretzel", wikiEn: "Pretzel", question: "Quel est cet aliment ?", answer: "Bretzel", category: "Nourriture" },
  { id: "ramen", wiki: "Ramen", wikiEn: "Ramen", question: "Quel est ce plat ?", answer: "Ramen", category: "Nourriture" },
  // — extensions 2 —
  { id: "manchot", wiki: "Manchot empereur", wikiEn: "Emperor penguin", question: "Quel est cet animal ?", answer: "Manchot", accepted: ["pingouin", "manchot empereur"], category: "Animaux" },
  { id: "perroquet", wiki: "Perroquet", wikiEn: "Parrot", question: "Quel est cet animal ?", answer: "Perroquet", category: "Animaux" },
  { id: "tortue", wiki: "Tortue", wikiEn: "Turtle", question: "Quel est cet animal ?", answer: "Tortue", category: "Animaux" },
  { id: "crocodile", wiki: "Crocodile", wikiEn: "Crocodile", question: "Quel est cet animal ?", answer: "Crocodile", category: "Animaux" },
  { id: "kheops", wiki: "Pyramide de Khéops", wikiEn: "Great Pyramid of Giza", question: "Quel est ce monument ?", answer: "Pyramide de Khéops", accepted: ["pyramide de gizeh", "pyramide", "les pyramides"], category: "Monuments" },
  { id: "neuschwanstein", wiki: "Château de Neuschwanstein", wikiEn: "Neuschwanstein Castle", question: "Quel est ce monument ?", answer: "Neuschwanstein", accepted: ["chateau de neuschwanstein"], category: "Monuments" },
  { id: "parapluie", wiki: "Parapluie", wikiEn: "Umbrella", question: "Quel est cet objet ?", answer: "Parapluie", category: "Objets" },
  { id: "pizza", wiki: "Pizza", wikiEn: "Pizza", question: "Quel est ce plat ?", answer: "Pizza", category: "Nourriture" },
  // ═══ PERSONNALITÉS — Musique ═══
  { id: "mj", wiki: "Michael Jackson", wikiEn: "Michael Jackson", question: "Qui est cette personnalité ?", answer: "Michael Jackson", accepted: ["mj"], category: "Personnalités" },
  { id: "freddie", wiki: "Freddie Mercury", wikiEn: "Freddie Mercury", question: "Qui est ce chanteur ?", answer: "Freddie Mercury", accepted: ["mercury"], category: "Personnalités" },
  { id: "marley", wiki: "Bob Marley", wikiEn: "Bob Marley", question: "Qui est ce chanteur ?", answer: "Bob Marley", accepted: ["marley"], category: "Personnalités" },
  { id: "elvis", wiki: "Elvis Presley", wikiEn: "Elvis Presley", question: "Qui est ce chanteur ?", answer: "Elvis Presley", accepted: ["elvis"], category: "Personnalités" },
  { id: "beyonce", wiki: "Beyoncé", wikiEn: "Beyoncé", question: "Qui est cette chanteuse ?", answer: "Beyoncé", category: "Personnalités" },
  { id: "rihanna", wiki: "Rihanna", wikiEn: "Rihanna", question: "Qui est cette chanteuse ?", answer: "Rihanna", category: "Personnalités" },
  { id: "eminem", wiki: "Eminem", wikiEn: "Eminem", question: "Qui est ce rappeur ?", answer: "Eminem", category: "Personnalités" },
  // ═══ PERSONNALITÉS — Cinéma ═══
  { id: "dicaprio", wiki: "Leonardo DiCaprio", wikiEn: "Leonardo DiCaprio", question: "Qui est cet acteur ?", answer: "Leonardo DiCaprio", accepted: ["dicaprio", "leo dicaprio"], category: "Personnalités" },
  { id: "willsmith", wiki: "Will Smith", wikiEn: "Will Smith", question: "Qui est cet acteur ?", answer: "Will Smith", category: "Personnalités" },
  { id: "morgan", wiki: "Morgan Freeman", wikiEn: "Morgan Freeman", question: "Qui est cet acteur ?", answer: "Morgan Freeman", category: "Personnalités" },
  { id: "keanu", wiki: "Keanu Reeves", wikiEn: "Keanu Reeves", question: "Qui est cet acteur ?", answer: "Keanu Reeves", category: "Personnalités" },
  { id: "jackiechan", wiki: "Jackie Chan", wikiEn: "Jackie Chan", question: "Qui est cet acteur ?", answer: "Jackie Chan", category: "Personnalités" },
  { id: "tomcruise", wiki: "Tom Cruise", wikiEn: "Tom Cruise", question: "Qui est cet acteur ?", answer: "Tom Cruise", category: "Personnalités" },
  // ═══ PERSONNALITÉS — Sport ═══
  { id: "ronaldo", wiki: "Cristiano Ronaldo", wikiEn: "Cristiano Ronaldo", question: "Qui est ce footballeur ?", answer: "Cristiano Ronaldo", accepted: ["ronaldo", "cr7"], category: "Personnalités" },
  { id: "messi", wiki: "Lionel Messi", wikiEn: "Lionel Messi", question: "Qui est ce footballeur ?", answer: "Lionel Messi", accepted: ["messi"], category: "Personnalités" },
  { id: "zidane", wiki: "Zinédine Zidane", wikiEn: "Zinedine Zidane", question: "Qui est ce footballeur ?", answer: "Zinédine Zidane", accepted: ["zidane", "zizou"], category: "Personnalités" },
  { id: "mbappe", wiki: "Kylian Mbappé", wikiEn: "Kylian Mbappé", question: "Qui est ce footballeur ?", answer: "Kylian Mbappé", accepted: ["mbappe"], category: "Personnalités" },
  { id: "bolt", wiki: "Usain Bolt", wikiEn: "Usain Bolt", question: "Qui est ce sprinteur ?", answer: "Usain Bolt", accepted: ["bolt"], category: "Personnalités" },
  { id: "jordan", wiki: "Michael Jordan", wikiEn: "Michael Jordan", question: "Qui est ce basketteur ?", answer: "Michael Jordan", accepted: ["jordan"], category: "Personnalités" },
  { id: "lebron", wiki: "LeBron James", wikiEn: "LeBron James", question: "Qui est ce basketteur ?", answer: "LeBron James", accepted: ["lebron"], category: "Personnalités" },
  { id: "federer", wiki: "Roger Federer", wikiEn: "Roger Federer", question: "Qui est ce tennisman ?", answer: "Roger Federer", accepted: ["federer"], category: "Personnalités" },
  { id: "nadal", wiki: "Rafael Nadal", wikiEn: "Rafael Nadal", question: "Qui est ce tennisman ?", answer: "Rafael Nadal", accepted: ["nadal"], category: "Personnalités" },
  { id: "serena", wiki: "Serena Williams", wikiEn: "Serena Williams", question: "Qui est cette tenniswoman ?", answer: "Serena Williams", accepted: ["serena"], category: "Personnalités" },
  // ═══ PERSONNALITÉS — Science / Histoire ═══
  { id: "einstein", wiki: "Albert Einstein", wikiEn: "Albert Einstein", question: "Qui est ce scientifique ?", answer: "Albert Einstein", accepted: ["einstein"], category: "Personnalités" },
  { id: "curie", wiki: "Marie Curie", wikiEn: "Marie Curie", question: "Qui est cette scientifique ?", answer: "Marie Curie", accepted: ["curie"], category: "Personnalités" },
  { id: "newton", wiki: "Isaac Newton", wikiEn: "Isaac Newton", question: "Qui est ce scientifique ?", answer: "Isaac Newton", accepted: ["newton"], category: "Personnalités" },
  { id: "hawking", wiki: "Stephen Hawking", wikiEn: "Stephen Hawking", question: "Qui est ce scientifique ?", answer: "Stephen Hawking", accepted: ["hawking"], category: "Personnalités" },
  { id: "tesla", wiki: "Nikola Tesla", wikiEn: "Nikola Tesla", question: "Qui est cet inventeur ?", answer: "Nikola Tesla", accepted: ["tesla"], category: "Personnalités" },
  { id: "darwin", wiki: "Charles Darwin", wikiEn: "Charles Darwin", question: "Qui est ce scientifique ?", answer: "Charles Darwin", accepted: ["darwin"], category: "Personnalités" },
  { id: "mandela", wiki: "Nelson Mandela", wikiEn: "Nelson Mandela", question: "Qui est ce personnage historique ?", answer: "Nelson Mandela", accepted: ["mandela"], category: "Personnalités" },
  { id: "obama", wiki: "Barack Obama", wikiEn: "Barack Obama", question: "Qui est cette personnalité ?", answer: "Barack Obama", accepted: ["obama"], category: "Personnalités" },
  { id: "churchill", wiki: "Winston Churchill", wikiEn: "Winston Churchill", question: "Qui est ce personnage historique ?", answer: "Winston Churchill", accepted: ["churchill"], category: "Personnalités" },
  { id: "lincoln", wiki: "Abraham Lincoln", wikiEn: "Abraham Lincoln", question: "Qui est ce personnage historique ?", answer: "Abraham Lincoln", accepted: ["lincoln"], category: "Personnalités" },
  { id: "gandhi", wiki: "Gandhi", wikiEn: "Mahatma Gandhi", question: "Qui est ce personnage historique ?", answer: "Gandhi", accepted: ["mahatma gandhi"], category: "Personnalités" },
  { id: "einstein2", wiki: "Steve Jobs", wikiEn: "Steve Jobs", question: "Qui est cet entrepreneur ?", answer: "Steve Jobs", accepted: ["jobs"], category: "Personnalités" },
  { id: "musk", wiki: "Elon Musk", wikiEn: "Elon Musk", question: "Qui est cet entrepreneur ?", answer: "Elon Musk", accepted: ["musk"], category: "Personnalités" },
  // ═══ PERSONNALITÉS — Art / Écrivains / Musique classique ═══
  { id: "picasso", wiki: "Pablo Picasso", wikiEn: "Pablo Picasso", question: "Qui est ce peintre ?", answer: "Pablo Picasso", accepted: ["picasso"], category: "Personnalités" },
  { id: "vangogh", wiki: "Vincent van Gogh", wikiEn: "Vincent van Gogh", question: "Qui est ce peintre ?", answer: "Van Gogh", accepted: ["vincent van gogh"], category: "Personnalités" },
  { id: "davinci", wiki: "Léonard de Vinci", wikiEn: "Leonardo da Vinci", question: "Qui est ce génie de la Renaissance ?", answer: "Léonard de Vinci", accepted: ["de vinci", "da vinci"], category: "Personnalités" },
  { id: "shakespeare", wiki: "William Shakespeare", wikiEn: "William Shakespeare", question: "Qui est cet écrivain ?", answer: "Shakespeare", category: "Personnalités" },
  { id: "mozart", wiki: "Wolfgang Amadeus Mozart", wikiEn: "Wolfgang Amadeus Mozart", question: "Qui est ce compositeur ?", answer: "Mozart", category: "Personnalités" },
  { id: "beethoven", wiki: "Ludwig van Beethoven", wikiEn: "Ludwig van Beethoven", question: "Qui est ce compositeur ?", answer: "Beethoven", category: "Personnalités" },
  // ═══ ŒUVRES D'ART (domaine public) ═══
  { id: "joconde", wiki: "La Joconde", wikiEn: "Mona Lisa", question: "Quelle est cette œuvre ?", answer: "La Joconde", accepted: ["joconde", "mona lisa"], category: "Art" },
  { id: "nuitetoilee", wiki: "La Nuit étoilée", wikiEn: "The Starry Night", question: "Quelle est cette œuvre ?", answer: "La Nuit étoilée", accepted: ["nuit etoilee"], category: "Art" },
  { id: "lecri", wiki: "Le Cri", wikiEn: "The Scream", question: "Quelle est cette œuvre ?", answer: "Le Cri", category: "Art" },
  { id: "perle", wiki: "La Jeune Fille à la perle", wikiEn: "Girl with a Pearl Earring", question: "Quelle est cette œuvre ?", answer: "La Jeune Fille à la perle", accepted: ["jeune fille a la perle"], category: "Art" },
  { id: "liberte", wiki: "La Liberté guidant le peuple", wikiEn: "Liberty Leading the People", question: "Quelle est cette œuvre ?", answer: "La Liberté guidant le peuple", accepted: ["la liberte guidant le peuple"], category: "Art" },
  { id: "meduse", wiki: "Le Radeau de la Méduse", wikiEn: "The Raft of the Medusa", question: "Quelle est cette œuvre ?", answer: "Le Radeau de la Méduse", accepted: ["radeau de la meduse"], category: "Art" },
  // ═══ ASTRONOMIE ═══
  { id: "saturne", wiki: "Saturne (planète)", wikiEn: "Saturn", question: "Quelle est cette planète ?", answer: "Saturne", category: "Astronomie" },
  { id: "jupiter", wiki: "Jupiter (planète)", wikiEn: "Jupiter", question: "Quelle est cette planète ?", answer: "Jupiter", category: "Astronomie" },
  { id: "mars", wiki: "Mars (planète)", wikiEn: "Mars", question: "Quelle est cette planète ?", answer: "Mars", category: "Astronomie" },
  { id: "lune", wiki: "Lune", wikiEn: "Moon", question: "Quel est cet astre ?", answer: "Lune", category: "Astronomie" },
  { id: "voielactee", wiki: "Voie lactée", wikiEn: "Milky Way", question: "Qu'est-ce que c'est ?", answer: "Voie lactée", accepted: ["la voie lactee"], category: "Astronomie" },
  // ═══ NATURE / PLANTES ═══
  { id: "tournesol", wiki: "Tournesol", wikiEn: "Common sunflower", question: "Quelle est cette fleur ?", answer: "Tournesol", category: "Nature" },
  { id: "cactus", wiki: "Cactus", wikiEn: "Cactus", question: "Quelle est cette plante ?", answer: "Cactus", category: "Nature" },
  { id: "baobab", wiki: "Baobab", wikiEn: "Adansonia", question: "Quel est cet arbre ?", answer: "Baobab", category: "Nature" },
  { id: "bambou", wiki: "Bambou", wikiEn: "Bamboo", question: "Quelle est cette plante ?", answer: "Bambou", category: "Nature" },
  // ═══ INSTRUMENTS ═══
  { id: "violon", wiki: "Violon", wikiEn: "Violin", question: "Quel est cet instrument ?", answer: "Violon", category: "Instruments" },
  { id: "trompette", wiki: "Trompette", wikiEn: "Trumpet", question: "Quel est cet instrument ?", answer: "Trompette", category: "Instruments" },
  { id: "saxophone", wiki: "Saxophone", wikiEn: "Saxophone", question: "Quel est cet instrument ?", answer: "Saxophone", accepted: ["saxo"], category: "Instruments" },
  { id: "harpe", wiki: "Harpe", wikiEn: "Harp", question: "Quel est cet instrument ?", answer: "Harpe", category: "Instruments" },
  // ═══ VÉHICULES ═══
  { id: "helico", wiki: "Hélicoptère", wikiEn: "Helicopter", question: "Quel est ce véhicule ?", answer: "Hélicoptère", accepted: ["helico"], category: "Véhicules" },
  { id: "voilier", wiki: "Voilier", wikiEn: "Sailing ship", question: "Quel est ce véhicule ?", answer: "Voilier", accepted: ["bateau a voile"], category: "Véhicules" },
  { id: "sousmarin", wiki: "Sous-marin", wikiEn: "Submarine", question: "Quel est ce véhicule ?", answer: "Sous-marin", category: "Véhicules" },
  // ═══ MONUMENTS supplémentaires ═══
  { id: "burj", wiki: "Burj Khalifa", wikiEn: "Burj Khalifa", question: "Quel est ce gratte-ciel ?", answer: "Burj Khalifa", category: "Monuments" },
  { id: "notredame", wiki: "Notre-Dame de Paris", wikiEn: "Notre-Dame de Paris", question: "Quel est ce monument ?", answer: "Notre-Dame de Paris", accepted: ["notre dame"], category: "Monuments" },
  { id: "arctriomphe", wiki: "Arc de triomphe de l'Étoile", wikiEn: "Arc de Triomphe", question: "Quel est ce monument ?", answer: "Arc de triomphe", category: "Monuments" },
  // EXTENSIONS — sujets à images libres fiables (moins d'animaux)
  { id: "statue-liberte", wiki: "Statue de la Liberté", wikiEn: "Statue of Liberty", question: "Quel monument ?", answer: "Statue de la Liberté", accepted: ["statue de la liberte"], category: "Monuments" },
  { id: "big-ben", wiki: "Big Ben", wikiEn: "Big Ben", question: "Quel monument ?", answer: "Big Ben", category: "Monuments" },
  { id: "taj-mahal", wiki: "Taj Mahal", wikiEn: "Taj Mahal", question: "Quel monument ?", answer: "Taj Mahal", category: "Monuments" },
  { id: "sydney-opera", wiki: "Opéra de Sydney", wikiEn: "Sydney Opera House", question: "Quel bâtiment ?", answer: "Opéra de Sydney", accepted: ["opera de sydney"], category: "Monuments" },
  { id: "mont-saint-michel", wiki: "Mont-Saint-Michel", wikiEn: "Mont-Saint-Michel", question: "Quel lieu ?", answer: "Mont-Saint-Michel", accepted: ["mont saint michel"], category: "Monuments" },
  { id: "golden-gate", wiki: "Golden Gate Bridge", wikiEn: "Golden Gate Bridge", question: "Quel pont ?", answer: "Golden Gate", accepted: ["golden gate bridge", "le golden gate"], category: "Monuments" },
  { id: "christ-redempteur", wiki: "Christ Rédempteur", wikiEn: "Christ the Redeemer", question: "Quelle statue ?", answer: "Christ Rédempteur", accepted: ["christ redempteur", "le christ redempteur"], category: "Monuments" },
  { id: "machu-picchu", wiki: "Machu Picchu", wikiEn: "Machu Picchu", question: "Quel site ?", answer: "Machu Picchu", category: "Lieux" },
  { id: "chateau-chambord", wiki: "Château de Chambord", wikiEn: "Château de Chambord", question: "Quel château ?", answer: "Chambord", accepted: ["chateau de chambord", "le chateau de chambord"], category: "Monuments" },
  { id: "sagrada-familia", wiki: "Sagrada Família", wikiEn: "Sagrada Família", question: "Quel monument ?", answer: "Sagrada Família", accepted: ["sagrada familia", "la sagrada familia"], category: "Monuments" },
  { id: "moai", wiki: "Moai", wikiEn: "Moai", question: "Que sont ces statues (île de Pâques) ?", answer: "Moaï", accepted: ["moai", "statues de l'ile de paques"], category: "Lieux" },
  { id: "soleil", wiki: "Soleil", wikiEn: "Sun", question: "Quel astre ?", answer: "Soleil", accepted: ["le soleil"], category: "Astronomie" },
  { id: "aurore-boreale", wiki: "Aurore polaire", wikiEn: "Aurora", question: "Quel phénomène ?", answer: "Aurore boréale", accepted: ["aurore boreale", "aurore polaire"], category: "Nature" },
  { id: "grand-canyon", wiki: "Grand Canyon", wikiEn: "Grand Canyon", question: "Quel lieu ?", answer: "Grand Canyon", accepted: ["le grand canyon"], category: "Nature" },
  { id: "chutes-niagara", wiki: "Chutes du Niagara", wikiEn: "Niagara Falls", question: "Quel lieu ?", answer: "Chutes du Niagara", accepted: ["niagara", "les chutes du niagara"], category: "Nature" },
  { id: "tournesol-f", wiki: "Tournesol", wikiEn: "Sunflower", question: "Quelle fleur ?", answer: "Tournesol", accepted: ["le tournesol"], category: "Nature" },
  { id: "croissant", wiki: "Croissant", wikiEn: "Croissant", question: "Quelle viennoiserie ?", answer: "Croissant", accepted: ["un croissant"], category: "Nourriture" },
  { id: "hamburger", wiki: "Hamburger", wikiEn: "Hamburger", question: "Quel plat ?", answer: "Hamburger", accepted: ["burger", "un hamburger"], category: "Nourriture" },
  { id: "baguette", wiki: "Baguette (pain)", wikiEn: "Baguette", question: "Quel aliment ?", answer: "Baguette", accepted: ["une baguette", "baguette de pain"], category: "Nourriture" },
  { id: "macaron", wiki: "Macaron", wikiEn: "Macaron", question: "Quelle pâtisserie ?", answer: "Macaron", accepted: ["des macarons", "un macaron"], category: "Nourriture" },
  { id: "montgolfiere-o", wiki: "Montgolfière", wikiEn: "Hot air balloon", question: "Quel engin volant ?", answer: "Montgolfière", accepted: ["une montgolfiere", "montgolfiere"], category: "Véhicules" },
  { id: "guitare-i", wiki: "Guitare", wikiEn: "Guitar", question: "Quel instrument ?", answer: "Guitare", accepted: ["une guitare"], category: "Instruments" },
  { id: "piano-i", wiki: "Piano", wikiEn: "Piano", question: "Quel instrument ?", answer: "Piano", accepted: ["un piano"], category: "Instruments" },
  { id: "saxophone-i", wiki: "Saxophone", wikiEn: "Saxophone", question: "Quel instrument ?", answer: "Saxophone", accepted: ["un saxophone", "saxo"], category: "Instruments" },
  { id: "accordeon-i", wiki: "Accordéon", wikiEn: "Accordion", question: "Quel instrument ?", answer: "Accordéon", accepted: ["accordeon", "un accordeon"], category: "Instruments" },
  { id: "nuit-etoilee", wiki: "La Nuit étoilée", wikiEn: "The Starry Night", question: "Quelle œuvre ?", answer: "La Nuit étoilée", accepted: ["nuit etoilee", "la nuit etoilee", "starry night"], category: "Art" },
  { id: "le-cri", wiki: "Le Cri", wikiEn: "The Scream", question: "Quelle œuvre ?", answer: "Le Cri", accepted: ["le cri", "the scream"], category: "Art" },
  { id: "la-liberte", wiki: "La Liberté guidant le peuple", wikiEn: "Liberty Leading the People", question: "Quelle œuvre ?", answer: "La Liberté guidant le peuple", accepted: ["la liberte guidant le peuple"], category: "Art" },
  { id: "tgv", wiki: "TGV", wikiEn: "TGV", question: "Quel train ?", answer: "TGV", accepted: ["le tgv"], category: "Véhicules" },
  { id: "gondole", wiki: "Gondole (barque)", wikiEn: "Gondola", question: "Quelle embarcation (Venise) ?", answer: "Gondole", accepted: ["une gondole", "gondole de venise"], category: "Véhicules" },
];

/** Pick `count` distinct items at random, categories mixed. */
export function pickItems(count: number, rng: () => number = Math.random, category?: string): RecoItem[] {
  let pool = RECO_BANK;
  if (category && category !== "all") {
    const f = pool.filter((q) => q.category === category);
    if (f.length >= Math.min(count, 3)) pool = f;
  } else {
    // Default (all): drop "Personnalités" — real-people photos are often
    // copyrighted, so Wikipedia returns no free image and the round dead-ends.
    // They stay available if the host explicitly picks that category.
    pool = pool.filter((q) => q.category !== "Personnalités");
  }
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(1, Math.min(count, a.length)));
}
