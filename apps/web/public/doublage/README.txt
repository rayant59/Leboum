Scènes du mode Doublage
=======================
Dépose ici tes fichiers vidéo (mp4 conseillé) et référence-les dans le
catalogue : packages/shared/src/games/doublage/videos.ts

Chaque scène = { id, title, src, durationMs, characters[] }.
- src : "/doublage/ton-fichier.mp4"
- durationMs : durée en millisecondes (0 = l'hôte termine à la main)
- characters : liste des rôles à doubler

La scène démo utilise /le-nom.mp4 (déjà présent) pour tester tout de suite.
