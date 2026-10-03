# Identité LeBoum (phase 16)

LeBoum, c'est **la soirée de jeux entre potes, à la française** : drôle,
rapide, accessible, un peu chaotique. Tout ce qui s'affiche doit sonner
« LeBoum », pas « app générique » ni « clone de Jackbox / Skribbl ».

## Le ton (la voix)

- On **tutoie**. On parle comme un pote qui anime la soirée, pas comme un logiciel.
- Drôle et un peu chaotique, **jamais méchant** ni vulgaire. On taquine le
  perdant (« La lanterne rouge… la revanche t'attend. »), on ne l'humilie pas.
- Court. Une phrase, pas un paragraphe. Les règles tiennent en 3 puces.
- Pas de jargon : « l'hôte », « le salon », « la soirée », « la manche ».
- Les phrases d'ambiance vivent dans **`apps/web/lib/voice.tsx`** (`VOICE`) :
  attente de l'hôte, connexion, annonce d'un jeu, enchaînement en soirée.
  Pour une nouvelle situation, on ajoute une clé là plutôt que d'écrire la
  phrase en dur dans un composant. `<WaitHost />` et `<VoiceLine k="…" />`
  les affichent (rotation douce, sans écart d'hydratation).

| À éviter | Plutôt |
|---|---|
| « En attente de l'hôte… » | « L'hôte réfléchit… ou il est parti chercher des chips. » |
| « Connexion au serveur… » | « Connexion… on gonfle les ballons. » |
| « Fin de partie » (en soirée) | « Fin de soirée ! » |
| « Rejouer » | « Revanche ! » |

## Les icônes

- **Pas d'emoji comme icône d'interface.** Toutes les icônes viennent de
  **`components/BoumIcon.tsx`** (`<BoumIcon name="trophy" />`,
  `<PlaceMedal place={1} />`) : trait arrondi épais + remplissage teinté à 18 %.
- Les emojis restent permis là où ce sont **les joueurs qui s'expriment**
  (réactions) et, avec parcimonie, en fin de phrase pour le ton.
- Une icône décorative n'a pas de `label` ; une icône seule dans un bouton en a un.

## Couleurs

| Rôle | Couleur |
|---|---|
| Fond nuit | `#0E0B1A` → `#14102A` (dégradés violets) |
| Surfaces | `rgba(28,22,54,.6–.75)`, bordure `#332A5A` |
| Texte / atténué / discret | `#F3EEFF` / `#A79FC7` / `#6E6796` |
| Or (accent principal, victoire, soirée) | `#FFC24B` |
| Magenta (énergie, « BOUM ! », erreurs) | `#FF4D8D` |
| Menthe (prêt, bonne réponse, coop) | `#46E0B0` |
| Violet (réflexion) / Cyan (créatif) | `#8B7DF6` / `#4CC9F0` |

Chaque jeu a sa couleur d'accent (`GAME_CATALOG[id].accent`) et chaque famille
sa teinte (`GAME_CATEGORIES`).

## Typographie

- **Bricolage Grotesque** (titres, chiffres, noms) : gras 700–800, serré.
- **Space Mono** (sur-titres, compteurs) : majuscules, interlettrage large.
- **Inter** (texte courant).

## Sons (Web Audio, `lib/sound.tsx`)

- `boum` — **signature** : grave qui chute + étincelles. Joué à l'annonce de
  chaque jeu (`GameIntro`).
- `champion` — boum + fanfare : vainqueur de la soirée.
- Les autres (`correct`, `vote`, `reveal`, `timeUp`…) sont partagés par tous les
  jeux. Un nouveau jeu réutilise ces noms plutôt que d'inventer ses bips.

## Animations

- **Annonce d'un jeu** : le nom « claque » à l'écran (`gi-slam`), pastille
  « Soirée · jeu 2/4 » qui tombe, leader actuel + phrase d'enchaînement.
- **Victoire** : confettis aux couleurs LeBoum + **onde de choc et tampon
  « BOUM ! »** pour le gagnant (`ResultsScreen`).
- Entrées en `pop-in` / `sk-rise` (≤ 0,4 s), décalées de 60–120 ms.
- On respecte `prefers-reduced-motion` pour les effets plein écran.

## Check-list pour un nouvel écran

1. Les textes passent le test « un pote pourrait le dire à voix haute ».
2. Aucune icône emoji ; `BoumIcon` sinon on en dessine une nouvelle dans le set.
3. Couleurs et polices du tableau ci-dessus, accent du jeu pour sa vue.
4. Un son du set partagé aux moments clés (début, bonne réponse, révélation, fin).
5. Ça marche à 390 px de large.
