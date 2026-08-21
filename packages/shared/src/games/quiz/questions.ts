// Quiz question bank. Types are extensible (mcq / truefalse / free); more kinds
// (image, audio, estimation…) can be added later without touching the engine.
// Drawn PURELY at random across categories — no difficulty rating (like draw).

export type QuizType = "mcq" | "truefalse" | "free";

interface Base { id: string; type: QuizType; cat: string; prompt: string }
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

// prettier-ignore
export const QUIZ_BANK: Question[] = [
  // Jeux vidéo
  { id: "vg1", type: "mcq", cat: "Jeux vidéo", prompt: "Dans quel jeu trouve-t-on Pikachu ?", choices: ["Zelda", "Pokémon", "Mario", "Sonic"], answer: 1 },
  { id: "vg2", type: "free", cat: "Jeux vidéo", prompt: "Quel est le vrai prénom de Mario ?", answer: "Mario Mario", aliases: ["mario"] },
  { id: "vg3", type: "mcq", cat: "Jeux vidéo", prompt: "Quelle société a créé la console PlayStation ?", choices: ["Microsoft", "Nintendo", "Sony", "Sega"], answer: 2 },
  { id: "vg4", type: "free", cat: "Jeux vidéo", prompt: "Quel personnage bleu court très vite chez SEGA ?", answer: "Sonic" },
  { id: "vg5", type: "truefalse", cat: "Jeux vidéo", prompt: "Minecraft a été créé par Mojang.", answer: true },
  { id: "vg6", type: "mcq", cat: "Jeux vidéo", prompt: "Dans Fortnite, comment s'appelle la zone qui rétrécit ?", choices: ["Le mur", "La tempête", "Le brouillard", "La zone"], answer: 1 },
  { id: "vg7", type: "free", cat: "Jeux vidéo", prompt: "Quelle princesse Mario doit-il souvent sauver ?", answer: "Peach", aliases: ["princesse peach"] },
  // Films
  { id: "fi1", type: "free", cat: "Films", prompt: "Quel personnage dit « Je suis ton père » ?", answer: "Dark Vador", aliases: ["darth vader", "vador"] },
  { id: "fi2", type: "mcq", cat: "Films", prompt: "Qui a réalisé « Titanic » ?", choices: ["Spielberg", "James Cameron", "Nolan", "Tarantino"], answer: 1 },
  { id: "fi3", type: "free", cat: "Films", prompt: "Quel est le nom du célèbre ogre vert de DreamWorks ?", answer: "Shrek" },
  { id: "fi4", type: "truefalse", cat: "Films", prompt: "Dans « Le Roi Lion », Simba est un tigre.", answer: false },
  { id: "fi5", type: "mcq", cat: "Films", prompt: "Dans quel film voit-on un anneau à détruire ?", choices: ["Harry Potter", "Le Seigneur des Anneaux", "Narnia", "Avatar"], answer: 1 },
  { id: "fi6", type: "free", cat: "Films", prompt: "Comment s'appelle le sorcier à lunettes rondes de Poudlard ?", answer: "Harry Potter", aliases: ["harry"] },
  // Séries
  { id: "se1", type: "free", cat: "Séries", prompt: "Dans « Breaking Bad », quel est le surnom de Walter White ?", answer: "Heisenberg" },
  { id: "se2", type: "mcq", cat: "Séries", prompt: "Dans « Game of Thrones », quelle maison a pour devise « Winter is coming » ?", choices: ["Lannister", "Stark", "Targaryen", "Baratheon"], answer: 1 },
  { id: "se3", type: "truefalse", cat: "Séries", prompt: "« Stranger Things » se déroule dans les années 80.", answer: true },
  // Anime / Manga
  { id: "an1", type: "free", cat: "Anime", prompt: "Quel ninja blond veut devenir Hokage ?", answer: "Naruto" },
  { id: "an2", type: "mcq", cat: "Anime", prompt: "Dans « Dragon Ball », comment s'appelle le héros principal ?", choices: ["Vegeta", "Goku", "Piccolo", "Krillin"], answer: 1 },
  { id: "an3", type: "free", cat: "Anime", prompt: "Dans « One Piece », comment s'appelle le héros au chapeau de paille ?", answer: "Luffy", aliases: ["monkey d luffy"] },
  { id: "an4", type: "truefalse", cat: "Anime", prompt: "Pokémon est à l'origine un anime japonais.", answer: true },
  // Musique
  { id: "mu1", type: "mcq", cat: "Musique", prompt: "Quel groupe a chanté « Bohemian Rhapsody » ?", choices: ["The Beatles", "Queen", "Nirvana", "U2"], answer: 1 },
  { id: "mu2", type: "free", cat: "Musique", prompt: "Quel instrument à 6 cordes joue-t-on avec un médiator ?", answer: "Guitare" },
  { id: "mu3", type: "truefalse", cat: "Musique", prompt: "Un piano possède 88 touches.", answer: true },
  // Internet / Culture pop
  { id: "in1", type: "mcq", cat: "Internet", prompt: "Quel réseau est connu pour ses vidéos courtes et sa danse ?", choices: ["LinkedIn", "TikTok", "Reddit", "Twitch"], answer: 1 },
  { id: "in2", type: "free", cat: "Internet", prompt: "Sur quelle plateforme les « streamers » diffusent-ils surtout en direct ?", answer: "Twitch" },
  { id: "in3", type: "truefalse", cat: "Internet", prompt: "Un « GIF » est une image animée.", answer: true },
  // Sport
  { id: "sp1", type: "mcq", cat: "Sport", prompt: "Combien de joueurs dans une équipe de football sur le terrain ?", choices: ["9", "10", "11", "12"], answer: 2 },
  { id: "sp2", type: "free", cat: "Sport", prompt: "Quel sport se joue à Roland-Garros ?", answer: "Tennis" },
  { id: "sp3", type: "truefalse", cat: "Sport", prompt: "Un marathon fait environ 42 kilomètres.", answer: true },
  { id: "sp4", type: "mcq", cat: "Sport", prompt: "Dans quel sport marque-t-on un « touchdown » ?", choices: ["Rugby", "Football américain", "Basket", "Hockey"], answer: 1 },
  // Histoire
  { id: "hi1", type: "mcq", cat: "Histoire", prompt: "En quelle année a eu lieu la Révolution française ?", choices: ["1689", "1789", "1815", "1914"], answer: 1 },
  { id: "hi2", type: "free", cat: "Histoire", prompt: "Quel empereur français est associé à la bataille de Waterloo ?", answer: "Napoléon", aliases: ["napoleon bonaparte", "bonaparte"] },
  { id: "hi3", type: "truefalse", cat: "Histoire", prompt: "La Grande Muraille de Chine est visible à l'œil nu depuis la Lune.", answer: false },
  // Géographie
  { id: "ge1", type: "free", cat: "Géographie", prompt: "Quel est le plus grand pays du monde (en superficie) ?", answer: "Russie" },
  { id: "ge2", type: "mcq", cat: "Géographie", prompt: "Quelle est la capitale de l'Australie ?", choices: ["Sydney", "Melbourne", "Canberra", "Perth"], answer: 2 },
  { id: "ge3", type: "free", cat: "Géographie", prompt: "Quel est le plus grand océan du monde ?", answer: "Pacifique", aliases: ["ocean pacifique"] },
  { id: "ge4", type: "truefalse", cat: "Géographie", prompt: "Le Nil est un fleuve d'Afrique.", answer: true },
  { id: "ge5", type: "mcq", cat: "Géographie", prompt: "Dans quel pays se trouve la tour de Pise ?", choices: ["Espagne", "Italie", "Grèce", "Portugal"], answer: 1 },
  // Sciences
  { id: "sc1", type: "mcq", cat: "Sciences", prompt: "Quelle planète est la plus proche du Soleil ?", choices: ["Vénus", "Mars", "Mercure", "Terre"], answer: 2 },
  { id: "sc2", type: "free", cat: "Sciences", prompt: "Quel gaz les humains respirent-ils pour vivre ?", answer: "Oxygène", aliases: ["dioxygene", "o2"] },
  { id: "sc3", type: "truefalse", cat: "Sciences", prompt: "L'eau bout à 100 °C au niveau de la mer.", answer: true },
  { id: "sc4", type: "mcq", cat: "Sciences", prompt: "Combien de côtés possède un hexagone ?", choices: ["5", "6", "7", "8"], answer: 1 },
  { id: "sc5", type: "free", cat: "Sciences", prompt: "Quel organe pompe le sang dans le corps ?", answer: "Cœur", aliases: ["coeur"] },
  // Nature / insolite
  { id: "na1", type: "truefalse", cat: "Insolite", prompt: "Le poulpe possède trois cœurs.", answer: true },
  { id: "na2", type: "mcq", cat: "Insolite", prompt: "Lequel de ces animaux peut dormir debout ?", choices: ["Le chat", "Le cheval", "Le chien", "Le lapin"], answer: 1 },
  { id: "na3", type: "truefalse", cat: "Insolite", prompt: "Le miel ne se périme jamais.", answer: true },
  { id: "na4", type: "mcq", cat: "Insolite", prompt: "Lequel de ces animaux peut régénérer certains membres ?", choices: ["La grenouille", "L'axolotl", "Le hamster", "Le pigeon"], answer: 1 },
  { id: "na5", type: "truefalse", cat: "Insolite", prompt: "Les bananes sont techniquement des baies.", answer: true },
  { id: "na6", type: "free", cat: "Insolite", prompt: "Quel est l'animal terrestre le plus rapide ?", answer: "Guépard" },
  // Culture générale
  { id: "cg1", type: "mcq", cat: "Culture générale", prompt: "Combien y a-t-il de continents ?", choices: ["5", "6", "7", "8"], answer: 2 },
  { id: "cg2", type: "free", cat: "Culture générale", prompt: "Combien de minutes dans une heure ?", answer: "60", aliases: ["soixante"] },
  { id: "cg3", type: "truefalse", cat: "Culture générale", prompt: "Un triangle a quatre côtés.", answer: false },
  { id: "cg4", type: "mcq", cat: "Culture générale", prompt: "Quelle est la couleur obtenue en mélangeant bleu et jaune ?", choices: ["Vert", "Orange", "Violet", "Marron"], answer: 0 },
  { id: "cg5", type: "free", cat: "Culture générale", prompt: "Quel astre éclaire la Terre le jour ?", answer: "Soleil" },
  { id: "cg6", type: "truefalse", cat: "Culture générale", prompt: "Les chauves-souris sont des mammifères.", answer: true },
  { id: "cg7", type: "mcq", cat: "Culture générale", prompt: "Combien de couleurs dans un arc-en-ciel classique ?", choices: ["5", "6", "7", "9"], answer: 2 },
  // Personnages célèbres
  { id: "pe1", type: "mcq", cat: "Personnages", prompt: "Qui a peint la Joconde ?", choices: ["Picasso", "Van Gogh", "Léonard de Vinci", "Monet"], answer: 2 },
  { id: "pe2", type: "free", cat: "Personnages", prompt: "Quel scientifique a formulé E=mc² ?", answer: "Einstein", aliases: ["albert einstein"] },
  { id: "pe3", type: "truefalse", cat: "Personnages", prompt: "Cléopâtre était une reine d'Égypte.", answer: true },
  // — extensions —
  { id: "vg8", type: "free", cat: "Jeux vidéo", prompt: "Quel plombier moustachu est la mascotte de Nintendo ?", answer: "Mario" },
  { id: "vg9", type: "mcq", cat: "Jeux vidéo", prompt: "Dans Among Us, comment appelle-t-on le traître ?", choices: ["Le fantôme", "L'imposteur", "Le tueur", "L'espion"], answer: 1 },
  { id: "vg10", type: "free", cat: "Jeux vidéo", prompt: "Quel jeu de blocs à construire est le plus vendu de l'histoire ?", answer: "Minecraft" },
  { id: "vg11", type: "truefalse", cat: "Jeux vidéo", prompt: "Zelda est le nom du héros de la série The Legend of Zelda.", answer: false },
  { id: "vg12", type: "mcq", cat: "Jeux vidéo", prompt: "Quel animal est Sonic ?", choices: ["Un renard", "Un hérisson", "Un chat", "Un écureuil"], answer: 1 },
  { id: "fi7", type: "mcq", cat: "Films", prompt: "Dans quel film un jeune garçon lie amitié avec un extraterrestre ?", choices: ["E.T.", "Gremlins", "Alien", "Wall-E"], answer: 0 },
  { id: "fi8", type: "free", cat: "Films", prompt: "Quel super-héros est aussi Bruce Wayne ?", answer: "Batman" },
  { id: "fi9", type: "truefalse", cat: "Films", prompt: "« Toy Story » est un film d'animation Pixar.", answer: true },
  { id: "fi10", type: "free", cat: "Films", prompt: "Quel jouet cowboy est le héros de Toy Story ?", answer: "Woody" },
  { id: "fi11", type: "mcq", cat: "Films", prompt: "Quelle couleur est l'ogre Shrek ?", choices: ["Bleu", "Vert", "Marron", "Gris"], answer: 1 },
  { id: "se4", type: "free", cat: "Séries", prompt: "Dans « The Mandalorian », quel petit personnage vert est très populaire ?", answer: "Grogu", aliases: ["bebe yoda", "baby yoda"] },
  { id: "se5", type: "mcq", cat: "Séries", prompt: "Dans quelle série suit-on la famille Simpson ?", choices: ["Family Guy", "Les Simpson", "South Park", "Rick et Morty"], answer: 1 },
  { id: "se6", type: "truefalse", cat: "Séries", prompt: "« Squid Game » est une série sud-coréenne.", answer: true },
  { id: "an5", type: "free", cat: "Anime", prompt: "Quel garçon veut « tous les attraper » avec ses Pokémon ?", answer: "Sacha", aliases: ["ash", "ash ketchum"] },
  { id: "an6", type: "mcq", cat: "Anime", prompt: "Dans « Demon Slayer », quel est l'élément du souffle de Tanjiro au début ?", choices: ["Le feu", "L'eau", "La foudre", "Le vent"], answer: 1 },
  { id: "an7", type: "truefalse", cat: "Anime", prompt: "« One Piece » parle de pirates.", answer: true },
  { id: "mu4", type: "mcq", cat: "Musique", prompt: "Combien de touches noires et blanches possède un piano ?", choices: ["76", "88", "92", "100"], answer: 1 },
  { id: "mu5", type: "free", cat: "Musique", prompt: "Quel groupe britannique comptait John, Paul, George et Ringo ?", answer: "The Beatles", aliases: ["beatles", "les beatles"] },
  { id: "mu6", type: "truefalse", cat: "Musique", prompt: "Une batterie est un instrument à cordes.", answer: false },
  { id: "in4", type: "free", cat: "Internet", prompt: "Comment appelle-t-on une image humoristique qui se propage sur Internet ?", answer: "Mème", aliases: ["meme"] },
  { id: "in5", type: "mcq", cat: "Internet", prompt: "Quelle plateforme est célèbre pour ses vidéos, rachetée par Google ?", choices: ["Vimeo", "YouTube", "Dailymotion", "Twitch"], answer: 1 },
  { id: "in6", type: "truefalse", cat: "Internet", prompt: "« LOL » signifie « laughing out loud ».", answer: true },
  { id: "sp5", type: "mcq", cat: "Sport", prompt: "Tous les combien d'années ont lieu les Jeux olympiques d'été ?", choices: ["2 ans", "3 ans", "4 ans", "5 ans"], answer: 2 },
  { id: "sp6", type: "free", cat: "Sport", prompt: "Quel sport pratique Lionel Messi ?", answer: "Football", aliases: ["foot", "soccer"] },
  { id: "sp7", type: "truefalse", cat: "Sport", prompt: "Au basket, un panier à trois points vaut plus qu'un panier normal.", answer: true },
  { id: "hi4", type: "mcq", cat: "Histoire", prompt: "Qui était le premier président des États-Unis ?", choices: ["Lincoln", "Washington", "Jefferson", "Roosevelt"], answer: 1 },
  { id: "hi5", type: "free", cat: "Histoire", prompt: "Quel mur est tombé en 1989 en Allemagne ?", answer: "Mur de Berlin", aliases: ["berlin"] },
  { id: "hi6", type: "truefalse", cat: "Histoire", prompt: "Les dinosaures et les humains ont vécu à la même époque.", answer: false },
  { id: "ge6", type: "mcq", cat: "Géographie", prompt: "Quelle est la capitale du Japon ?", choices: ["Kyoto", "Osaka", "Tokyo", "Nagoya"], answer: 2 },
  { id: "ge7", type: "free", cat: "Géographie", prompt: "Sur quel continent se trouve l'Égypte ?", answer: "Afrique" },
  { id: "ge8", type: "truefalse", cat: "Géographie", prompt: "L'Australie est à la fois un pays et un continent.", answer: true },
  { id: "ge9", type: "mcq", cat: "Géographie", prompt: "Quel est le plus long fleuve du monde (selon la mesure classique) ?", choices: ["Amazone", "Nil", "Yangtsé", "Mississippi"], answer: 1 },
  { id: "sc6", type: "mcq", cat: "Sciences", prompt: "Combien de planètes dans le système solaire ?", choices: ["7", "8", "9", "10"], answer: 1 },
  { id: "sc7", type: "free", cat: "Sciences", prompt: "Quelle est la planète rouge ?", answer: "Mars" },
  { id: "sc8", type: "truefalse", cat: "Sciences", prompt: "Le diamant est fait de carbone.", answer: true },
  { id: "sc9", type: "mcq", cat: "Sciences", prompt: "Quel est le symbole chimique de l'or ?", choices: ["Ag", "Au", "Or", "Go"], answer: 1 },
  { id: "sc10", type: "free", cat: "Sciences", prompt: "Combien de pattes possède une araignée ?", answer: "8", aliases: ["huit"] },
  { id: "na7", type: "truefalse", cat: "Insolite", prompt: "Une girafe possède le même nombre de vertèbres cervicales qu'un humain.", answer: true },
  { id: "na8", type: "mcq", cat: "Insolite", prompt: "Quel est l'animal le plus grand du monde ?", choices: ["L'éléphant", "La baleine bleue", "Le requin-baleine", "Le cachalot"], answer: 1 },
  { id: "cg8", type: "free", cat: "Culture générale", prompt: "Combien de jours dans une année non bissextile ?", answer: "365" },
  { id: "cg9", type: "truefalse", cat: "Culture générale", prompt: "Le Soleil est une étoile.", answer: true },
  // — extensions 2 —
  { id: "vg13", type: "mcq", cat: "Jeux vidéo", prompt: "Quelle console est fabriquée par Microsoft ?", choices: ["PlayStation", "Xbox", "Switch", "Wii"], answer: 1 },
  { id: "vg14", type: "truefalse", cat: "Jeux vidéo", prompt: "Pac-Man doit manger des pastilles en évitant des fantômes.", answer: true },
  { id: "fi12", type: "free", cat: "Films", prompt: "Quel lionceau est le héros du « Roi Lion » ?", answer: "Simba" },
  { id: "fi13", type: "mcq", cat: "Films", prompt: "Dans « La Reine des Neiges », quel est le pouvoir d'Elsa ?", choices: ["Le feu", "La glace", "Le vent", "La foudre"], answer: 1 },
  { id: "fi14", type: "truefalse", cat: "Films", prompt: "Dans « Avatar » de James Cameron, l'action se passe sur la lune Pandora.", answer: true },
  { id: "se7", type: "mcq", cat: "Séries", prompt: "Combien de personnages principaux dans « Friends » ?", choices: ["4", "5", "6", "7"], answer: 2 },
  { id: "an8", type: "free", cat: "Anime", prompt: "Dans « Naruto », quel est le village natal du héros ?", answer: "Konoha", aliases: ["village cache de la feuille"] },
  { id: "mu7", type: "mcq", cat: "Musique", prompt: "Quel « roi de la pop » a chanté « Thriller » ?", choices: ["Elvis Presley", "Michael Jackson", "Prince", "Freddie Mercury"], answer: 1 },
  { id: "mu8", type: "truefalse", cat: "Musique", prompt: "Le violon se joue avec un archet.", answer: true },
  { id: "sp8", type: "mcq", cat: "Sport", prompt: "Combien de trous sur un parcours de golf standard ?", choices: ["9", "12", "18", "24"], answer: 2 },
  { id: "sp9", type: "free", cat: "Sport", prompt: "Dans quel pays sont nés les Jeux olympiques antiques ?", answer: "Grèce" },
  { id: "hi7", type: "mcq", cat: "Histoire", prompt: "Quel paquebot a coulé en 1912 après avoir heurté un iceberg ?", choices: ["Lusitania", "Titanic", "Britannic", "Queen Mary"], answer: 1 },
  { id: "hi8", type: "free", cat: "Histoire", prompt: "Qui a peint le plafond de la chapelle Sixtine ?", answer: "Michel-Ange", aliases: ["michelangelo"] },
  { id: "ge10", type: "mcq", cat: "Géographie", prompt: "Quel est le plus grand désert chaud du monde ?", choices: ["Gobi", "Sahara", "Kalahari", "Atacama"], answer: 1 },
  { id: "ge11", type: "free", cat: "Géographie", prompt: "Quelle est la capitale de l'Italie ?", answer: "Rome" },
  { id: "sc11", type: "mcq", cat: "Sciences", prompt: "Quel organe permet de respirer ?", choices: ["Le foie", "Les poumons", "L'estomac", "Les reins"], answer: 1 },
  { id: "sc12", type: "truefalse", cat: "Sciences", prompt: "La lumière voyage plus vite que le son.", answer: true },
  { id: "na9", type: "mcq", cat: "Insolite", prompt: "Quel est le plus petit os du corps humain ?", choices: ["Le fémur", "L'étrier", "La rotule", "La clavicule"], answer: 1 },
  { id: "cg10", type: "truefalse", cat: "Culture générale", prompt: "Un cube possède 6 faces.", answer: true },
  { id: "pe4", type: "mcq", cat: "Personnages", prompt: "Qui a formulé la théorie de la gravitation (avec la légende de la pomme) ?", choices: ["Isaac Newton", "Albert Einstein", "Galilée", "Charles Darwin"], answer: 0 },
];

/** Pick `count` distinct questions at random, categories mixed. */
export function pickQuestions(count: number, rng: () => number = Math.random, types?: QuizType[]): Question[] {
  let pool = QUIZ_BANK;
  if (types && types.length) {
    const set = new Set(types);
    const f = pool.filter((q) => set.has(q.type));
    if (f.length >= Math.min(count, 4)) pool = f;
  }
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(1, Math.min(count, a.length)));
}
