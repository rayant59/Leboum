# LeBoum — les jeux de soirée entre potes 🎉

Une plateforme de **party games** multijoueur en français, jouable sur
ordinateur et téléphone. Crée un salon, partage le code, et enchaînez les jeux
dans une **Soirée LeBoum** avec un classement commun.

## 🎮 Les jeux

| Jeu | Famille | Joueurs | Principe |
|-----|---------|:------:|----------|
| **Boum Dessin** | Créatif | 2+ | Un joueur dessine un mot secret, les autres devinent. Modes : classique, aveugle, contraintes, coop, Faux-artiste, Relais. |
| **Téléphone cassé** | Créatif | 3+ | Phrase → dessin → description → dessin… puis on dévoile chaque chaîne. Modes : classique (5 étapes), tour complet. |
| **Œil de Boum** | Créatif | 1+ | Une image s'affiche : trouve le personnage, le film, le lieu… |
| **Ça te parle ?** | Réflexion | 1+ | Quiz chronométré (classique, vitesse, survie, équipes). |
| **Mot interdit** | Réflexion | 3+ | Fais deviner un max de mots sans dire les mots interdits. Modes : écrit (validation automatique), à voix haute (avec censeur). |
| **Devine qui** | Social | 3+ | Le Maître du secret connaît une personne mystère ; 20 questions oui/non pour la trouver. Modes : célébrités, entre nous. |
| **Le Top** | Réflexion | 1+ | Classe 5 éléments dans le bon ordre (poids, dates, distances…). Modes : le bon ordre, comme la table (consensus). |
| **Qui de nous ?** | Social | 3+ | « Qui de nous… ? » : tout le monde vote pour un joueur. |
| **La Plus Drôle** | Social | 3+ | Complète la phrase en secret, puis vote pour la meilleure réponse anonyme. |
| **Imposteur** | Social | 3+ | Tout le monde a le même mot sauf un. Indices à tour de rôle, puis vote. Modes : classique, infiltré. |
| **Ni oui ni non** | Social | 3+ | La cible ne doit jamais dire oui ni non ; les autres la piègent. Modes : à voix haute (buzz + vote éclair), par écrit (détection automatique). |
| **Boum Rush** | Chaos | 2+ | Trouve un mot avec la syllabe avant que la bombe explose. |
| **Pixel Panic** | Chaos | 1+ | L'image se dévoile pixel par pixel. |
| **Mimic Boum** | Culture pop | 2+ | Imite un son culte avec ta voix, puis votez. |

**Soirée LeBoum** : l'hôte compose un programme de plusieurs jeux ; les points
de soirée s'additionnent d'un jeu à l'autre jusqu'au classement final.
Pas d'idée ? Le **générateur** propose une soirée toute prête (rapide, 45 min,
Chaos, entre potes, créative, cerveau, grande soirée) — modifiable avant de lancer.
À la fin : podium, bilan de chacun, distinctions (meilleur dessinateur, meilleur
menteur, réponse la plus drôle, remontada…), le film de la soirée et la revanche.

**Contenus perso** (relancer le serveur après modification) : `questionquizz/`,
`motdessin/`, `motbombe/`, `quidenous/`, `plusdrole/`, `imposteur/`, `telephone/`, `motinterdit/` — chaque
dossier contient un `README.txt` qui explique le format.

## 🚀 Démarrer en local (2 terminaux)

Prérequis : **Node 20** (`node -v` → `v20.x`).

```bash
npm install
```

**Terminal 1 — le serveur des parties** (laisse-le ouvert) :
```bash
npm run dev:server        # → ws://localhost:1999
```

**Terminal 2 — le site** :
```bash
npm run dev:web           # → http://localhost:3000
```

Ouvre http://localhost:3000, crée une partie, puis partage le lien « Inviter »
(ou le code) dans un autre onglet — ou sur ton téléphone, même Wi-Fi — pour voir
la synchro en direct.

> Après toute modification du **serveur**, relance `npm run dev:server`.
> Le site (`dev:web`) se recharge tout seul.

## 🧩 Personnalisation

- **Éditeur de design (`/design`, en local uniquement)** : lance `npm run dev:server`
  et `npm run dev:web`, puis ouvre http://localhost:3000/design sur ton PC. Un
  panneau s'affiche par-dessus le vrai site. Onglet **Contenu** : clique sur
  n'importe quel élément pour changer son texte, son lien, son image ou son
  style, le cacher, le déplacer à la souris, ou ajouter un texte / titre /
  bouton / image à côté (Ctrl+Z pour annuler). Couleurs, thèmes tout prêts,
  polices (Google Fonts) et CSS libre s'appliquent **instantanément**.
  **« Publier » enregistre dans `site-theme.json`** (à la racine, suivi par git) :
  un commit + push envoie ton design en ligne avec le code.
  Sur le site en ligne, `/design` n'existe pas et le serveur refuse toute
  modification : personne ne peut toucher au design depuis Internet.
  Côté code : toutes les couleurs passent par les variables `--c-*` de
  `apps/web/app/globals.css` (classes Tailwind `bg-gold`, `text-text-muted`…
  ou `rgb(var(--c-gold))` en style inline) — n'écris plus de couleur du thème
  en dur, sinon l'éditeur ne pourra pas la changer.
- **Onglet « Admin » de l'éditeur (en local uniquement)** — pour tester et retoucher
  chaque écran de jeu :
  - **Figer le temps** : chronos, décomptes 3·2·1, annonce du jeu et bots
    s'arrêtent ; la page reste cliquable et modifiable (onglet Contenu). Une
    pastille « Temps figé · Reprendre » reste affichée en bas à gauche.
  - **Étape suivante** (même figé), **Revoir l'annonce** du jeu, et **Lancer**
    n'importe quel jeu directement.
- **Bots de test (même onglet)** : crée un
  salon, puis ajoute 1, 3 ou autant de bots que de places. Ils se mettent prêts,
  jouent, votent et devinent tout seuls dans tous les mini-jeux (niveau Facile /
  Normal / Fort, pause possible). Ils dessinent des gribouillis, envoient des bips
  au Mimic et « trichent » un peu pour trouver le mot selon leur niveau. Le serveur
  refuse l'API `/admin/*` depuis Internet. Code : `packages/shared/src/bots/brain.ts`
  (décisions) et `server/index.ts` (gestion des bots).
- **Avatars** : chaque joueur peut importer une image (recadrée en carré) depuis
  le salon. Sinon, initiales colorées par défaut.
- **Icônes d'outils** : dépose tes PNG dans `apps/web/public/tools/`
  (`brush.png`, `eraser.png`, `fill.png`, `line.png`, `rect.png`, `circle.png`,
  `arrow.png`, `clear.png`). Absents → jolies icônes SVG par défaut.
- **Extraits « sous-titres »** : gérés dans `packages/shared/src/game/clips.ts`
  (fichier t'appartenant — jamais écrasé par les livraisons).

## 🏗️ Architecture

Monorepo npm workspaces (`apps/*`, `packages/*`) :

```
packages/shared/     Cœur pur & typé (aucune dépendance réseau)
  room/              Salle générique (joueurs, hôte, présence) — réutilisée par tous les jeux
  platform/          Contrat GameModule<State,Public,Settings,ClientMsg>
  games/
    draw/            Jeu de dessin (moteur, mots, modes)
    fakeartist/      Faux-artiste
    relay/           Relais
  game/              Jeu « sous-titres » (chemin dédié, historique)
  protocol.ts        Messages client ⇄ serveur
server/              Adaptateur fin (Node + ws) : présence, diffusion, timers
apps/web/            Next.js 14 (App Router) + Tailwind
```

**Principe clé — moteurs purs :** les règles sont des *réducteurs* purs
`reduce(state, action, ctx)` (ctx = `{ now, rng }`), entièrement testables sans
réseau. Le serveur est un adaptateur mince : il gère la présence, un timer qui se
replanifie sur l'échéance de l'état, l'anonymisation (jetons) et le relais des
messages éphémères (traits de dessin, chat, remplissage).

**Contrat plateforme :** chaque nouveau jeu implémente un `GameModule`
(id, meta, createState, reduce, project, deadline, isOver, results), a sa fiche
dans `platform/catalog.ts` et s'enregistre dans `platform/registry.ts` — sans
toucher aux autres jeux. Détails et check-list : `docs/ARCHITECTURE.md` ;
ton, icônes, couleurs et sons : `docs/IDENTITE.md`.

## ✅ Tests

```bash
npm test          # tests du cœur (packages/shared) + e2e serveur
```

À l'unité (via `tsx`) :
```bash
npx tsx packages/shared/src/games/draw/engine.test.ts
npx tsx server/e2e.test.ts
```

Chaque jeu a ses tests de moteur, `platform/modes.test.ts` vérifie que tous les
Game Modes respectent le socle commun, et `server/e2e.test.ts` joue de vraies
parties à travers le serveur WebSocket.

Vérifier les types partout :
```bash
npm run typecheck
```

## 📦 Notes

- `packages/shared/src/game/clips.ts` et `apps/web/public/*` t'appartiennent :
  ils ne sont pas inclus dans les archives de livraison, pour ne jamais écraser
  tes extraits vidéo ni tes assets.
- Jeu pensé pour du LAN (téléphones sur le même Wi-Fi que le PC hôte).

## 💶 Monétisation & statistiques (réglages)

Tout est désactivé par défaut ; chaque brique s'allume avec une variable d'environnement.

**Site (Northflank → service `leboum-web` → Build arguments, puis rebuild)**

| Variable | Effet |
|---|---|
| `NEXT_PUBLIC_SUPPORT_URL` | Lien Ko-fi/Tipeee → bouton « Paie ta tournée à LeBoum » (accueil, salon, fin de partie, fin de soirée). Ou plus simple : colle le lien dans `DONATION_URL` en haut de `apps/web/lib/site.ts`. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Contact (page Entreprises, mentions légales, CGV) |
| `NEXT_PUBLIC_LEGAL_NAME` / `_SIRET` | Éditeur du site (nom et SIRET — aucune adresse postale n'est affichée) |
| `NEXT_PUBLIC_LEGAL_MEDIATOR` | Médiateur de la consommation (obligatoire pour vendre) |

**Serveur de jeu (Northflank → service `leboum-server` → Environment variables)**

| Variable | Effet |
|---|---|
| `STATS_TOKEN` | Code d'accès de la page `/stats` (fréquentation anonyme) |
| `STRIPE_SECRET_KEY` + `STRIPE_PASS_PRICE` | Active le **Pass Soirée** (Stripe Checkout) |
| `PASS_PRICE_LABEL` | Prix affiché, ex. `2,99 €` (doit correspondre au prix Stripe) |
| `PUBLIC_SITE_URL` | `https://leboum.fr` (retour après paiement) |
| `STATS_FILE` / `PASS_FILE` | Fichiers de sauvegarde (à placer sur un disque persistant) |

En local, `PASS_DEV_FAKE=1 npm run dev:server` simule le paiement (jamais en production).
