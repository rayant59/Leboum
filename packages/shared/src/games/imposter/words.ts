// Banque de mots de l'« Imposteur » : paires de mots proches d'une même
// catégorie. Le 1er est le mot de la table, le 2ᵉ celui de l'imposteur en
// mode infiltré (assez proche pour qu'il ne se doute de rien… au début).
import type { ImposterPair } from "./types";

const RAW: Record<string, [string, string][]> = {
  "À table": [
    ["Pizza", "Tarte flambée"], ["Raclette", "Fondue"], ["Croissant", "Pain au chocolat"], ["Sushi", "Maki"],
    ["Crêpe", "Gaufre"], ["Burger", "Kebab"], ["Couscous", "Paella"], ["Baguette", "Brioche"],
    ["Fromage", "Yaourt"], ["Chocolat chaud", "Café"], ["Frites", "Chips"], ["Croque-monsieur", "Panini"],
    ["Tiramisu", "Mousse au chocolat"], ["Ketchup", "Mayonnaise"], ["Pâtes", "Riz"], ["Hot-dog", "Sandwich"],
    ["Champagne", "Cidre"], ["Ratatouille", "Soupe"], ["Macaron", "Meringue"], ["Omelette", "Œuf au plat"],
  ],
  "Animaux": [
    ["Chat", "Lynx"], ["Chien", "Loup"], ["Dauphin", "Requin"], ["Pingouin", "Mouette"],
    ["Lion", "Tigre"], ["Abeille", "Guêpe"], ["Cheval", "Âne"], ["Grenouille", "Crapaud"],
    ["Hibou", "Corbeau"], ["Escargot", "Limace"], ["Girafe", "Zèbre"], ["Poule", "Canard"],
    ["Serpent", "Ver de terre"], ["Kangourou", "Lapin"], ["Pieuvre", "Méduse"], ["Ours", "Panda"],
  ],
  "Lieux": [
    ["Plage", "Piscine"], ["Montagne", "Volcan"], ["Cinéma", "Théâtre"], ["Boulangerie", "Supermarché"],
    ["Hôpital", "Pharmacie"], ["Aéroport", "Gare"], ["Bibliothèque", "Librairie"], ["Camping", "Hôtel"],
    ["Prison", "Commissariat"], ["Zoo", "Ferme"], ["Boîte de nuit", "Bar"], ["École", "Université"],
    ["Église", "Château"], ["Forêt", "Jungle"], ["Désert", "Banquise"], ["Salle de sport", "Stade"],
  ],
  "Objets du quotidien": [
    ["Brosse à dents", "Peigne"], ["Parapluie", "Imperméable"], ["Téléphone", "Tablette"], ["Oreiller", "Couette"],
    ["Fourchette", "Cuillère"], ["Lunettes", "Lentilles"], ["Clé", "Cadenas"], ["Bougie", "Lampe de poche"],
    ["Miroir", "Fenêtre"], ["Valise", "Sac à dos"], ["Montre", "Réveil"], ["Ciseaux", "Couteau"],
    ["Télécommande", "Manette"], ["Casque audio", "Enceinte"], ["Aspirateur", "Balai"], ["Stylo", "Crayon"],
  ],
  "Métiers": [
    ["Pompier", "Policier"], ["Boulanger", "Pâtissier"], ["Dentiste", "Médecin"], ["Pilote", "Hôtesse de l'air"],
    ["Professeur", "Directeur"], ["Chanteur", "Rappeur"], ["Plombier", "Électricien"], ["Coiffeur", "Barbier"],
    ["Astronaute", "Pilote de chasse"], ["Magicien", "Clown"], ["Cuisinier", "Serveur"], ["Facteur", "Livreur"],
  ],
  "Sports & loisirs": [
    ["Football", "Rugby"], ["Tennis", "Ping-pong"], ["Ski", "Snowboard"], ["Natation", "Plongée"],
    ["Boxe", "Judo"], ["Basket", "Handball"], ["Vélo", "Trottinette"], ["Bowling", "Pétanque"],
    ["Karaoké", "Blind test"], ["Échecs", "Dames"], ["Yoga", "Méditation"], ["Surf", "Skate"],
    ["Escalade", "Randonnée"], ["Poker", "Belote"],
  ],
  "Transports": [
    ["Avion", "Hélicoptère"], ["Train", "Métro"], ["Bateau", "Sous-marin"], ["Moto", "Scooter"],
    ["Taxi", "Bus"], ["Fusée", "Soucoupe volante"], ["Voiture", "Camion"], ["Montgolfière", "Parachute"],
  ],
  "Vêtements": [
    ["Pyjama", "Peignoir"], ["Chaussettes", "Chaussons"], ["Casquette", "Bonnet"], ["Jean", "Jogging"],
    ["Robe", "Jupe"], ["Cravate", "Nœud papillon"], ["Maillot de bain", "Short"], ["Écharpe", "Gants"],
  ],
  "Soirée": [
    ["Anniversaire", "Mariage"], ["Gâteau", "Bougies"], ["Pétard", "Feu d'artifice"], ["Déguisement", "Masque"],
    ["Apéro", "Barbecue"], ["Playlist", "DJ"], ["Gueule de bois", "Fatigue"], ["Selfie", "Photo de groupe"],
    ["Jeu de société", "Jeu vidéo"], ["Pizza livrée", "Restaurant"],
  ],
  "Nature & météo": [
    ["Soleil", "Lune"], ["Pluie", "Neige"], ["Orage", "Tempête"], ["Arc-en-ciel", "Aurore boréale"],
    ["Rivière", "Cascade"], ["Fleur", "Arbre"], ["Plage de sable", "Galets"], ["Étoile", "Planète"],
  ],
};

const BUILTIN: ImposterPair[] = Object.entries(RAW).flatMap(([category, pairs]) =>
  pairs.map(([word, decoy]) => ({ category, word, decoy })),
);

let custom: ImposterPair[] = [];

/** Toutes les paires disponibles (intégrées + perso). */
export function imposterBank(): ImposterPair[] {
  return [...BUILTIN, ...custom];
}

export function imposterBankSize(): number {
  return BUILTIN.length + custom.length;
}

/**
 * Lit un fichier perso : une paire par ligne, « catégorie | mot | mot proche ».
 * « mot | mot proche » (sans catégorie) va dans « Perso ». Les lignes « # » sont ignorées.
 */
export function parseImposterPairs(text: string): ImposterPair[] {
  const out: ImposterPair[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 3) out.push({ category: parts[0], word: parts[1], decoy: parts[2] });
    else if (parts.length === 2) out.push({ category: "Perso", word: parts[0], decoy: parts[1] });
  }
  return out.filter((p) => p.word.length <= 40 && p.decoy.length <= 40 && p.category.length <= 40);
}

/** Ajoute des paires perso (sans doublon de mot). */
export function addCustomImposterPairs(pairs: ImposterPair[]): void {
  const known = new Set(imposterBank().map((p) => p.word.toLowerCase()));
  for (const p of pairs) {
    const k = p.word.toLowerCase();
    if (known.has(k)) continue;
    known.add(k);
    custom.push(p);
  }
}

/** Réservé aux tests. */
export function resetCustomImposterPairs(): void {
  custom = [];
}
