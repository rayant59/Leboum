// ---------------------------------------------------------------------------
// Catalogue des Game Modes — LA fiche d'identité de chaque jeu, source unique
// pour le lobby, l'écran d'annonce, la soirée et le générateur de soirée.
// Ajouter un jeu = ajouter sa fiche ici + son module + sa vue. Rien d'autre.
// ---------------------------------------------------------------------------

/** Familles de jeux (Phase 13 de la feuille de route). */
export type GameCategory = "creatif" | "reflexion" | "social" | "chaos" | "culture";

export const GAME_CATEGORIES: Record<GameCategory, { label: string; tint: string; blurb: string }> = {
  creatif: { label: "Créatif", tint: "#FF4D8D", blurb: "Dessiner, imaginer, deviner." },
  reflexion: { label: "Réflexion", tint: "#8B7DF6", blurb: "Culture, logique et cerveau en surchauffe." },
  social: { label: "Social", tint: "#FFC24B", blurb: "Vos potes, vos secrets, vos votes." },
  chaos: { label: "Chaos", tint: "#FF6B4D", blurb: "Rapide, bruyant, imprévisible." },
  culture: { label: "Culture pop", tint: "#4CC9F0", blurb: "Films, séries, sons et images." },
};

export interface GameModeInfo {
  /** Identifiant du module côté serveur. */
  id: string;
  name: string;
  /** Accroche courte (écran d'annonce, cartes). */
  tagline: string;
  /** Vignette / icône du jeu (chemin public). */
  img: string;
  /** Couleur d'accent. */
  accent: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  /** Durée typique d'une partie, en minutes. */
  durationMin: number;
  /** Règles en 2–4 phrases courtes. */
  rules: string[];
  /** Visible comme jeu à part entière dans le lobby (false = variante d'un autre jeu). */
  listed: boolean;
  /** Jeu parent quand c'est une variante (Faux-artiste → Boum Dessin). */
  parent?: string;
}

const G = (info: GameModeInfo) => info;

export const GAME_CATALOG: Record<string, GameModeInfo> = {
  draw: G({
    id: "draw", name: "Boum Dessin", tagline: "Dessine le mot secret, les autres devinent.",
    img: "/games/draw.png", accent: "#FF4D8D", category: "creatif", minPlayers: 2, maxPlayers: 12, durationMin: 10,
    rules: ["Un joueur dessine un mot secret.", "Les autres le devinent au chat.", "Plus tu trouves vite, plus tu marques."],
    listed: true,
  }),
  fakeartist: G({
    id: "fakeartist", name: "Faux-artiste", tagline: "Un imposteur ignore le mot — démasquez-le au vote.",
    img: "/games/draw.png", accent: "#FF6B6B", category: "creatif", minPlayers: 3, maxPlayers: 12, durationMin: 8,
    rules: ["Tout le monde dessine le même mot.", "Un imposteur a un mot voisin sans le savoir.", "Votez pour le démasquer."],
    listed: false, parent: "draw",
  }),
  relay: G({
    id: "relay", name: "Relais", tagline: "Deux joueurs se relaient au crayon.",
    img: "/games/draw.png", accent: "#4CC9F0", category: "creatif", minPlayers: 3, maxPlayers: 12, durationMin: 8,
    rules: ["Deux dessinateurs se passent le crayon.", "Les autres devinent le mot."],
    listed: false, parent: "draw",
  }),
  phone: G({
    id: "phone", name: "Téléphone cassé", tagline: "Une phrase, un dessin, une description… et tout part en vrille.",
    img: "/games/phone.webp", accent: "#46E0B0", category: "creatif", minPlayers: 3, maxPlayers: 12, durationMin: 10,
    rules: ["Écris une phrase de départ.", "Elle passe de main en main : on dessine ce qu'on lit, on décrit ce qu'on voit.", "À la fin, on dévoile chaque chaîne. Chaque « j'adore » reçu = +100."],
    listed: true,
  }),
  reco: G({
    id: "reco", name: "Œil de Boum", tagline: "Devine le personnage, le film, le lieu…",
    img: "/games/reco.png", accent: "#4CC9F0", category: "creatif", minPlayers: 1, maxPlayers: 12, durationMin: 6,
    rules: ["Une image s'affiche.", "Tape ce que tu reconnais le plus vite possible."],
    listed: true,
  }),
  quiz: G({
    id: "quiz", name: "Ça te parle ?", tagline: "Réponds vite et montre ta culture.",
    img: "/games/quiz.png", accent: "#8B7DF6", category: "reflexion", minPlayers: 1, maxPlayers: 12, durationMin: 6,
    rules: ["Une question, un chrono.", "Bonne réponse = points, rapidité = bonus."],
    listed: true,
  }),
  taboo: G({
    id: "taboo", name: "Mot interdit", tagline: "Fais deviner le mot… sans jamais dire les mots interdits.",
    img: "/games/taboo.webp", accent: "#8B7DF6", category: "reflexion", minPlayers: 3, maxPlayers: 12, durationMin: 8,
    rules: ["À ton tour, fais deviner un maximum de mots avant la fin du chrono.", "Les mots interdits de la carte sont… interdits (−50, carte perdue).", "Mot trouvé : +100 pour toi et +100 pour celui qui trouve."],
    listed: true,
  }),
  guesswho: G({
    id: "guesswho", name: "Devine qui", tagline: "Une personne mystère, 20 questions oui/non pour la démasquer.",
    img: "/games/guesswho.webp", accent: "#4CC9F0", category: "social", minPlayers: 3, maxPlayers: 12, durationMin: 10,
    rules: ["Le Maître du secret connaît une personne mystère.", "Posez-lui des questions : il répond oui, non ou je ne sais pas.", "Le premier qui la trouve : +100, et +10 par question restante."],
    listed: true,
  }),
  ranking: G({
    id: "ranking", name: "Le Top", tagline: "Classe 5 trucs dans le bon ordre. Plus tu colles, plus tu marques.",
    img: "/games/ranking.webp", accent: "#FFC24B", category: "reflexion", minPlayers: 1, maxPlayers: 12, durationMin: 6,
    rules: ["Une consigne : du plus lourd au plus léger, du plus ancien au plus récent…", "Range les 5 éléments avant la fin du chrono.", "Bonne place : +100, à une place près : +50. Sans faute : bonus !"],
    listed: true,
  }),
  whois: G({
    id: "whois", name: "Qui de nous ?", tagline: "Qui est le plus susceptible de… ? Votez !",
    img: "/games/whois.webp", accent: "#FFC24B", category: "social", minPlayers: 3, maxPlayers: 12, durationMin: 6,
    rules: ["Une question : « Qui de nous… ? »", "Vote pour un joueur (jamais toi).", "Vote comme la majorité : +100. L'élu : +50."],
    listed: true,
  }),
  funny: G({
    id: "funny", name: "La Plus Drôle", tagline: "Complète la phrase. La table vote pour la meilleure.",
    img: "/games/funny.webp", accent: "#FF4D8D", category: "social", minPlayers: 3, maxPlayers: 12, durationMin: 8,
    rules: ["Complète la phrase à trous, en secret.", "Les réponses s'affichent sans les auteurs.", "Vote pour la plus drôle (pas la tienne) : +100 par vote."],
    listed: true,
  }),
  imposter: G({
    id: "imposter", name: "Imposteur", tagline: "Un seul n'a pas le mot. Trouvez-le avant qu'il vous enfume.",
    img: "/games/imposter.webp", accent: "#FF5C7A", category: "social", minPlayers: 3, maxPlayers: 12, durationMin: 8,
    rules: ["Tout le monde reçoit le même mot… sauf l'imposteur.", "Chacun donne un indice à son tour, sans dire le mot.", "Votez : démasquer l'imposteur = +100. S'il s'en sort : +250 pour lui."],
    listed: true,
  }),
  yesno: G({
    id: "yesno", name: "Ni oui ni non", tagline: "Bombarde la cible de questions jusqu'à ce qu'elle craque.",
    img: "/games/yesno.webp", accent: "#FF6B4D", category: "social", minPlayers: 3, maxPlayers: 12, durationMin: 5,
    rules: ["Chacun son tour, un joueur est la cible.", "Les autres l'interrogent pour lui faire dire OUI ou NON.", "Elle marque à chaque seconde tenue ; celui qui la fait craquer : +150."],
    listed: true,
  }),
  bombe: G({
    id: "bombe", name: "Boum Rush", tagline: "Trouve un mot avec la syllabe avant l'explosion.",
    img: "/games/bombe.webp", accent: "#FF6B4D", category: "chaos", minPlayers: 2, maxPlayers: 12, durationMin: 5,
    rules: ["La bombe passe de main en main.", "Tape un mot contenant la syllabe.", "Si elle explose sur toi, tu perds une vie."],
    listed: true,
  }),
  pixel: G({
    id: "pixel", name: "Pixel Panic", tagline: "L'image se dévoile pixel par pixel.",
    img: "/games/pixel.png", accent: "#46E0B0", category: "chaos", minPlayers: 1, maxPlayers: 12, durationMin: 6,
    rules: ["Une image se révèle petit à petit.", "Le premier à trouver marque le plus."],
    listed: true,
  }),
  mimic: G({
    id: "mimic", name: "Mimic Boum", tagline: "Imite un son avec ta voix — une seule prise.",
    img: "/games/mimic.png", accent: "#46E0B0", category: "culture", minPlayers: 2, maxPlayers: 8, durationMin: 8,
    rules: ["Écoute un son culte.", "Imite-le en une seule prise.", "Votez pour la meilleure imitation."],
    listed: true,
  }),
  doublage: G({
    id: "doublage", name: "Doublage", tagline: "Double la scène à ta façon.",
    img: "/games/doublage.png", accent: "#FFC24B", category: "culture", minPlayers: 2, maxPlayers: 10, durationMin: 10,
    rules: ["Chacun reçoit un personnage.", "Doublez la scène en direct."],
    listed: false,
  }),
  subtitles: G({
    id: "subtitles", name: "Sous-titres", tagline: "Invente les meilleures répliques.",
    img: "/games/subtitles.png", accent: "#FFC24B", category: "culture", minPlayers: 3, maxPlayers: 12, durationMin: 10,
    rules: ["Un extrait muet passe.", "Écris le sous-titre le plus drôle.", "Votez anonymement."],
    listed: false,
  }),
};

/** Fiche d'un jeu, avec un repli neutre pour un identifiant inconnu. */
export function gameInfo(id: string | null | undefined): GameModeInfo {
  return (id && GAME_CATALOG[id]) || {
    id: id ?? "?", name: "Prochain jeu", tagline: "", img: "/games/draw.png", accent: "#FFC24B",
    category: "chaos", minPlayers: 1, maxPlayers: 12, durationMin: 5, rules: [], listed: false,
  };
}

/** Jeux proposés dans le lobby, dans l'ordre d'affichage. */
export function listedGames(): GameModeInfo[] {
  return Object.values(GAME_CATALOG).filter((g) => g.listed);
}

/** Ordre d'affichage des familles (feuille de route, phase 13). */
export const CATEGORY_ORDER: GameCategory[] = ["creatif", "reflexion", "social", "chaos", "culture"];

/** Jeux du lobby regroupés par famille, dans l'ordre d'affichage (familles vides omises). */
export function gamesByCategory(games: GameModeInfo[] = listedGames()): { category: GameCategory; label: string; tint: string; blurb: string; games: GameModeInfo[] }[] {
  return CATEGORY_ORDER.map((category) => ({ category, ...GAME_CATEGORIES[category], games: games.filter((g) => g.category === category) })).filter((f) => f.games.length > 0);
}
