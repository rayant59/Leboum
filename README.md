# Sous-Titre — plateforme de jeux entre amis 🎉

Une plateforme de **party games** multijoueur (interface en français), jouable
sur ordinateur et téléphone, sur le même Wi-Fi. Crée une salle, partage le code,
et lancez une partie ensemble en temps réel.

## 🎮 Les jeux

| Jeu | Joueurs | Principe |
|-----|:------:|----------|
| **Sous-titres** 🎬 | 3+ | Un extrait muet ; chacun invente le sous-titre le plus drôle, puis on vote (anonymement). |
| **Dessin & Devinette** ✏️ | 2+ | Un joueur dessine un mot secret, les autres devinent au chat. 5 modes (voir plus bas). |
| **Faux-artiste** 🕵️ | 3+ | Tout le monde dessine le même mot… sauf un imposteur qui l'ignore. Puis on vote pour le démasquer. |
| **Relais** 🔁 | 3+ | Deux joueurs se relaient au crayon (rotation automatique) sur le même mot ; les autres devinent. |

### Modes du jeu de dessin
- **Classique** — dessin & devinette classiques, points au temps.
- **Turbo** — manches courtes et nerveuses.
- **Aveugle** 🙈 — le dessinateur ne voit pas son propre trait.
- **Contraintes** — chaque manche impose une règle *réellement appliquée* quand
  c'est vérifiable (une seule couleur, uniquement lignes & ronds, max 10 traits…),
  volontaire sinon (main non-dominante…).
- **Coopératif** 🤝 — les points sont mis en commun : score d'équipe, pas de compétition.

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
(id, meta, createState, reduce, project, deadline, isOver) et s'enregistre dans le
registre du serveur — sans toucher aux autres jeux.

## ✅ Tests

```bash
npm test          # tests du cœur (packages/shared) + e2e serveur
```

À l'unité (via `tsx`) :
```bash
npx tsx packages/shared/src/games/draw/engine.test.ts
npx tsx server/e2e.test.ts
```

État actuel : **143 tests** (salle, sous-titres, réglages, twists, dessin,
faux-artiste, relais, avatars + e2e serveur bout-en-bout).

Vérifier les types partout :
```bash
npm run typecheck
```

## 📦 Notes

- `packages/shared/src/game/clips.ts` et `apps/web/public/*` t'appartiennent :
  ils ne sont pas inclus dans les archives de livraison, pour ne jamais écraser
  tes extraits vidéo ni tes assets.
- Jeu pensé pour du LAN (téléphones sur le même Wi-Fi que le PC hôte).
