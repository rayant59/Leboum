// Faux-artiste : paires de mots PROCHES et faciles à dessiner. Les vrais
// artistes reçoivent l'un, le faux-artiste reçoit l'autre (au hasard) : assez
// proches pour que son dessin passe inaperçu… s'il est malin.
// (Ex. « paquebot » ↔ « voilier », jamais « paquebot » ↔ « cuisse de grenouille ».)

export interface FakeArtistPair {
  theme: string;
  a: string;
  b: string;
}

const RAW: Record<string, [string, string][]> = {
  Animaux: [
    ["chat", "tigre"], ["chien", "loup"], ["lion", "tigre"], ["dauphin", "requin"], ["baleine", "dauphin"],
    ["abeille", "guêpe"], ["cheval", "âne"], ["grenouille", "crapaud"], ["hibou", "corbeau"], ["escargot", "limace"],
    ["girafe", "zèbre"], ["poule", "canard"], ["serpent", "ver de terre"], ["kangourou", "lapin"], ["pieuvre", "méduse"],
    ["ours", "panda"], ["papillon", "libellule"], ["vache", "taureau"], ["mouton", "chèvre"], ["souris", "hamster"],
    ["crocodile", "lézard"], ["pingouin", "manchot"], ["singe", "gorille"], ["perroquet", "toucan"], ["tortue", "escargot"],
    ["fourmi", "araignée"], ["coccinelle", "scarabée"], ["renard", "écureuil"], ["hérisson", "porc-épic"], ["cochon", "sanglier"],
    ["crabe", "homard"], ["chameau", "dromadaire"], ["éléphant", "mammouth"], ["poussin", "canard"],
  ],
  Nourriture: [
    ["pizza", "tarte"], ["croissant", "pain au chocolat"], ["hamburger", "sandwich"], ["frites", "chips"], ["crêpe", "gaufre"],
    ["glace", "sorbet"], ["gâteau", "cupcake"], ["donut", "bagel"], ["pomme", "poire"], ["citron", "orange"],
    ["fraise", "framboise"], ["cerise", "raisin"], ["pastèque", "melon"], ["banane", "ananas"], ["carotte", "radis"],
    ["brocoli", "chou-fleur"], ["spaghetti", "nouilles"], ["sushi", "maki"], ["hot-dog", "baguette"],
    ["cookie", "biscuit"], ["bonbon", "sucette"], ["œuf", "œuf au plat"], ["fromage", "beurre"], ["soupe", "salade"],
    ["popcorn", "chips"], ["kebab", "tacos"], ["café", "thé"], ["citron", "citron vert"],
  ],
  Transports: [
    ["paquebot", "voilier"], ["bateau", "sous-marin"], ["voiture", "camion"], ["vélo", "trottinette"], ["moto", "scooter"],
    ["avion", "hélicoptère"], ["fusée", "avion"], ["train", "métro"], ["bus", "tramway"], ["tracteur", "bulldozer"],
    ["ambulance", "camion de pompiers"], ["skateboard", "rollers"], ["montgolfière", "parachute"], ["canoë", "pédalo"], ["taxi", "voiture de police"],
  ],
  Objets: [
    ["téléphone", "tablette"], ["horloge", "montre"], ["parapluie", "parasol"], ["lunettes", "jumelles"], ["ampoule", "bougie"],
    ["clé", "cadenas"], ["fourchette", "cuillère"], ["couteau", "ciseaux"], ["stylo", "crayon"], ["valise", "sac à dos"],
    ["oreiller", "couette"], ["brosse à dents", "peigne"], ["télécommande", "manette"], ["casque audio", "micro"], ["aspirateur", "balai"],
    ["marteau", "tournevis"], ["chaise", "tabouret"], ["lit", "canapé"], ["lampe", "lampadaire"], ["miroir", "fenêtre"],
    ["ordinateur", "télévision"], ["appareil photo", "caméra"], ["guitare", "violon"], ["piano", "batterie"], ["trompette", "saxophone"],
    ["ballon", "ballon de rugby"], ["livre", "cahier"], ["boîte aux lettres", "poubelle"], ["sac à main", "portefeuille"], ["seau", "arrosoir"],
  ],
  Vêtements: [
    ["chapeau", "casquette"], ["bonnet", "casquette"], ["t-shirt", "pull"], ["pantalon", "short"], ["robe", "jupe"],
    ["chaussure", "botte"], ["basket", "tong"], ["écharpe", "cravate"], ["gant", "moufle"], ["lunettes de soleil", "masque de ski"],
    ["chaussette", "collant"], ["manteau", "veste"], ["couronne", "diadème"], ["pyjama", "peignoir"],
  ],
  Lieux: [
    ["maison", "cabane"], ["château", "palais"], ["plage", "piscine"], ["montagne", "volcan"], ["forêt", "jungle"],
    ["désert", "banquise"], ["école", "bibliothèque"], ["hôpital", "pharmacie"], ["église", "château"], ["phare", "tour"],
    ["pont", "tunnel"], ["igloo", "tente"], ["gratte-ciel", "immeuble"], ["île", "radeau"], ["cinéma", "théâtre"],
    ["ferme", "zoo"], ["gare", "aéroport"], ["parc", "jardin"],
  ],
  Nature: [
    ["soleil", "lune"], ["étoile", "comète"], ["nuage", "brouillard"], ["pluie", "neige"], ["arc-en-ciel", "aurore boréale"],
    ["arbre", "sapin"], ["fleur", "tulipe"], ["rose", "tournesol"], ["cactus", "palmier"], ["feuille", "plume"],
    ["vague", "cascade"], ["éclair", "tornade"], ["bonhomme de neige", "igloo"], ["rocher", "caillou"], ["lac", "rivière"],
  ],
  Personnages: [
    ["pirate", "viking"], ["chevalier", "samouraï"], ["sorcière", "magicien"], ["fantôme", "zombie"], ["vampire", "loup-garou"],
    ["astronaute", "plongeur"], ["robot", "extraterrestre"], ["princesse", "reine"], ["roi", "empereur"], ["clown", "mime"],
    ["cowboy", "shérif"], ["ninja", "espion"], ["sirène", "fée"], ["pompier", "policier"], ["cuisinier", "boulanger"],
    ["médecin", "infirmier"], ["dragon", "dinosaure"], ["licorne", "cheval"], ["super-héros", "chevalier"],
  ],
  Sports: [
    ["football", "rugby"], ["tennis", "ping-pong"], ["ski", "snowboard"], ["natation", "plongée"], ["boxe", "karaté"],
    ["basket", "handball"], ["bowling", "pétanque"], ["surf", "skate"], ["golf", "mini-golf"], ["badminton", "tennis"],
    ["patin à glace", "rollers"], ["vélo", "course à pied"], ["volley", "beach-volley"], ["échecs", "dames"],
  ],
};

export const FAKE_ARTIST_PAIRS: readonly FakeArtistPair[] = Object.entries(RAW).flatMap(([theme, pairs]) =>
  pairs.map(([a, b]) => ({ theme, a, b })),
);

/**
 * Tire une paire jamais jouée dans la partie (`used` = mots des vrais artistes
 * déjà sortis). Renvoie le mot des artistes, celui du faux-artiste et le thème.
 * Le sens de la paire est tiré au hasard.
 */
export function pickFakeArtistPair(rng: () => number, used: readonly string[] = []): { word: string; decoy: string; theme: string } {
  const usedSet = new Set(used.map((w) => w.toLowerCase()));
  let pool = FAKE_ARTIST_PAIRS.filter((p) => !usedSet.has(p.a.toLowerCase()) && !usedSet.has(p.b.toLowerCase()));
  if (!pool.length) pool = [...FAKE_ARTIST_PAIRS];
  const pair = pool[Math.floor(rng() * pool.length)];
  const flip = rng() < 0.5;
  return { word: flip ? pair.b : pair.a, decoy: flip ? pair.a : pair.b, theme: pair.theme };
}
