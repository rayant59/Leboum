// Phrases à compléter de « La Plus Drôle ». « ___ » marque le trou.
export const FUNNY_PROMPTS: string[] = [
  "Le pire cadeau d'anniversaire possible : ___",
  "La phrase à ne jamais dire à un premier rendez-vous : ___",
  "Le nouveau parfum de chips que personne n'a demandé : ___",
  "Ce que mon chat pense vraiment de moi : ___",
  "La pire excuse pour arriver en retard au travail : ___",
  "Le titre de mon autobiographie : ___",
  "Le métier le plus inutile du futur : ___",
  "Ce qu'on trouve vraiment au fond du sac de Mary Poppins : ___",
  "Le slogan d'une salle de sport pour paresseux : ___",
  "La 11e règle secrète du Monopoly : ___",
  "Le pire nom pour un bateau : ___",
  "Ce que les pigeons se disent en nous regardant : ___",
  "La pire chose à crier dans une bibliothèque : ___",
  "Le super-pouvoir le plus nul du monde : ___",
  "La spécialité culinaire secrète de ma grand-mère : ___",
  "Le prochain tube de l'été s'appellera : ___",
  "Le pire conseil de développement personnel : ___",
  "Ce que dit un GPS quand il en a marre : ___",
  "Le pire thème pour un mariage : ___",
  "La phrase que dit toujours le prof de sport : ___",
  "Le nom du groupe de rock formé par les profs du lycée : ___",
  "Ce que je ferais avec un million d'euros (en vrai) : ___",
  "Le pire jeu de société à sortir en soirée : ___",
  "La nouvelle émoticône dont on a tous besoin : ___",
  "La raison réelle pour laquelle les dinosaures ont disparu : ___",
  "La pire option à ajouter dans une voiture : ___",
  "Le message que je laisserais aux extraterrestres : ___",
  "Le sujet du bac de philo en 2050 : ___",
  "Le pire mot de passe Wi-Fi : ___",
  "Ce qu'on entend vraiment dans les coquillages : ___",
  "La pire idée de restaurant à thème : ___",
  "La phrase la plus française du monde : ___",
  "Le pire moment pour éternuer : ___",
  "La nouvelle discipline aux Jeux olympiques : ___",
  "Ce que le Père Noël fait le reste de l'année : ___",
  "Le pire nom de chien : ___",
  "Le titre du prochain film de super-héros français : ___",
  "Le pire tatouage à se faire après une soirée : ___",
  "La rumeur la plus folle sur la Tour Eiffel : ___",
  "Ce que contient vraiment la boîte noire d'un avion : ___",
  "Le pire slogan pour une marque de dentifrice : ___",
  "Ce que pense un poisson rouge à chaque tour de bocal : ___",
  "La règle d'or des soirées entre potes : ___",
  "Le pire prénom pour un robot domestique : ___",
  "Ce qui se passe vraiment quand on met un téléphone en mode avion : ___",
  "La pire chanson pour un enterrement de vie de garçon : ___",
  "Le cours qu'on devrait enseigner à l'école : ___",
  "Le pire endroit pour une demande en mariage : ___",
  "Ce que les plantes vertes disent quand on part en vacances : ___",
  "Le nom d'un fromage qui n'existe pas encore : ___",
  "La pire question à poser à un guide touristique : ___",
  "Le film qui aurait dû avoir une suite : ___",
  "Ce que fait vraiment le bouton « fermer les portes » de l'ascenseur : ___",
  "La pire activité pour un team building : ___",
  "Ce que la Joconde pense des touristes : ___",
  "Le pire goût de glace : ___",
  "La nouvelle loi votée par les chats : ___",
  "La première chose que je fais en me réveillant milliardaire : ___",
  "Le pire surnom à donner à son patron : ___",
  "Le secret de la recette du bonheur : ___",
];

let custom: string[] = [];

/** Ajoute des phrases perso (dossier plusdrole/). Sans « ___ », le trou va à la fin. */
export function addCustomFunnyPrompts(lines: string[]) {
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || l.startsWith("#")) continue;
    const p = l.includes("___") ? l : `${l.replace(/[\s:]+$/, "")} : ___`;
    if (!custom.includes(p) && !FUNNY_PROMPTS.includes(p)) custom.push(p.slice(0, 180));
  }
}

export function funnyPromptBank(): string[] {
  return [...FUNNY_PROMPTS, ...custom];
}
