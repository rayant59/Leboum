// Cartes du « Mot interdit » : le mot à faire deviner + 4 mots interdits
// (les associations les plus évidentes, sinon c'est trop facile).
import type { TabooCard } from "./types";

const RAW: [string, string, string, string, string][] = [
  // À table
  ["Pizza", "Italie", "Fromage", "Four", "Tomate"],
  ["Raclette", "Fromage", "Montagne", "Pommes de terre", "Appareil"],
  ["Croissant", "Viennoiserie", "Beurre", "Boulangerie", "Petit-déjeuner"],
  ["Baguette", "Pain", "Boulanger", "France", "Croûte"],
  ["Sushi", "Japon", "Poisson", "Riz", "Cru"],
  ["Crêpe", "Bretagne", "Poêle", "Farine", "Chandeleur"],
  ["Chocolat", "Cacao", "Noir", "Lait", "Tablette"],
  ["Champagne", "Bulles", "Bouteille", "Fête", "Reims"],
  ["Frites", "Pommes de terre", "Huile", "Belgique", "Ketchup"],
  ["Café", "Tasse", "Expresso", "Matin", "Grain"],
  ["Burger", "Pain", "Steak", "Fast-food", "Américain"],
  ["Escargot", "Coquille", "Lent", "Bave", "Beurre"],
  ["Fondue", "Fromage", "Caquelon", "Pain", "Suisse"],
  ["Macaron", "Pâtisserie", "Couleur", "Ladurée", "Amande"],
  ["Ketchup", "Tomate", "Sauce", "Rouge", "Frites"],
  ["Popcorn", "Cinéma", "Maïs", "Sucré", "Salé"],
  ["Barbecue", "Grillade", "Été", "Charbon", "Saucisse"],
  ["Gâteau", "Anniversaire", "Bougie", "Dessert", "Four"],
  // Animaux
  ["Girafe", "Cou", "Long", "Afrique", "Taches"],
  ["Pingouin", "Glace", "Noir", "Blanc", "Oiseau"],
  ["Kangourou", "Australie", "Sauter", "Poche", "Bébé"],
  ["Abeille", "Miel", "Piquer", "Ruche", "Fleur"],
  ["Requin", "Mer", "Dents", "Poisson", "Dents de la mer"],
  ["Chat", "Miaou", "Animal", "Souris", "Croquettes"],
  ["Chien", "Aboyer", "Os", "Animal", "Fidèle"],
  ["Éléphant", "Trompe", "Gros", "Défenses", "Afrique"],
  ["Serpent", "Ramper", "Venin", "Siffler", "Reptile"],
  ["Poule", "Œuf", "Coq", "Ferme", "Plume"],
  ["Hibou", "Nuit", "Oiseau", "Yeux", "Chouette"],
  ["Dauphin", "Mer", "Intelligent", "Sauter", "Flipper"],
  ["Lion", "Roi", "Crinière", "Savane", "Rugir"],
  ["Moustique", "Piqûre", "Été", "Bzz", "Sang"],
  ["Licorne", "Corne", "Cheval", "Magique", "Arc-en-ciel"],
  ["Dinosaure", "Préhistoire", "T-Rex", "Disparu", "Jurassic"],
  // Lieux
  ["Plage", "Sable", "Mer", "Soleil", "Vacances"],
  ["Tour Eiffel", "Paris", "Monument", "Fer", "Haute"],
  ["Hôpital", "Médecin", "Malade", "Infirmière", "Urgences"],
  ["Aéroport", "Avion", "Valise", "Vol", "Décoller"],
  ["Cinéma", "Film", "Écran", "Popcorn", "Salle"],
  ["Prison", "Barreaux", "Détenu", "Cellule", "Évasion"],
  ["Boulangerie", "Pain", "Baguette", "Croissant", "Boulanger"],
  ["Bibliothèque", "Livres", "Silence", "Emprunter", "Lire"],
  ["Piscine", "Nager", "Eau", "Maillot", "Plonger"],
  ["Camping", "Tente", "Vacances", "Nature", "Sac de couchage"],
  ["Boîte de nuit", "Danser", "Musique", "DJ", "Videur"],
  ["Supermarché", "Courses", "Caddie", "Caisse", "Rayon"],
  ["Zoo", "Animaux", "Cage", "Visiter", "Lion"],
  ["Montagne", "Ski", "Sommet", "Neige", "Alpes"],
  ["Désert", "Sable", "Chaud", "Chameau", "Sahara"],
  ["Château", "Roi", "Tour", "Pont-levis", "Princesse"],
  ["Volcan", "Lave", "Éruption", "Cratère", "Feu"],
  // Objets
  ["Parapluie", "Pluie", "Ouvrir", "Mouillé", "Protéger"],
  ["Téléphone", "Appeler", "Portable", "Écran", "Sonner"],
  ["Brosse à dents", "Dentifrice", "Bouche", "Matin", "Dents"],
  ["Miroir", "Reflet", "Se voir", "Glace", "Salle de bain"],
  ["Réveil", "Sonner", "Matin", "Heure", "Dormir"],
  ["Valise", "Voyage", "Bagage", "Roulettes", "Vêtements"],
  ["Lunettes", "Yeux", "Voir", "Verres", "Myope"],
  ["Clé", "Porte", "Serrure", "Ouvrir", "Trousseau"],
  ["Bougie", "Cire", "Flamme", "Allumer", "Mèche"],
  ["Ciseaux", "Couper", "Lames", "Papier", "Coiffeur"],
  ["Télécommande", "Télé", "Chaîne", "Boutons", "Canapé"],
  ["Casque", "Tête", "Musique", "Oreilles", "Moto"],
  ["Ballon", "Rond", "Football", "Gonfler", "Jouer"],
  ["Échelle", "Monter", "Barreaux", "Haut", "Grimper"],
  ["Aspirateur", "Ménage", "Poussière", "Sol", "Bruit"],
  ["Oreiller", "Lit", "Dormir", "Tête", "Plumes"],
  ["Ordinateur", "Écran", "Clavier", "Souris", "Internet"],
  ["Montre", "Heure", "Poignet", "Aiguilles", "Temps"],
  ["Sac à dos", "Dos", "École", "Bretelles", "Randonnée"],
  // Métiers & personnages
  ["Pompier", "Feu", "Camion", "Sauver", "Caserne"],
  ["Dentiste", "Dents", "Carie", "Fraise", "Bouche"],
  ["Pilote", "Avion", "Voler", "Cockpit", "Commandant"],
  ["Professeur", "École", "Élève", "Classe", "Enseigner"],
  ["Magicien", "Tour", "Chapeau", "Lapin", "Baguette"],
  ["Astronaute", "Espace", "Fusée", "Lune", "NASA"],
  ["Pirate", "Bateau", "Trésor", "Perroquet", "Jambe de bois"],
  ["Fantôme", "Drap", "Peur", "Hanter", "Bouh"],
  ["Vampire", "Sang", "Dents", "Dracula", "Nuit"],
  ["Sorcière", "Balai", "Chapeau", "Potion", "Magie"],
  ["Père Noël", "Cadeaux", "Barbe", "Rouge", "Traîneau"],
  ["Facteur", "Lettre", "Courrier", "Boîte aux lettres", "Poste"],
  ["Policier", "Police", "Voleur", "Menottes", "Sirène"],
  ["Cuisinier", "Cuisine", "Chef", "Restaurant", "Toque"],
  ["Coiffeur", "Cheveux", "Couper", "Ciseaux", "Salon"],
  ["Clown", "Cirque", "Nez rouge", "Rire", "Maquillage"],
  ["Super-héros", "Pouvoir", "Cape", "Sauver", "Méchant"],
  ["Princesse", "Roi", "Château", "Robe", "Prince"],
  // Sports & loisirs
  ["Football", "Ballon", "But", "Équipe", "Pied"],
  ["Tennis", "Raquette", "Balle", "Filet", "Roland-Garros"],
  ["Ski", "Neige", "Montagne", "Piste", "Glisser"],
  ["Vélo", "Pédaler", "Roues", "Tour de France", "Guidon"],
  ["Natation", "Nager", "Piscine", "Eau", "Brasse"],
  ["Boxe", "Gants", "Ring", "Coup de poing", "KO"],
  ["Karaoké", "Chanter", "Micro", "Paroles", "Faux"],
  ["Échecs", "Roi", "Pion", "Plateau", "Mat"],
  ["Jeu vidéo", "Console", "Manette", "Jouer", "Écran"],
  ["Surf", "Vague", "Planche", "Mer", "Glisser"],
  ["Pétanque", "Boule", "Cochonnet", "Pointer", "Tirer"],
  ["Danse", "Musique", "Pas", "Bouger", "Danser"],
  ["Cache-cache", "Cacher", "Compter", "Trouver", "Enfants"],
  ["Puzzle", "Pièces", "Assembler", "Image", "Emboîter"],
  ["Selfie", "Photo", "Téléphone", "Soi-même", "Instagram"],
  ["Concert", "Musique", "Scène", "Chanteur", "Public"],
  // Nature & météo
  ["Arc-en-ciel", "Couleurs", "Pluie", "Soleil", "Ciel"],
  ["Neige", "Blanc", "Froid", "Hiver", "Flocon"],
  ["Orage", "Éclair", "Tonnerre", "Pluie", "Nuage"],
  ["Lune", "Nuit", "Croissant", "Pleine", "Astronaute"],
  ["Soleil", "Chaud", "Étoile", "Jour", "Lumière"],
  ["Cascade", "Eau", "Tomber", "Rivière", "Chute"],
  ["Forêt", "Arbres", "Bois", "Champignons", "Nature"],
  ["Fleur", "Pétales", "Jardin", "Rose", "Bouquet"],
  // Soirée & vie quotidienne
  ["Anniversaire", "Gâteau", "Bougies", "Âge", "Cadeau"],
  ["Mariage", "Robe", "Mariés", "Bague", "Église"],
  ["Gueule de bois", "Alcool", "Lendemain", "Mal de tête", "Soirée"],
  ["Apéro", "Boire", "Chips", "Avant le repas", "Amis"],
  ["Déménagement", "Cartons", "Maison", "Camion", "Changer"],
  ["Embouteillage", "Voitures", "Bouchon", "Route", "Bloqué"],
  ["Vacances", "Partir", "Été", "Repos", "Voyage"],
  ["Rendez-vous", "Heure", "Retrouver", "Amoureux", "Date"],
  ["Lundi", "Semaine", "Jour", "Travail", "Dimanche"],
  ["Noël", "Sapin", "Cadeaux", "Décembre", "Père Noël"],
  ["Halloween", "Citrouille", "Bonbons", "Déguisement", "Peur"],
  ["Sieste", "Dormir", "Après-midi", "Fatigue", "Canapé"],
  ["Ronfler", "Dormir", "Bruit", "Nez", "Nuit"],
  ["Bouchon", "Bouteille", "Vin", "Liège", "Embouteillage"],
  ["Feu d'artifice", "Ciel", "14 juillet", "Explosion", "Couleurs"],
];

const BUILTIN: TabooCard[] = RAW.map(([word, ...forbidden]) => ({ word, forbidden }));

let custom: TabooCard[] = [];

export function tabooBank(): TabooCard[] {
  return [...BUILTIN, ...custom];
}

/**
 * Cartes perso : une par ligne, « mot | interdit, interdit, interdit… »
 * (au moins 1, au plus 6 mots interdits). « # » = commentaire.
 */
export function parseTabooCards(text: string): TabooCard[] {
  const out: TabooCard[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [word, rest] = line.split("|").map((p) => p?.trim() ?? "");
    if (!word || !rest || word.length > 40) continue;
    const forbidden = rest.split(/[,;]/).map((f) => f.trim()).filter((f) => f && f.length <= 40).slice(0, 6);
    if (forbidden.length) out.push({ word, forbidden });
  }
  return out;
}

export function addCustomTabooCards(cards: TabooCard[]): void {
  const known = new Set(tabooBank().map((c) => c.word.toLowerCase()));
  for (const c of cards) {
    const k = c.word.toLowerCase();
    if (known.has(k)) continue;
    known.add(k);
    custom.push(c);
  }
}

/** Réservé aux tests. */
export function resetCustomTabooCards(): void {
  custom = [];
}
