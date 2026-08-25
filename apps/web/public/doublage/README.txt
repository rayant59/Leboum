🎬 TES VIDÉOS POUR LE JEU "DOUBLAGE"
====================================

⚠️ Il n'y a plus aucune scène de test : le jeu utilise EXCLUSIVEMENT
les vidéos de ce dossier.

DEUX ÉTAPES
-----------
  1) Copie tes vidéos DANS CE DOSSIER (public/doublage/)
        format conseillé : .mp4 (H.264) — lu par tous les navigateurs
        exemples : bagarre.mp4, restaurant.mp4

  2) Décris-les dans "scenes.txt" (même dossier), une par ligne.

FORMAT
------
     fichier.mp4 | Titre de la scène | durée = Personnage A | Personnage B

  - Le TITRE est facultatif (par défaut : le nom du fichier).
  - La DURÉE est en SECONDES. Mets 0 (ou rien) pour que l'hôte
    termine la scène à la main.
  - Après le "=", la liste des personnages séparés par des "|".
    Le nombre de personnages = le nombre de joueurs qui doublent.

EXEMPLES
--------
     bagarre.mp4 | La bagarre | 25 = Le héros | Le méchant
     restaurant.mp4 | Au restaurant | 40 = Le client | Le serveur | Le chef
     scene3.mp4 = Voix 1 | Voix 2

BON À SAVOIR
------------
  - Coupe le SON de tes extraits si tu veux que les joueurs doublent
    vraiment (sinon on entend l'audio d'origine).
  - Garde des extraits COURTS (15-45 s) : c'est bien plus drôle.
  - Évite les accents et espaces dans les noms de fichiers.
  - Le serveur affiche au démarrage :
        [doublage] N scène(s) chargée(s)
    et signale toute vidéo introuvable.
  - Après ajout : relance/redéploie le serveur ET le site
    (la vidéo est un fichier du site).
