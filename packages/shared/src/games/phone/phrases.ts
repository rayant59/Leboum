// Phrases de départ du « Téléphone cassé » : proposées via « Inspire-moi » et
// utilisées quand un joueur n'a rien écrit à temps (la chaîne continue).

const BUILTIN: string[] = [
  "Un pingouin qui fait du ski nautique",
  "Ma grand-mère gagne un concours de breakdance",
  "Un chat qui passe le permis de conduire",
  "Une baguette géante attaque la tour Eiffel",
  "Le Père Noël en vacances à la plage",
  "Un dinosaure qui a peur d'une souris",
  "Un astronaute qui mange une raclette sur la Lune",
  "Une vache qui fait du parachute",
  "Un escargot champion de Formule 1",
  "Le prof de maths déguisé en licorne",
  "Un fantôme qui fait ses courses au supermarché",
  "Deux pigeons qui se disputent une frite",
  "Un robot qui pleure devant un film d'amour",
  "Une sirène coincée dans une baignoire",
  "Un chien qui promène son maître",
  "Une pizza qui s'enfuit du four",
  "Un vampire chez le dentiste",
  "Un ours en pyjama qui fait du yoga",
  "Un mariage entre une fourchette et une cuillère",
  "Un requin qui a mal aux dents",
  "Un pirate qui a le mal de mer",
  "Une girafe qui essaie de monter dans un bus",
  "Un croissant qui fait de la musculation",
  "Un poisson rouge qui s'ennuie dans son bocal",
  "Un sumo en équilibre sur un ballon",
  "Une sorcière dont le balai est en panne",
  "Un extraterrestre qui demande son chemin",
  "Un hérisson qui fait un câlin à un ballon",
  "Un cowboy qui monte un escargot",
  "Le soleil qui met des lunettes de soleil",
  "Une tortue qui gagne le marathon",
  "Un cuisinier qui jongle avec des crêpes",
  "Un panda qui fait du skate",
  "Un chevalier qui combat un aspirateur",
  "Un bonhomme de neige en plein désert",
  "Une poule qui pond un œuf en or",
  "Un magicien qui rate son tour",
  "Une momie qui se fait bronzer",
  "Un hamster qui pilote un avion",
  "Un zombie qui fait la queue à la boulangerie",
  "Un éléphant caché derrière un lampadaire",
  "Un selfie avec un yéti",
  "Un banana split qui fait du surf",
  "Une licorne coincée dans les bouchons",
  "Un DJ qui mixe avec des casseroles",
  "Un crocodile qui se brosse les dents",
  "Une soirée pyjama chez les vampires",
  "Un pompier qui sauve un chat sur un nuage",
  "Un roi qui a perdu sa couronne dans la soupe",
  "Un footballeur qui marque contre son camp",
  "Un mouton qui compte des humains pour s'endormir",
  "Une plante verte qui réclame des chips",
  "Un hippopotame en tutu",
  "Un facteur poursuivi par des lettres",
  "Un détective qui cherche ses lunettes sur sa tête",
  "Une fête d'anniversaire sous l'eau",
  "Un kangourou qui a perdu sa poche",
  "Un concert de rock dans une bibliothèque",
  "Une fourmi qui porte un frigo",
  "Un tracteur qui fait la course avec une fusée",
];

let custom: string[] = [];

export function phonePhraseBank(): string[] {
  return [...BUILTIN, ...custom];
}

/** Ajoute des phrases perso (une par ligne, « # » = commentaire). */
export function addCustomPhonePhrases(lines: string[]): void {
  const known = new Set(phonePhraseBank().map((p) => p.toLowerCase()));
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.length > 80) continue;
    if (known.has(line.toLowerCase())) continue;
    known.add(line.toLowerCase());
    custom.push(line);
  }
}

/** Réservé aux tests. */
export function resetCustomPhonePhrases(): void {
  custom = [];
}
