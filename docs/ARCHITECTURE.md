# LeBoum — Architecture (audit Phase 1 + évolutions)

> Document vivant. Mis à jour à chaque phase de la feuille de route
> « Vision long terme & feuille de route — Jeux de soirée ».

## 1. Architecture actuelle (constat de l'audit)

```
apps/web/                 Next.js 14 (App Router) + Tailwind — le site leboum.fr
  app/page.tsx            Accueil (créer / rejoindre un salon)
  app/room/[code]/        Salle d'attente (lobby) + aiguillage vers la vue du jeu
  components/*View.tsx    Une vue React par jeu (QuizView, BombeView, DrawGameView…)
  components/ResultsScreen Podium de fin (utilisé par Œil de Boum / Pixel Panic)
  lib/useRoom.ts          Hook temps réel : WebSocket, état, actions client
packages/shared/          Cœur pur, typé, sans réseau — partagé client ⇄ serveur
  room/                   Salon générique : joueurs, hôte, présence, prêt, Pass Soirée
  platform/types.ts       Contrat GameModule<State, Public, Settings, ClientMsg>
  games/<jeu>/            Un dossier par jeu : types, engine (réducteur pur), module
  game/                   Jeu historique « Sous-titres » (chemin dédié côté serveur)
  protocol.ts             Messages client ⇄ serveur
server/index.ts           Adaptateur Node + ws : présence, diffusion, timers, relais éphémères
```

**Temps réel.** Un serveur WebSocket unique (`server/index.ts`). Chaque salon
garde un `RoomState` (lobby) et, pendant une partie, un module de jeu générique
`room.mod = { module, state }`. Le serveur appelle `reduce()` sur chaque action,
replanifie un seul timer sur `deadline(state)`, puis diffuse à chaque joueur sa
projection `project(state, joueur)` (les secrets ne sortent jamais du serveur).

**Jeux.** 9 modules branchés dans `GAME_REGISTRY` : draw, fakeartist, relay,
doublage, quiz, reco, pixel, bombe, mimic (+ Sous-titres, chemin historique).
Les moteurs sont des réducteurs purs `reduce(state, action, { now, rng })`,
couverts par ~300 tests (`npm test`).

**Points forts.** Le contrat `GameModule` existe déjà et fonctionne ; le salon
est indépendant des jeux ; « Rejouer » et « Retour au salon » ne recréent pas
le salon ; les moteurs sont testables sans réseau.

## 2. Problèmes relevés

1. **Métadonnées éparpillées** : le nom, l'image, la couleur, les joueurs min/max,
   la description d'un jeu sont recopiés dans 4 fichiers (`page.tsx` ×3 tables,
   `GameIntro.tsx`, `module.meta`). Ajouter un jeu = toucher 5 endroits, avec
   des incohérences (ex. « Reconnaissance » vs « Œil de Boum »).
2. **Pas de résultat standard** : chaque jeu garde ses scores à sa façon
   (`scores`, `lives`/`eliminated` pour Boum Rush, rien pour Doublage).
   Impossible d'enchaîner des jeux avec un score commun.
3. **Pas de notion de soirée** : une partie = un jeu ; le score disparaît au
   retour au salon.
4. **Phase finale propre à chaque vue** : la table `FINAL_PHASE` du lobby
   duplique l'information `isOver()` du moteur.

## 3. Architecture recommandée (mise en place progressivement)

```
Lobby ─► Game Mode ─► Gameplay ─► Résultats ─► Score ─► Retour lobby / jeu suivant
            │                         │
   GAME_CATALOG (fiche)     module.results(state) → GameResult
                                      │
                         Soirée : points de soirée cumulés + classement
```

* **Fiche de jeu commune** — `packages/shared/src/platform/catalog.ts` :
  `GAME_CATALOG[id]` = nom, accroche, icône/image, couleur, catégorie
  (créatif, réflexion, social, chaos, culture), joueurs min/max, durée, règles.
  Source unique pour le lobby, l'écran d'annonce, le générateur de soirée.
* **Résultat standard** — chaque module expose `results(state)` qui renvoie
  `{ scores, order?, coop? }` une fois la partie terminée. Le serveur expose
  aussi `over` dans le message d'état (fin de `FINAL_PHASE`).
* **Soirée LeBoum** — moteur pur `packages/shared/src/soiree/` : une liste de
  jeux, l'index courant, l'historique des résultats et le total par joueur.
  Le serveur enchaîne les jeux dans le même salon.
* **Score global** — chaque jeu garde son barème ; à la fin d'un jeu, son
  classement est converti en *points de soirée* par place (voir `soiree/score.ts`),
  ce qui rend comparables un quiz à 3 000 points et une Boum Rush sans points.

Règle : on n'ajoute un jeu qu'en créant `games/<id>/` + une fiche catalogue +
une vue ; aucun autre jeu n'est touché.

## 4. Soirée LeBoum (Phases 3–4) — fonctionnement

* L'hôte compose un programme dans le salon (carte « Soirée LeBoum ») puis
  envoie `soiree_start { items: [{ gameId, settings }] }`.
* Le serveur lance le jeu courant ; dès que `isOver()` devient vrai, il
  enregistre `results()` dans la soirée (`syncSoiree`). Une revanche du même
  jeu (« Rejouer ») **remplace** son résultat — jamais de double comptage.
* `soiree_next` enchaîne le jeu suivant **sans repasser par le salon**. Un jeu
  injouable avec le nombre de joueurs présents est sauté (message système).
* Après le dernier jeu : retour au salon avec `soiree.finished = true` →
  écran « Fin de soirée » (podium + distinctions). `soiree_rematch` relance le
  même programme à zéro, `soiree_end` ferme la soirée.
* Points de soirée par place : 10 / 7 / 5 / 4 / 3 puis 2 ; égalité = mêmes
  points ; coopératif = 5 pour tout le monde (`soiree/score.ts`).
* **Générateur de soirée** (phase 14, `soiree/generator.ts`) : l'hôte choisit
  un format (Soirée rapide, 45 min, Chaos, Entre potes, Créative, Cerveau,
  Grande soirée). Un format impose des jeux (remplacés par un jeu de la même
  famille s'ils sont injouables au nombre de joueurs présents) ou fixe des
  quotas par famille (tirage sans doublon, familles alternées). Les formats
  courts utilisent des réglages « express » (`SHORT_SETTINGS`). Le résultat
  remplit simplement le programme du constructeur : l'hôte peut retirer,
  réordonner, ajouter ou relancer un tirage avant de lancer.

## 5. Ajouter un nouveau jeu — check-list

1. `packages/shared/src/games/<id>/` : `types.ts`, `engine.ts` (réducteur pur),
   `module.ts` (avec `results()`), `engine.test.ts`.
2. Fiche dans `platform/catalog.ts` + module dans `platform/registry.ts`.
3. Vue `apps/web/components/<Id>View.tsx` + aiguillage dans `room/[code]/page.tsx`
   (et ses réglages dans `MODE_SETS` / `TIMES` / `ROUNDS`).
4. `npm test` — le test `platform/modes.test.ts` vérifie automatiquement la
   fiche, le cycle de vie complet et le résultat standard du nouveau jeu.

## 6. Journal des phases

| Phase | État | Où |
|---|---|---|
| 1 — Audit | ✅ | ce document (§1–3) |
| 2 — Game Modes standardisés | ✅ | `platform/catalog.ts`, `platform/result.ts`, `module.results()` |
| 3 — Soirée LeBoum | ✅ | `soiree/engine.ts`, `components/Soiree.tsx` |
| 4 — Score global | ✅ | `soiree/score.ts` (points par place, égalités partagées) |
| 5 — Qui de nous ? | ✅ | `games/whois/`, `WhoisView.tsx` |
| 6 — La Plus Drôle | ✅ | `games/funny/`, `FunnyView.tsx` |
| 7 — Imposteur (mot) | ✅ | `games/imposter/`, `ImposterView.tsx` |
| 8 — Téléphone cassé | ✅ | `games/phone/`, `PhoneView.tsx`, `DrawPad.tsx` |
| 9 — Mot interdit | ✅ | `games/taboo/`, `TabooView.tsx`, `platform/text.ts` |
| 10 — Ni oui ni non | ✅ | `games/yesno/`, `YesNoView.tsx` |
| 11 — Devine qui | ✅ | `games/guesswho/`, `GuessWhoView.tsx` |
| 12 — Top / Classement | ✅ | `games/ranking/`, `RankingView.tsx` |
| 13 — Enrichir LeBoum (familles) | ✅ | `platform/catalog.ts` (`gamesByCategory`), lobby |
| 14 — Générateur de soirée | ✅ | `soiree/generator.ts`, `Soiree.tsx` (`SoireeBuilder`) |

**Composants communs des jeux « social »** : `components/social/kit.tsx`
(en-tête + chrono, carte de question, grille de vote, écran final avec
distinctions). Un nouveau jeu social réutilise ce kit plutôt que de recopier.

**Distinctions** : `bestBy()` ne décerne une distinction qu'à un vainqueur
unique (égalité en tête = pas de distinction, plutôt qu'un choix au hasard).
Le podium (`ResultsScreen`) partage les places en cas d'égalité (1, 1, 3).

### Imposteur — règles du moteur

* Flux d'une manche : carte secrète → ordre de parole → indices (chrono par
  joueur ; 2 tours jusqu'à 6 joueurs, 1 au-delà) → vote → (classique :
  dernière chance de l'imposteur démasqué) → révélation.
* Modes : **classique** (l'imposteur le sait, ne voit que la catégorie, ne
  parle jamais en premier) et **infiltré** (mot voisin, rôle inconnu de tous).
* Barème : bon vote +100 ; imposteur pas démasqué (y compris égalité) +250 ;
  démasqué mais trouve le mot +150.
* Le rôle tourne : un nouvel imposteur à chaque manche tant que possible.
* L'identité de l'imposteur ne sort jamais du serveur avant la révélation ;
  un indice qui contient le mot secret est refusé.
* Mots perso : `imposteur/*.txt` (« catégorie | mot | mot proche »).

### Téléphone cassé — règles du moteur

* Chaque joueur lance une chaîne (phrase). À l'étape k, le joueur placé k rangs
  après le propriétaire la reçoit : texte → dessin → texte… Personne ne revoit
  sa propre chaîne avant la révélation.
* Longueur : 5 étapes max en classique (`min(joueurs, 5)`), une par joueur en
  « tour complet ». Écriture ≈ 60 % du temps de dessin.
* Rien rendu à temps : phrase de secours tirée au sort à l'étape 1 (la chaîne
  doit vivre), rendu vide ensuite. Un absent ne bloque jamais l'étape.
* Dessins : ardoise locale `components/DrawPad.tsx` (réutilisable), exportée en
  WebP/JPEG 480×360 (< 190 Ko), validée côté moteur (`data:image/…`, ≤ 200 Ko).
  Ils ne transitent qu'une fois : jamais renvoyés en écho pendant le jeu, et
  la révélation n'envoie que la chaîne en cours.
* Révélation étape par étape (chrono auto, l'hôte peut accélérer), « J'adore »
  = +100 pour l'auteur → distinctions « Meilleur dessinateur » / « Plume d'or ».
* Phrases perso : `telephone/*.txt`.

### Mot interdit — règles du moteur

* Chaque joueur fait deviner une fois par tour de table (1 à 3 tours). Passage :
  « prêt » (le donneur lance, 12 s max) → chrono → récap. Les absents sont sautés,
  les arrivants passent en fin de tour.
* **Écrit** : le serveur refuse tout indice contenant le mot ou un mot interdit
  (variantes comprises : pluriel, « danser » pour « danse ») — l'indice n'est
  jamais diffusé, carte perdue, −50. Les réponses sont validées automatiquement.
* **À voix haute** : le joueur suivant est le censeur (voit la carte, buzze) ;
  le donneur désigne qui a trouvé.
* Barème : carte trouvée +100 au donneur et +100 à celui qui trouve.
* `platform/text.ts` regroupe la comparaison de mots (`normalizeWord`,
  `isWordGuess`, `findForbidden`) — partagée avec l'Imposteur.
* Cartes perso : `motinterdit/*.txt` (« mot | interdit, interdit… »).

### Ni oui ni non — règles du moteur

* Chaque joueur est la cible une fois par tour de table (1 à 3 tours) :
  « prêt » (6 s) → chrono (20–120 s, 45 par défaut) → résultat.
* **À voix haute** : n'importe qui (sauf la cible) appuie sur « Il l'a dit ! ».
  Le chrono de la cible est gelé, les autres joueurs votent en 10 s ; égalité
  = la cible est sauvée et le chrono reprend là où il était.
* **Par écrit** : le serveur repère seul oui / non et leurs variantes
  (ouais, nan, ouiii, yes…), sans faux positif sur ouistiti, oignon, nonante…
  Le piégeur est l'auteur de la dernière question.
* Barème : cible +5 par seconde tenue (+100 si elle tient jusqu'au bout),
  piégeur +150, fausse alerte −50.

### Devine qui — règles du moteur (version simple)

* Le rôle de Maître du secret tourne à chaque manche (1 à 10). Manche :
  secret (le Maître découvre la personne, 10 s max) → enquête (chrono, 120 s
  par défaut) → révélation.
* **Célébrités** : 85 personnalités et personnages (avec indice pour le Maître
  et alias acceptés : « Zizou », « Darth Vader », nom de famille seul…).
  **Entre nous** : la personne mystère est un joueur du salon (jamais le Maître).
* Stock commun de 20 questions : oui/non en consomment une, « je ne sais pas »
  et « écartée » non ; une mauvaise proposition en coûte une. Une seule question
  en attente par joueur (pas de spam).
* Barème : celui qui trouve +100 et +10 par question restante ; le Maître +50
  si la table trouve (il a intérêt à bien répondre).

### Le Top — règles du moteur

* 2 à 10 manches, une consigne par manche et 5 éléments à ranger (chrono, 45 s
  par défaut). On peut renvoyer son classement tant que tout le monde n'a pas
  validé ; envoi automatique juste avant la fin du chrono.
* **Le bon ordre** : 24 consignes factuelles (valeurs arrondies affichées à la
  révélation). **Comme la table** : 15 consignes subjectives, l'ordre attendu est
  la place moyenne de chaque élément (il faut au moins 2 classements).
* Barème par élément selon l'écart à la bonne place : 0 → +100, 1 → +50,
  2 → +20, au-delà 0 ; ordre parfait : +100 de bonus (max 600 par manche).
* Sécurité : l'ordre interne des éléments EST la réponse. Le client ne reçoit
  que les éléments mélangés et parle en positions affichées ; le serveur traduit.

### Familles de jeux (phase 13)

| Famille | Jeux |
|---|---|
| Créatif | Boum Dessin (+ Faux-artiste, Relais), Téléphone cassé, Œil de Boum |
| Réflexion | Ça te parle ?, Mot interdit, Le Top |
| Social | Qui de nous ?, La Plus Drôle, Imposteur, Devine qui, Ni oui ni non |
| Chaos | Boum Rush, Pixel Panic |
| Culture pop | Mimic Boum (Doublage et Sous-titres existent mais restent masqués) |

La famille vient de la fiche catalogue (`category`) ; le lobby regroupe les jeux
par famille avec des filtres, et l'écran d'annonce affiche la famille. Le test
`platform/modes.test.ts` vérifie le rangement. Un nouveau jeu n'a qu'à déclarer
sa famille dans sa fiche.
