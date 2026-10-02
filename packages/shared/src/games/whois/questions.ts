// Banque de questions « Qui de nous ? ». Chaque question se lit après
// « Qui de nous… » : on l'écrit donc à partir du verbe.
import type { WhoisCategory, WhoisQuestion } from "./types";

const BANK: Record<WhoisCategory, string[]> = {
  drole: [
    "rit le plus fort à ses propres blagues ?",
    "pourrait tomber en marchant sur un sol parfaitement plat ?",
    "envoie le plus de messages vocaux de 4 minutes ?",
    "chante le plus faux sous la douche ?",
    "ferait la pire grimace sur une photo officielle ?",
    "a déjà salué quelqu'un qui saluait une autre personne ?",
    "rate toujours la chute de ses histoires ?",
    "danse comme si personne ne regardait… alors que tout le monde regarde ?",
    "pourrait se perdre avec un GPS ?",
    "fait le plus de bruits bizarres en mangeant ?",
    "imite le mieux les accents (même ceux qui n'existent pas) ?",
    "a le fou rire au pire moment possible ?",
    "met le plus de temps à raconter une histoire courte ?",
    "parle à son frigo quand il a faim ?",
    "a les pires jeux de mots ?",
    "ferait une chute spectaculaire en essayant d'être classe ?",
    "rit encore d'une blague d'il y a trois ans ?",
    "pourrait s'endormir debout dans le métro ?",
  ],
  personnalite: [
    "serait le meilleur président de la République ?",
    "est le plus têtu de la bande ?",
    "garde le mieux un secret ?",
    "pleure devant un dessin animé ?",
    "est le plus organisé (tableur Excel compris) ?",
    "s'excuse même quand ce n'est pas sa faute ?",
    "a toujours un plan B… et un plan C ?",
    "est le plus mauvais perdant ?",
    "donne les meilleurs conseils ?",
    "change d'avis le plus souvent ?",
    "est le plus optimiste, même quand tout brûle ?",
    "est le plus dramatique pour un petit bobo ?",
    "a le plus de patience ?",
    "est le plus curieux de tout ?",
    "sait toujours ce qu'il veut au restaurant ?",
    "serait le meilleur prof ?",
    "est le plus nostalgique ?",
    "a le cœur le plus tendre sous une carapace ?",
  ],
  absurde: [
    "survivrait le plus longtemps sur une île déserte ?",
    "serait le premier à se faire manger dans un film d'horreur ?",
    "adopterait un lama s'il en avait l'occasion ?",
    "pourrait devenir ami avec un pigeon ?",
    "gagnerait un concours de regard contre un chat ?",
    "se ferait arnaquer par un robot aspirateur ?",
    "essaierait de négocier avec des extraterrestres ?",
    "ouvrirait une boulangerie sur la Lune ?",
    "se battrait contre une oie… et perdrait ?",
    "finirait coincé dans un toboggan pour enfants ?",
    "pourrait se faire élire maire de son village par accident ?",
    "parlerait couramment le dauphin en secret ?",
    "deviendrait célèbre grâce à une vidéo de chute ?",
    "construirait une cabane dans un arbre à 40 ans ?",
    "se ferait voler son sandwich par une mouette ?",
    "pourrait rester une journée entière déguisé en dinosaure ?",
    "inventerait un sport complètement inutile ?",
    "voyagerait dans le temps juste pour goûter un plat ?",
  ],
  amis: [
    "répond le plus vite aux messages du groupe ?",
    "oublie toujours les anniversaires ?",
    "est toujours en retard aux rendez-vous ?",
    "organise toutes les sorties ?",
    "connaît tous les potins avant tout le monde ?",
    "appellerait-on en premier en cas de galère à 3 h du matin ?",
    "a le plus de photos gênantes des autres ?",
    "se vexe pour un message sans emoji ?",
    "laisse toujours les autres choisir le film… puis critique ?",
    "prête ses affaires et ne les revoit jamais ?",
    "est le plus « je passe en coup de vent » qui reste 4 heures ?",
    "envoie des mèmes à 2 h du matin ?",
    "a le plus de surnoms dans la bande ?",
    "propose toujours « on se fait un truc » sans jamais rien caler ?",
    "arrive toujours les mains vides… mais avec le sourire ?",
    "défendrait la bande contre le monde entier ?",
    "se souvient de chaque détail des vieilles histoires ?",
    "a déjà fait une gaffe en envoyant un message au mauvais groupe ?",
  ],
  competition: [
    "triche au Monopoly ?",
    "gagnerait un quiz de culture générale ?",
    "s'énerve le plus aux jeux de société ?",
    "gagnerait une course en sac ?",
    "ne laisserait jamais gagner un enfant ?",
    "compte les points même quand personne ne joue ?",
    "s'entraîne en secret pour battre les autres ?",
    "trouverait toujours une excuse après une défaite ?",
    "gagnerait un concours de mangeur de crêpes ?",
    "ferait le meilleur capitaine d'équipe ?",
    "serait capable de bluffer au poker toute une nuit ?",
    "connaît les règles mieux que l'arbitre ?",
    "demanderait la revanche… de la revanche ?",
    "gagnerait à cache-cache (parce qu'il est parti) ?",
    "célèbre une victoire comme une finale de Coupe du monde ?",
    "serait imbattable au Mario Kart ?",
    "ferait un discours de vainqueur interminable ?",
    "jure que « c'était pour rire » après avoir perdu ?",
  ],
  soiree: [
    "danse en premier sur la piste ?",
    "monopolise la playlist toute la soirée ?",
    "s'endort le premier sur le canapé ?",
    "connaît toutes les paroles des chansons des années 2000 ?",
    "finit la soirée à refaire le monde dans la cuisine ?",
    "lance toujours le karaoké ?",
    "rentre le plus tard… ou plutôt le plus tôt le matin ?",
    "se transforme en DJ après minuit ?",
    "repart avec la déco de la fête ?",
    "mange tous les apéritifs avant l'arrivée des invités ?",
    "propose le jeu qui part en n'importe quoi ?",
    "fait des câlins à tout le monde en fin de soirée ?",
    "organise l'after sans prévenir personne ?",
    "prend 200 photos et n'en poste aucune ?",
    "est le plus déguisé à une soirée « sans thème » ?",
    "raconte toujours la même anecdote en soirée ?",
    "range tout le lendemain sans qu'on lui demande ?",
    "dit « je ne reste pas longtemps » et ferme la soirée ?",
  ],
};

/** Questions ajoutées par l'hôte (dossier quidenous/). */
let custom: WhoisQuestion[] = [];

export function addCustomWhoisQuestions(qs: WhoisQuestion[]) {
  const seen = new Set(custom.map((q) => q.text));
  for (const q of qs) if (!seen.has(q.text)) { custom.push(q); seen.add(q.text); }
}

/** Format d'une ligne : `catégorie | question` (ou juste `question` → Soirée). */
export function parseWhoisQuestions(text: string): WhoisQuestion[] {
  const cats = Object.keys(BANK) as WhoisCategory[];
  const out: WhoisQuestion[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const bar = line.indexOf("|");
    let cat: WhoisCategory = "soiree";
    let q = line;
    if (bar > 0) {
      const c = line.slice(0, bar).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const found = cats.find((k) => k === c || c.startsWith(k.slice(0, 5)));
      if (found) cat = found;
      q = line.slice(bar + 1).trim();
    }
    q = q.replace(/^qui de nous\s*/i, "").trim();
    if (q.length < 4) continue;
    if (!q.endsWith("?")) q += " ?";
    out.push({ text: q.slice(0, 160), category: cat });
  }
  return out;
}

export function whoisBank(categories: WhoisCategory[]): WhoisQuestion[] {
  const out: WhoisQuestion[] = [];
  for (const c of categories) for (const text of BANK[c]) out.push({ text, category: c });
  for (const q of custom) if (categories.includes(q.category)) out.push(q);
  return out;
}

export function whoisBankSize(): number {
  return Object.values(BANK).reduce((n, l) => n + l.length, 0) + custom.length;
}
