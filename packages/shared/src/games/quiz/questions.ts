// Quiz question bank. Types are extensible (mcq / truefalse / free); more kinds
// (image, audio, estimation…) can be added later without touching the engine.
// Drawn PURELY at random across categories — no difficulty rating (like draw).

export type QuizType = "mcq" | "truefalse" | "free";
export type QuizDifficulty = "easy" | "medium" | "hard";

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
  // EXTENSIONS (plus variées, plus fun)
  { id: "zci10", type: "mcq", cat: "Cinéma", prompt: "Quel réalisateur a fait « Inception » et « Interstellar » ?", choices: ["Spielberg", "Nolan", "Tarantino", "Villeneuve"], answer: 1 },
  { id: "zci11", type: "free", cat: "Cinéma", prompt: "Dans « Le Seigneur des Anneaux », comment s'appelle le volcan où l'on détruit l'anneau ?", answer: "Montagne du Destin", aliases: ["mont destin", "mount doom", "la montagne du destin"] },
  { id: "zci12", type: "truefalse", cat: "Cinéma", prompt: "« Titanic » et « Avatar » ont le même réalisateur.", answer: true },
  { id: "zci13", type: "mcq", cat: "Séries", prompt: "Dans quelle ville se déroule « Breaking Bad » ?", choices: ["Los Angeles", "Albuquerque", "Miami", "Chicago"], answer: 1 },
  { id: "zci14", type: "free", cat: "Séries", prompt: "Quelle maison a pour devise « Winter is coming » dans Game of Thrones ?", answer: "Stark", aliases: ["maison stark", "les stark"] },
  { id: "zmu5", type: "mcq", cat: "Musique", prompt: "Quel groupe a chanté « Bohemian Rhapsody » ?", choices: ["The Beatles", "Queen", "Pink Floyd", "Led Zeppelin"], answer: 1 },
  { id: "zmu6", type: "free", cat: "Musique", prompt: "Combien de cordes a une guitare classique standard ?", answer: "6", aliases: ["six"] },
  { id: "zmu7", type: "truefalse", cat: "Musique", prompt: "Mozart est mort avant l'âge de 40 ans.", answer: true },
  { id: "zge10", type: "mcq", cat: "Géographie", prompt: "Quel est le plus long fleuve du monde ?", choices: ["Amazone", "Nil", "Yangtsé", "Mississippi"], answer: 1 },
  { id: "zge11", type: "free", cat: "Géographie", prompt: "Quelle est la capitale de l'Australie ?", answer: "Canberra" },
  { id: "zge12", type: "mcq", cat: "Géographie", prompt: "Quel pays compte le plus d'habitants ?", choices: ["Chine", "Inde", "États-Unis", "Indonésie"], answer: 1 },
  { id: "zge13", type: "truefalse", cat: "Géographie", prompt: "Le Groenland est réellement plus grand que l'Afrique.", answer: false },
  { id: "zge14", type: "free", cat: "Géographie", prompt: "Sur quel continent se trouve le désert du Sahara ?", answer: "Afrique", aliases: ["l'afrique"] },
  { id: "zge15", type: "mcq", cat: "Géographie", prompt: "Quelle est la plus haute montagne du monde ?", choices: ["K2", "Mont Blanc", "Everest", "Kilimandjaro"], answer: 2 },
  { id: "zsc10", type: "mcq", cat: "Sciences", prompt: "Quel est l'élément chimique de symbole « O » ?", choices: ["Or", "Oxygène", "Osmium", "Ozone"], answer: 1 },
  { id: "zsc11", type: "free", cat: "Sciences", prompt: "Combien de planètes compte le système solaire ?", answer: "8", aliases: ["huit"] },
  { id: "zsc12", type: "truefalse", cat: "Sciences", prompt: "La lumière voyage plus vite que le son.", answer: true },
  { id: "zsc13", type: "mcq", cat: "Sciences", prompt: "Quel organe pompe le sang dans le corps ?", choices: ["Foie", "Cœur", "Poumon", "Rein"], answer: 1 },
  { id: "zsc14", type: "free", cat: "Sciences", prompt: "Quel gaz les plantes absorbent-elles pour la photosynthèse ?", answer: "dioxyde de carbone", aliases: ["co2", "gaz carbonique"] },
  { id: "zsc15", type: "mcq", cat: "Sciences", prompt: "Quelle planète est surnommée la planète rouge ?", choices: ["Vénus", "Mars", "Jupiter", "Saturne"], answer: 1 },
  { id: "zsc16", type: "truefalse", cat: "Sciences", prompt: "Un diamant est composé de carbone.", answer: true },
  { id: "zhi5", type: "mcq", cat: "Histoire", prompt: "En quelle année a eu lieu la Révolution française ?", choices: ["1689", "1789", "1815", "1848"], answer: 1 },
  { id: "zhi6", type: "free", cat: "Histoire", prompt: "Qui était le premier empereur des Français ?", answer: "Napoléon", aliases: ["napoleon", "napoléon bonaparte", "bonaparte"] },
  { id: "zhi7", type: "truefalse", cat: "Histoire", prompt: "La Grande Muraille de Chine est visible à l'œil nu depuis la Lune.", answer: false },
  { id: "zhi8", type: "mcq", cat: "Histoire", prompt: "Quelle civilisation a construit les pyramides de Gizeh ?", choices: ["Les Romains", "Les Égyptiens", "Les Grecs", "Les Mayas"], answer: 1 },
  { id: "zsp5", type: "mcq", cat: "Sport", prompt: "Combien de joueurs par équipe sur un terrain de football ?", choices: ["9", "10", "11", "12"], answer: 2 },
  { id: "zsp6", type: "free", cat: "Sport", prompt: "Tous les combien d'années ont lieu les JO d'été ? (en chiffres)", answer: "4", aliases: ["quatre", "4 ans"] },
  { id: "zsp7", type: "truefalse", cat: "Sport", prompt: "Au tennis, « love » signifie zéro point.", answer: true },
  { id: "zsp8", type: "mcq", cat: "Sport", prompt: "Dans quel sport marque-t-on un « touchdown » ?", choices: ["Rugby", "Football américain", "Basket", "Hockey"], answer: 1 },
  { id: "zvg10", type: "mcq", cat: "Jeux vidéo", prompt: "Dans Minecraft, quelle créature explose près de toi ?", choices: ["Zombie", "Creeper", "Squelette", "Enderman"], answer: 1 },
  { id: "zvg12", type: "truefalse", cat: "Jeux vidéo", prompt: "Tetris a été créé en Union soviétique.", answer: true },
  { id: "zvg13", type: "mcq", cat: "Jeux vidéo", prompt: "Quelle entreprise a créé la PlayStation ?", choices: ["Nintendo", "Sony", "Microsoft", "Sega"], answer: 1 },
  { id: "zin10", type: "free", cat: "Insolite", prompt: "Quel est le plus grand animal du monde ?", answer: "baleine bleue", aliases: ["la baleine bleue", "rorqual bleu"] },
  { id: "zin12", type: "truefalse", cat: "Insolite", prompt: "Le miel ne se périme jamais.", answer: true },
  { id: "zin13", type: "free", cat: "Insolite", prompt: "Bleu + jaune donne quelle couleur ?", answer: "vert", aliases: ["le vert"] },
  { id: "zin14", type: "mcq", cat: "Insolite", prompt: "Quel est l'os le plus long du corps humain ?", choices: ["Tibia", "Fémur", "Humérus", "Radius"], answer: 1 },
  { id: "zin15", type: "truefalse", cat: "Insolite", prompt: "Les poulpes ont trois cœurs.", answer: true },
  { id: "zin16", type: "free", cat: "Insolite", prompt: "Combien de continents y a-t-il ? (en chiffres)", answer: "7", aliases: ["sept"] },
  { id: "zin17", type: "mcq", cat: "Insolite", prompt: "Quel fruit est composé à ~92 % d'eau ?", choices: ["Banane", "Pastèque", "Pomme", "Raisin"], answer: 1 },
  { id: "zga1", type: "free", cat: "Gastronomie", prompt: "De quel pays est originaire la pizza ?", answer: "Italie", aliases: ["l'italie"] },
  { id: "zga2", type: "mcq", cat: "Gastronomie", prompt: "Quel ingrédient est la base du guacamole ?", choices: ["Tomate", "Avocat", "Concombre", "Poivron"], answer: 1 },
  { id: "zla1", type: "free", cat: "Langues", prompt: "Comment dit-on « merci » en espagnol ?", answer: "gracias" },
  { id: "zla2", type: "mcq", cat: "Langues", prompt: "Quelle langue a le plus de locuteurs natifs ?", choices: ["Anglais", "Espagnol", "Mandarin", "Hindi"], answer: 2 },
  { id: "zla3", type: "truefalse", cat: "Langues", prompt: "Le mot « robot » vient du tchèque.", answer: true },

  // ═══ REFONTE : pop-culture + culture générale (difficulté + franchise) ═══
  { id: "pf1", type: "free", cat: "Films", prompt: "Dans quel film un jeune sorcier entre à l'école de Poudlard ?", answer: "Harry Potter", aliases: ["harry potter a l'ecole des sorciers", "harry potter"], difficulty: "easy", franchise: "Harry Potter", subcat: "lieu" },
  { id: "pf2", type: "mcq", cat: "Films", prompt: "Comment s'appelle le majordome de Batman ?", choices: ["Alfred", "Robin", "Lucius", "Gordon"], answer: 0, difficulty: "medium", franchise: "Batman", subcat: "secondaire" },
  { id: "pf3", type: "free", cat: "Films", prompt: "Quel est le nom du vaisseau de Han Solo dans Star Wars ?", answer: "Faucon Millénium", aliases: ["faucon millenium", "millennium falcon", "le faucon millenium"], difficulty: "medium", franchise: "Star Wars", subcat: "objet" },
  { id: "pf4", type: "mcq", cat: "Films", prompt: "Dans « Le Seigneur des Anneaux », qui accompagne Frodon jusqu'au bout ?", choices: ["Sam", "Legolas", "Boromir", "Gimli"], answer: 0, difficulty: "medium", franchise: "Le Seigneur des Anneaux", subcat: "secondaire" },
  { id: "pf5", type: "free", cat: "Films", prompt: "Comment s'appelle le requin… euh, quel objet symbolise « Le Titanic » qui coule ?", answer: "iceberg", aliases: ["un iceberg", "l'iceberg"], difficulty: "easy", franchise: "Titanic", subcat: "objet" },
  { id: "pf6", type: "mcq", cat: "Films", prompt: "Quel acteur incarne Iron Man dans le MCU ?", choices: ["Chris Evans", "Robert Downey Jr.", "Mark Ruffalo", "Chris Hemsworth"], answer: 1, difficulty: "easy", franchise: "Marvel", subcat: "acteur" },
  { id: "pf7", type: "free", cat: "Films", prompt: "Dans « Retour vers le futur », quelle voiture sert de machine à voyager dans le temps ?", answer: "DeLorean", aliases: ["la delorean", "delorean"], difficulty: "medium", franchise: "Retour vers le futur", subcat: "objet" },
  { id: "pf8", type: "mcq", cat: "Films", prompt: "Qui est le grand méchant de la saga Star Wars (masque noir) ?", choices: ["Dark Vador", "Yoda", "Chewbacca", "C-3PO"], answer: 0, difficulty: "easy", franchise: "Star Wars", subcat: "antagoniste" },
  { id: "pf9", type: "free", cat: "Films", prompt: "Dans quelle ville vit Spider-Man ?", answer: "New York", aliases: ["new york city", "nyc"], difficulty: "easy", franchise: "Marvel", subcat: "lieu" },
  { id: "pf10", type: "mcq", cat: "Films", prompt: "Quel film met en scène un anneau à détruire dans un volcan ?", choices: ["Le Hobbit", "Le Seigneur des Anneaux", "Narnia", "Willow"], answer: 1, difficulty: "easy", franchise: "Le Seigneur des Anneaux", subcat: "titre" },
  { id: "pf11", type: "free", cat: "Films", prompt: "Quel personnage dit « Je suis ton père » ?", answer: "Dark Vador", aliases: ["dark vador", "darth vader", "vador"], difficulty: "medium", franchise: "Star Wars", subcat: "citation" },
  { id: "pf12", type: "mcq", cat: "Films", prompt: "Dans « Jurassic Park », que clone-t-on ?", choices: ["Des dinosaures", "Des mammouths", "Des dragons", "Des aliens"], answer: 0, difficulty: "easy", franchise: "Jurassic Park", subcat: "concept" },
  { id: "pf13", type: "mcq", cat: "Films", prompt: "Quel réalisateur a créé « Pulp Fiction » ?", choices: ["Scorsese", "Tarantino", "Spielberg", "Nolan"], answer: 1, difficulty: "hard", franchise: "Pulp Fiction", subcat: "realisateur" },
  { id: "pf14", type: "free", cat: "Films", prompt: "Comment s'appelle le clown terrifiant de « Ça » ?", answer: "Grippe-Sou", aliases: ["grippe sou", "pennywise", "ca"], difficulty: "hard", franchise: "Ça", subcat: "antagoniste" },
  { id: "ps1", type: "mcq", cat: "Séries", prompt: "Dans « Stranger Things », d'où vient le monde parallèle ?", choices: ["Le Monde à l'envers", "Le Vide", "La Zone", "L'Autre Côté"], answer: 0, difficulty: "medium", franchise: "Stranger Things", subcat: "lieu" },
  { id: "ps2", type: "free", cat: "Séries", prompt: "Dans « Game of Thrones », quelle famille vit à Winterfell ?", answer: "Stark", aliases: ["les stark", "maison stark"], difficulty: "medium", franchise: "Game of Thrones", subcat: "secondaire" },
  { id: "ps3", type: "mcq", cat: "Séries", prompt: "Quel est le vrai métier de Walter White dans « Breaking Bad » ?", choices: ["Médecin", "Prof de chimie", "Avocat", "Policier"], answer: 1, difficulty: "medium", franchise: "Breaking Bad", subcat: "personnage" },
  { id: "ps4", type: "free", cat: "Séries", prompt: "Dans « The Mandalorian », comment surnomme-t-on l'enfant (Grogu) ?", answer: "Bébé Yoda", aliases: ["baby yoda", "bebe yoda", "grogu"], difficulty: "easy", franchise: "Star Wars", subcat: "secondaire" },
  { id: "ps5", type: "mcq", cat: "Séries", prompt: "Dans « Friends », quel est le métier de Ross ?", choices: ["Paléontologue", "Cuisinier", "Acteur", "Musicien"], answer: 0, difficulty: "medium", franchise: "Friends", subcat: "personnage" },
  { id: "ps6", type: "free", cat: "Séries", prompt: "Dans « La Casa de Papel », quel surnom porte le cerveau du braquage ?", answer: "Le Professeur", aliases: ["professeur", "el profesor", "le professeur"], difficulty: "medium", franchise: "La Casa de Papel", subcat: "personnage" },
  { id: "ps7", type: "truefalse", cat: "Séries", prompt: "Dans « The Witcher », Geralt est un chasseur de monstres.", answer: true, difficulty: "easy", franchise: "The Witcher" },
  { id: "pa1", type: "free", cat: "Anime", prompt: "Dans quel anime apparaît Itachi Uchiha ?", answer: "Naruto", aliases: ["naruto shippuden", "naruto"], difficulty: "medium", franchise: "Naruto", subcat: "secondaire" },
  { id: "pa2", type: "free", cat: "Anime", prompt: "Dans quel anime trouve-t-on le fruit du démon et le chapeau de paille ?", answer: "One Piece", aliases: ["one piece"], difficulty: "easy", franchise: "One Piece", subcat: "objet" },
  { id: "pa3", type: "mcq", cat: "Anime", prompt: "Quel est le carnet mortel de « Death Note » ?", choices: ["Le Death Note", "Le Soul Book", "Le Kill List", "Le Fate Note"], answer: 0, difficulty: "easy", franchise: "Death Note", subcat: "objet" },
  { id: "pa4", type: "free", cat: "Anime", prompt: "Comment s'appelle le rival de Naruto (Uchiha) ?", answer: "Sasuke", aliases: ["sasuke uchiha", "sasuke"], difficulty: "easy", franchise: "Naruto", subcat: "rival" },
  { id: "pa5", type: "mcq", cat: "Anime", prompt: "Dans « Dragon Ball », quelle transformation rend les cheveux dorés ?", choices: ["Super Saiyan", "Kaioken", "Ultra Instinct", "Kamehameha"], answer: 0, difficulty: "medium", franchise: "Dragon Ball", subcat: "concept" },
  { id: "pa6", type: "free", cat: "Anime", prompt: "Dans « Attack on Titan », comment appelle-t-on les géants ?", answer: "Titans", aliases: ["les titans", "titan"], difficulty: "easy", franchise: "Attack on Titan", subcat: "creature" },
  { id: "pa7", type: "free", cat: "Anime", prompt: "Dans « Demon Slayer », que chasse Tanjiro ?", answer: "des démons", aliases: ["demons", "les demons", "des demons"], difficulty: "medium", franchise: "Demon Slayer", subcat: "concept" },
  { id: "pa8", type: "mcq", cat: "Anime", prompt: "Dans « My Hero Academia », comment appelle-t-on les super-pouvoirs ?", choices: ["Alters", "Nen", "Chakra", "Haki"], answer: 0, difficulty: "hard", franchise: "My Hero Academia", subcat: "concept" },
  { id: "pa9", type: "free", cat: "Anime", prompt: "Dans « Naruto », comment s'appelle le mentor de l'équipe 7 ?", answer: "Kakashi", aliases: ["kakashi hatake", "kakashi"], difficulty: "medium", franchise: "Naruto", subcat: "mentor" },
  { id: "pa10", type: "mcq", cat: "Anime", prompt: "Dans « One Piece », quel est le rêve de Luffy ?", choices: ["Devenir Roi des Pirates", "Trouver l'amour", "Devenir Hokage", "Sauver le monde"], answer: 0, difficulty: "easy", franchise: "One Piece", subcat: "personnage" },
  { id: "pa11", type: "free", cat: "Anime", prompt: "Dans « Jujutsu Kaisen », quelle énergie utilisent les sorciers ?", answer: "énergie occulte", aliases: ["energie occulte", "energie maudite", "cursed energy"], difficulty: "hard", franchise: "Jujutsu Kaisen", subcat: "concept" },
  { id: "pa12", type: "truefalse", cat: "Anime", prompt: "Dans « Hunter x Hunter », l'énergie utilisée s'appelle le Nen.", answer: true, difficulty: "hard", franchise: "Hunter x Hunter" },
  { id: "pa13", type: "free", cat: "Anime", prompt: "Dans « Fullmetal Alchemist », quels frères pratiquent l'alchimie ?", answer: "Elric", aliases: ["les freres elric", "frères elric", "elric"], difficulty: "hard", franchise: "Fullmetal Alchemist", subcat: "personnage" },
  { id: "pa14", type: "mcq", cat: "Anime", prompt: "Dans Pokémon, quel est le premier Pokémon de Sacha ?", choices: ["Pikachu", "Salamèche", "Bulbizarre", "Carapuce"], answer: 0, difficulty: "easy", franchise: "Pokémon", subcat: "personnage" },
  { id: "pan1", type: "free", cat: "Animation", prompt: "Comment s'appelle l'âne dans « Shrek » ?", answer: "L'Âne", aliases: ["ane", "l'ane", "donkey"], difficulty: "medium", franchise: "Shrek", subcat: "secondaire" },
  { id: "pan2", type: "mcq", cat: "Animation", prompt: "Dans « Le Roi Lion », qui est le père de Simba ?", choices: ["Mufasa", "Scar", "Rafiki", "Zazu"], answer: 0, difficulty: "easy", franchise: "Le Roi Lion", subcat: "personnage" },
  { id: "pan3", type: "free", cat: "Animation", prompt: "Dans « Toy Story », comment s'appelle le cow-boy ?", answer: "Woody", aliases: ["woody"], difficulty: "easy", franchise: "Toy Story", subcat: "personnage" },
  { id: "pan4", type: "mcq", cat: "Animation", prompt: "Dans « Nemo », quelle est l'espèce de Nemo ?", choices: ["Poisson-clown", "Requin", "Dauphin", "Thon"], answer: 0, difficulty: "easy", franchise: "Le Monde de Nemo", subcat: "personnage" },
  { id: "pan5", type: "free", cat: "Animation", prompt: "Dans « Le Monde de Nemo », comment s'appelle le poisson bleu amnésique ?", answer: "Dory", aliases: ["dory"], difficulty: "easy", franchise: "Le Monde de Nemo", subcat: "secondaire" },
  { id: "pan6", type: "mcq", cat: "Animation", prompt: "Quel studio a créé « Toy Story » ?", choices: ["Pixar", "DreamWorks", "Ghibli", "Illumination"], answer: 0, difficulty: "medium", franchise: "Toy Story", subcat: "studio" },
  { id: "pan7", type: "free", cat: "Animation", prompt: "Dans « La Reine des Neiges », quelle sœur a des pouvoirs de glace ?", answer: "Elsa", aliases: ["elsa"], difficulty: "easy", franchise: "La Reine des Neiges", subcat: "personnage" },
  { id: "pan8", type: "mcq", cat: "Animation", prompt: "Dans « Aladdin », que peut réaliser le Génie ?", choices: ["Trois vœux", "Voler", "Rendre invisible", "Voir le futur"], answer: 0, difficulty: "easy", franchise: "Aladdin", subcat: "concept" },
  { id: "pan9", type: "free", cat: "Animation", prompt: "Dans « Ratatouille », quel animal veut devenir cuisinier ?", answer: "un rat", aliases: ["rat", "le rat", "remy"], difficulty: "easy", franchise: "Ratatouille", subcat: "personnage" },
  { id: "pan10", type: "mcq", cat: "Animation", prompt: "Dans « Monstres & Cie », qu'est-ce qui alimente la ville ?", choices: ["Les cris/rires des enfants", "Le charbon", "Le soleil", "La peur des monstres"], answer: 0, difficulty: "medium", franchise: "Monstres & Cie", subcat: "concept" },
  { id: "pan11", type: "free", cat: "Animation", prompt: "Quel studio japonais a réalisé « Le Voyage de Chihiro » ?", answer: "Ghibli", aliases: ["studio ghibli", "ghibli"], difficulty: "hard", franchise: "Ghibli", subcat: "studio" },
  { id: "pan12", type: "mcq", cat: "Animation", prompt: "Dans « Vaiana », qui est le demi-dieu tatoué ?", choices: ["Maui", "Moana", "Tamatoa", "Heihei"], answer: 0, difficulty: "medium", franchise: "Vaiana", subcat: "secondaire" },
  { id: "pv1", type: "free", cat: "Jeux vidéo", prompt: "Dans quel jeu construit-on avec des blocs cubiques ?", answer: "Minecraft", aliases: ["minecraft"], difficulty: "easy", franchise: "Minecraft", subcat: "titre" },
  { id: "pv2", type: "mcq", cat: "Jeux vidéo", prompt: "Comment s'appelle la princesse que Mario sauve ?", choices: ["Peach", "Daisy", "Zelda", "Rosalina"], answer: 0, difficulty: "easy", franchise: "Mario", subcat: "personnage" },
  { id: "pv3", type: "free", cat: "Jeux vidéo", prompt: "Dans « The Legend of Zelda », comment s'appelle le héros ?", answer: "Link", aliases: ["link"], difficulty: "medium", franchise: "Zelda", subcat: "personnage" },
  { id: "pv4", type: "mcq", cat: "Jeux vidéo", prompt: "Dans Pokémon, de quel type est Pikachu ?", choices: ["Électrik", "Feu", "Eau", "Plante"], answer: 0, difficulty: "easy", franchise: "Pokémon", subcat: "personnage" },
  { id: "pv5", type: "free", cat: "Jeux vidéo", prompt: "Dans « Minecraft », quelle créature verte explose ?", answer: "Creeper", aliases: ["le creeper", "creeper"], difficulty: "medium", franchise: "Minecraft", subcat: "creature" },
  { id: "pv6", type: "mcq", cat: "Jeux vidéo", prompt: "Quelle entreprise a créé « Mario » ?", choices: ["Nintendo", "Sony", "Sega", "Microsoft"], answer: 0, difficulty: "medium", franchise: "Mario", subcat: "studio" },
  { id: "pv7", type: "free", cat: "Jeux vidéo", prompt: "Dans « Assassin's Creed », quelle organisation combat les Templiers ?", answer: "les Assassins", aliases: ["assassins", "la confrerie", "les assassins"], difficulty: "hard", franchise: "Assassin's Creed", subcat: "organisation" },
  { id: "pv8", type: "mcq", cat: "Jeux vidéo", prompt: "Dans « The Last of Us », quel champignon infecte les humains ?", choices: ["Cordyceps", "Amanite", "Psilocybe", "Truffe"], answer: 0, difficulty: "hard", franchise: "The Last of Us", subcat: "concept" },
  { id: "pv9", type: "truefalse", cat: "Jeux vidéo", prompt: "« Fortnite » est un jeu de type Battle Royale.", answer: true, difficulty: "easy", franchise: "Fortnite" },
  { id: "pv10", type: "free", cat: "Jeux vidéo", prompt: "Dans « Sonic », de quelle couleur est le hérisson ?", answer: "bleu", aliases: ["bleu"], difficulty: "easy", franchise: "Sonic", subcat: "personnage" },
  { id: "pg1", type: "free", cat: "Géographie", prompt: "Quel est le plus petit pays du monde ?", answer: "Vatican", aliases: ["le vatican", "vatican"], difficulty: "hard", subcat: "pays" },
  { id: "pg2", type: "mcq", cat: "Géographie", prompt: "Quel océan est le plus grand ?", choices: ["Atlantique", "Pacifique", "Indien", "Arctique"], answer: 1, difficulty: "medium", subcat: "ocean" },
  { id: "pg3", type: "free", cat: "Géographie", prompt: "Quelle est la capitale du Japon ?", answer: "Tokyo", aliases: ["tokyo"], difficulty: "easy", subcat: "capitale" },
  { id: "pg4", type: "mcq", cat: "Géographie", prompt: "Dans quel pays se trouve le Machu Picchu ?", choices: ["Pérou", "Mexique", "Chili", "Bolivie"], answer: 0, difficulty: "medium", subcat: "lieu" },
  { id: "pg5", type: "free", cat: "Géographie", prompt: "Quel est le plus long fleuve d'Afrique ?", answer: "Nil", aliases: ["le nil", "nil"], difficulty: "medium", subcat: "nature" },
  { id: "pg6", type: "mcq", cat: "Géographie", prompt: "Combien y a-t-il d'océans sur Terre ?", choices: ["3", "4", "5", "6"], answer: 2, difficulty: "medium", subcat: "ocean" },
  { id: "pg7", type: "free", cat: "Géographie", prompt: "Quelle chaîne de montagnes sépare l'Europe de l'Asie ?", answer: "Oural", aliases: ["l'oural", "monts oural", "oural"], difficulty: "hard", subcat: "nature" },
  { id: "ph1", type: "mcq", cat: "Histoire", prompt: "Qui a peint la Joconde ?", choices: ["Michel-Ange", "Léonard de Vinci", "Raphaël", "Botticelli"], answer: 1, difficulty: "medium", subcat: "art" },
  { id: "ph2", type: "free", cat: "Histoire", prompt: "En quelle année l'Homme a-t-il marché sur la Lune ?", answer: "1969", aliases: ["1969"], difficulty: "medium", subcat: "date" },
  { id: "ph3", type: "mcq", cat: "Histoire", prompt: "Quelle civilisation a inventé les hiéroglyphes ?", choices: ["Romaine", "Égyptienne", "Grecque", "Maya"], answer: 1, difficulty: "easy", subcat: "civilisation" },
  { id: "ph4", type: "free", cat: "Histoire", prompt: "Quel mur est tombé en 1989 ?", answer: "mur de Berlin", aliases: ["le mur de berlin", "mur de berlin", "berlin"], difficulty: "medium", subcat: "evenement" },
  { id: "ph5", type: "mcq", cat: "Histoire", prompt: "Qui était le roi de France surnommé le Roi-Soleil ?", choices: ["Louis XIV", "Louis XVI", "François Ier", "Henri IV"], answer: 0, difficulty: "hard", subcat: "personnage" },
  { id: "psc1", type: "free", cat: "Sciences", prompt: "Quelle planète est la plus grande du système solaire ?", answer: "Jupiter", aliases: ["jupiter"], difficulty: "easy", subcat: "espace" },
  { id: "psc2", type: "mcq", cat: "Sciences", prompt: "Quel est le métal liquide à température ambiante ?", choices: ["Mercure", "Fer", "Or", "Plomb"], answer: 0, difficulty: "medium", subcat: "chimie" },
  { id: "psc3", type: "free", cat: "Sciences", prompt: "Combien d'os y a-t-il (environ) dans le corps humain adulte ?", answer: "206", aliases: ["206"], difficulty: "hard", subcat: "corps" },
  { id: "psc4", type: "mcq", cat: "Sciences", prompt: "Quel gaz respirons-nous principalement pour vivre ?", choices: ["Azote", "Oxygène", "Hydrogène", "Hélium"], answer: 1, difficulty: "easy", subcat: "nature" },
  { id: "psc5", type: "truefalse", cat: "Sciences", prompt: "Le son se propage dans le vide de l'espace.", answer: false, difficulty: "medium" },
  { id: "psc6", type: "free", cat: "Sciences", prompt: "Quel scientifique a énoncé E=mc² ?", answer: "Einstein", aliases: ["albert einstein", "einstein"], difficulty: "medium", subcat: "personnage" },
  { id: "psp1", type: "mcq", cat: "Sport", prompt: "Combien de joueurs dans une équipe de basket sur le terrain ?", choices: ["5", "6", "7", "11"], answer: 0, difficulty: "medium", subcat: "regle" },
  { id: "psp2", type: "free", cat: "Sport", prompt: "Quel pays a gagné la Coupe du monde de football 2018 ?", answer: "France", aliases: ["la france", "france"], difficulty: "medium", subcat: "competition" },
  { id: "psp3", type: "mcq", cat: "Sport", prompt: "Dans quel sport utilise-t-on un « ace » ?", choices: ["Tennis", "Football", "Rugby", "Boxe"], answer: 0, difficulty: "medium", subcat: "regle" },
  { id: "psp4", type: "free", cat: "Sport", prompt: "Combien de temps dure un match de football (sans arrêts) ?", answer: "90 minutes", aliases: ["90 min", "90 minutes", "90"], difficulty: "easy", subcat: "regle" },
  { id: "pm1", type: "mcq", cat: "Musique", prompt: "Quel groupe a sorti l'album « Abbey Road » ?", choices: ["The Beatles", "Rolling Stones", "Queen", "U2"], answer: 0, difficulty: "medium", subcat: "groupe" },
  { id: "pm2", type: "free", cat: "Musique", prompt: "Quel est l'instrument à touches noires et blanches ?", answer: "piano", aliases: ["le piano", "piano"], difficulty: "easy", subcat: "instrument" },
  { id: "pt1", type: "mcq", cat: "Technologie", prompt: "Quelle entreprise a créé l'iPhone ?", choices: ["Apple", "Samsung", "Google", "Nokia"], answer: 0, difficulty: "easy", subcat: "entreprise" },
  { id: "pt2", type: "free", cat: "Technologie", prompt: "Que signifie « www » ?", answer: "World Wide Web", aliases: ["world wide web", "www"], difficulty: "medium", subcat: "informatique" },
  { id: "pmk1", type: "mcq", cat: "Marques", prompt: "Quelle marque a pour logo une pomme croquée ?", choices: ["Apple", "Android", "Microsoft", "Blackberry"], answer: 0, difficulty: "easy", subcat: "logo" },
  { id: "pmk2", type: "mcq", cat: "Marques", prompt: "Quel constructeur automobile a un logo à quatre anneaux ?", choices: ["Audi", "BMW", "Mercedes", "Toyota"], answer: 0, difficulty: "medium", subcat: "logo" },
  { id: "pn1", type: "free", cat: "Nourriture", prompt: "De quel pays vient le sushi ?", answer: "Japon", aliases: ["le japon", "japon"], difficulty: "easy", subcat: "origine" },
  { id: "pn2", type: "mcq", cat: "Nourriture", prompt: "Quel ingrédient principal dans le guacamole ?", choices: ["Avocat", "Tomate", "Poivron", "Courgette"], answer: 0, difficulty: "easy", subcat: "ingredient" },

];

/** Pick `count` distinct questions at random, categories mixed. */
export function pickQuestions(count: number, rng: () => number = Math.random, types?: QuizType[]): Question[] {
  let pool = QUIZ_BANK;
  if (types && types.length) {
    const set = new Set(types);
    const f = pool.filter((q) => set.has(q.type));
    if (f.length >= Math.min(count, 4)) pool = f;
  }
  // Shuffle first…
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // …then greedily interleave so we never chain the same category or franchise
  // back-to-back (falls back gracefully when the pool is very homogeneous).
  const want = Math.max(1, Math.min(count, shuffled.length));
  const remaining = [...shuffled];
  const out: Question[] = [];
  while (out.length < want && remaining.length) {
    const prev = out[out.length - 1];
    let idx = prev
      ? remaining.findIndex((q) => q.cat !== prev.cat && (!q.franchise || q.franchise !== prev.franchise))
      : 0;
    if (idx === -1) idx = remaining.findIndex((q) => q.cat !== prev!.cat);
    if (idx === -1) idx = 0;
    out.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return out;
}
