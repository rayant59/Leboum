DICTIONNAIRE DU MODE « BOMBE »
================================

Le fichier mots.txt contient la liste des mots français acceptés dans le mode
Bombe (BombParty). Un mot par ligne. Les lignes vides ou commençant par # sont
ignorées. Les accents, majuscules et espaces sont normalisés automatiquement
(ARBRE, arbre, Arbré → arbre).

Le serveur charge TOUS les .txt de ce dossier au démarrage. Après modification,
relance le serveur (npm run dev:server).

Tu peux :
  - AJOUTER tes propres mots (ex. de l'argot, des noms de jeux…) en les
    ajoutant à la fin du fichier ;
  - remplacer complètement la liste par la tienne.

Le dictionnaire sert à deux choses :
  1. valider les mots tapés par les joueurs ;
  2. générer des syllabes réellement jouables (présentes dans assez de mots).
