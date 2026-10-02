// Consignes du « Top ». Mode savoir : éléments dans le BON ordre (haut → bas),
// avec la valeur affichée à la révélation (ordres de grandeur arrondis).
// Mode table : consignes subjectives, l'ordre attendu sera celui de la table.
import type { RankingPrompt } from "./types";

const P = (title: string, top: string, bottom: string, items: [string, string?][]): RankingPrompt => ({
  title,
  top,
  bottom,
  items: items.map(([label, value]) => (value ? { label, value } : { label })),
});

export const SAVOIR_PROMPTS: RankingPrompt[] = [
  P("Du plus lourd au plus léger", "Le plus lourd", "Le plus léger", [["Baleine bleue", "≈ 150 t"], ["Éléphant d'Afrique", "≈ 6 t"], ["Hippopotame", "≈ 2 t"], ["Girafe", "≈ 1 t"], ["Ours polaire", "≈ 500 kg"]]),
  P("Du plus proche au plus loin du Soleil", "Le plus proche", "Le plus loin", [["Mercure", "58 M km"], ["Vénus", "108 M km"], ["Terre", "150 M km"], ["Mars", "228 M km"], ["Jupiter", "778 M km"]]),
  P("De la plus grosse à la plus petite planète", "La plus grosse", "La plus petite", [["Jupiter", "≈ 140 000 km"], ["Saturne", "≈ 116 000 km"], ["Uranus", "≈ 51 000 km"], ["Neptune", "≈ 49 000 km"], ["Terre", "≈ 12 700 km"]]),
  P("Du plus haut au moins haut", "Le plus haut", "Le moins haut", [["Everest", "8 849 m"], ["K2", "8 611 m"], ["Aconcagua", "6 961 m"], ["Kilimandjaro", "5 895 m"], ["Mont Blanc", "≈ 4 806 m"]]),
  P("De la plus peuplée à la moins peuplée", "La plus peuplée", "La moins peuplée", [["Paris", "≈ 2,1 M hab."], ["Marseille", "≈ 870 000 hab."], ["Lyon", "≈ 520 000 hab."], ["Nice", "≈ 340 000 hab."], ["Bordeaux", "≈ 260 000 hab."]]),
  P("Du plus ancien au plus récent", "Le plus ancien", "Le plus récent", [["Pyramides de Gizeh", "≈ 2560 av. J.-C."], ["Fondation de Rome", "753 av. J.-C."], ["Sacre de Charlemagne", "800"], ["Prise de la Bastille", "1789"], ["Premier pas sur la Lune", "1969"]]),
  P("De l'invention la plus ancienne à la plus récente", "La plus ancienne", "La plus récente", [["Imprimerie (Gutenberg)", "≈ 1450"], ["Téléphone", "1876"], ["Avion (frères Wright)", "1903"], ["Télévision", "≈ 1926"], ["World Wide Web", "1989"]]),
  P("Du plus rapide au plus lent", "Le plus rapide", "Le plus lent", [["Faucon pèlerin (en piqué)", "≈ 320 km/h"], ["Guépard", "≈ 110 km/h"], ["Autruche", "≈ 70 km/h"], ["Usain Bolt", "≈ 44 km/h"], ["Escargot", "≈ 0,05 km/h"]]),
  P("De celui qui vit le plus longtemps au moins longtemps", "Vit le plus longtemps", "Vit le moins longtemps", [["Tortue des Galápagos", "100 ans et +"], ["Éléphant", "≈ 70 ans"], ["Cheval", "≈ 30 ans"], ["Chat", "≈ 15 ans"], ["Souris", "≈ 2 ans"]]),
  P("Du plus grand au plus petit pays", "Le plus grand", "Le plus petit", [["Russie", "≈ 17,1 M km²"], ["Canada", "≈ 10 M km²"], ["Chine", "≈ 9,6 M km²"], ["Brésil", "≈ 8,5 M km²"], ["France", "≈ 0,55 M km²"]]),
  P("Du plus peuplé au moins peuplé", "Le plus peuplé", "Le moins peuplé", [["Inde", "≈ 1,4 Md"], ["États-Unis", "≈ 335 M"], ["Brésil", "≈ 215 M"], ["Japon", "≈ 125 M"], ["France", "≈ 68 M"]]),
  P("Du film le plus ancien au plus récent", "Le plus ancien", "Le plus récent", [["Star Wars", "1977"], ["E.T. l'extra-terrestre", "1982"], ["Titanic", "1997"], ["Harry Potter à l'école des sorciers", "2001"], ["Avatar", "2009"]]),
  P("De la console la plus ancienne à la plus récente", "La plus ancienne", "La plus récente", [["Game Boy", "1989"], ["PlayStation", "1994"], ["Nintendo 64", "1996"], ["Xbox", "2001"], ["Nintendo Switch", "2017"]]),
  P("Du plus haut au moins haut", "Le plus haut", "Le moins haut", [["Burj Khalifa", "828 m"], ["Shanghai Tower", "632 m"], ["Empire State Building", "381 m (toit)"], ["Tour Eiffel", "≈ 330 m"], ["Tour Montparnasse", "210 m"]]),
  P("Du plus calorique au moins calorique (pour 100 g)", "Le plus calorique", "Le moins calorique", [["Huile d'olive", "≈ 900 kcal"], ["Chocolat noir", "≈ 550 kcal"], ["Pain", "≈ 260 kcal"], ["Banane", "≈ 90 kcal"], ["Concombre", "≈ 15 kcal"]]),
  P("Du plus de pattes au moins de pattes", "Le plus de pattes", "Le moins de pattes", [["Mille-pattes", "des dizaines"], ["Araignée", "8"], ["Fourmi", "6"], ["Chien", "4"], ["Poule", "2"]]),
  P("Du plus rapide au plus lent", "Le plus rapide", "Le plus lent", [["Fusée en orbite", "≈ 28 000 km/h"], ["Avion de ligne", "≈ 900 km/h"], ["TGV", "≈ 320 km/h"], ["Voiture sur autoroute", "130 km/h"], ["Vélo", "≈ 20 km/h"]]),
  P("Du plus grand au plus petit océan", "Le plus grand", "Le plus petit", [["Pacifique", "≈ 165 M km²"], ["Atlantique", "≈ 106 M km²"], ["Indien", "≈ 70 M km²"], ["Austral", "≈ 20 M km²"], ["Arctique", "≈ 14 M km²"]]),
  P("Du plus de joueurs au moins de joueurs (par équipe sur le terrain)", "Le plus de joueurs", "Le moins", [["Rugby à XV", "15"], ["Football", "11"], ["Handball", "7"], ["Basket", "5"], ["Tennis (simple)", "1"]]),
  P("Du plus ancien au plus récent (naissance)", "Né le plus tôt", "Né le plus tard", [["Jules César", "100 av. J.-C."], ["Charlemagne", "742"], ["Jeanne d'Arc", "1412"], ["Napoléon", "1769"], ["Marie Curie", "1867"]]),
  P("Du plus proche au plus loin de Paris", "Le plus proche", "Le plus loin", [["Bruxelles", "≈ 260 km"], ["Londres", "≈ 340 km"], ["Rome", "≈ 1 100 km"], ["New York", "≈ 5 800 km"], ["Tokyo", "≈ 9 700 km"]]),
  P("Du plus chaud au moins chaud", "Le plus chaud", "Le moins chaud", [["Surface du Soleil", "≈ 5 500 °C"], ["Lave", "≈ 1 100 °C"], ["Four à pizza", "≈ 400 °C"], ["Eau bouillante", "100 °C"], ["Corps humain", "37 °C"]]),
  P("De la plus grosse à la plus petite balle", "La plus grosse", "La plus petite", [["Ballon de basket", "≈ 24 cm"], ["Ballon de football", "≈ 22 cm"], ["Ballon de handball", "≈ 19 cm"], ["Balle de tennis", "≈ 6,7 cm"], ["Balle de golf", "≈ 4,3 cm"]]),
  P("Du plus long au plus court", "Le plus long", "Le plus court", [["Tunnel sous la Manche", "≈ 50 km"], ["Marathon", "42,195 km"], ["Boulevard périphérique de Paris", "≈ 35 km"], ["Semi-marathon", "21,1 km"], ["Avenue des Champs-Élysées", "≈ 1,9 km"]]),
];

export const TABLE_PROMPTS: RankingPrompt[] = [
  P("Le plus indispensable en soirée", "Indispensable", "Accessoire", [["La musique"], ["Les chips"], ["Les glaçons"], ["Un jeu de société"], ["Un canapé"]]),
  P("Le pire à oublier en vacances", "Le pire", "Pas grave", [["Le chargeur"], ["Le maillot de bain"], ["La crème solaire"], ["La brosse à dents"], ["Les lunettes de soleil"]]),
  P("Le meilleur plat du dimanche", "Le meilleur", "Le moins bon", [["Raclette"], ["Lasagnes"], ["Poulet frites"], ["Couscous"], ["Crêpes"]]),
  P("Le super-pouvoir le plus utile", "Le plus utile", "Le moins utile", [["Voler"], ["Lire dans les pensées"], ["Se téléporter"], ["Devenir invisible"], ["Arrêter le temps"]]),
  P("Le plus agaçant chez un coloc", "Le plus agaçant", "Le plus supportable", [["La vaisselle qui traîne"], ["La musique à 2 h du matin"], ["Manger ta nourriture"], ["Les cheveux dans la douche"], ["Ne jamais sortir les poubelles"]]),
  P("Le meilleur moment de la journée", "Le meilleur", "Le pire", [["Le petit-déjeuner"], ["La sieste"], ["L'apéro"], ["Le dîner"], ["Le moment de se coucher"]]),
  P("La pire excuse pour un retard", "La pire", "La plus crédible", [["Mon réveil n'a pas sonné"], ["Il y avait des bouchons"], ["Mon chat était malade"], ["Je ne trouvais plus mes clés"], ["J'ai cru que c'était demain"]]),
  P("Le plus effrayant", "Le plus effrayant", "Le moins effrayant", [["Une araignée géante"], ["Parler en public"], ["Le noir complet"], ["Un clown"], ["Rater son avion"]]),
  P("Le meilleur dessin animé d'enfance", "Le meilleur", "Le moins bon", [["Le Roi Lion"], ["Pokémon"], ["Dragon Ball"], ["Les Simpson"], ["Bob l'éponge"]]),
  P("Le métier le plus cool", "Le plus cool", "Le moins cool", [["Astronaute"], ["Chef cuisinier"], ["Youtubeur"], ["Pompier"], ["Footballeur pro"]]),
  P("La meilleure saison", "La meilleure", "La pire", [["L'été"], ["L'hiver"], ["Le printemps"], ["L'automne"], ["Les vacances de Noël"]]),
  P("Le pire cadeau d'anniversaire", "Le pire", "Le moins pire", [["Des chaussettes"], ["Un livre de développement personnel"], ["Un pull moche"], ["Un abonnement à la salle de sport"], ["Rien du tout"]]),
  P("Le meilleur animal de compagnie", "Le meilleur", "Le moins bon", [["Chien"], ["Chat"], ["Lapin"], ["Poisson rouge"], ["Perroquet"]]),
  P("Le plus gênant en soirée", "Le plus gênant", "Le moins gênant", [["Tomber en dansant"], ["Appeler quelqu'un par le mauvais prénom"], ["Chanter faux au karaoké"], ["Renverser son verre sur l'hôte"], ["S'endormir sur le canapé"]]),
  P("La meilleure façon de voyager", "La meilleure", "La pire", [["En avion"], ["En train"], ["En voiture entre potes"], ["En bateau"], ["À vélo"]]),
];
