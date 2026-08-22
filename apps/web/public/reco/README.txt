IMAGES LOCALES POUR LE MODE "RECONNAISSANCE"
============================================

Wikipedia ne fournit PAS d'images pour la pop-culture (persos d'anime,
scènes de films, persos Disney/Pixar, lieux fictifs...) car elles sont
sous copyright. Pour créer des questions Reconnaissance pop-culture,
dépose tes propres images ICI (dossier public/reco/) et référence-les
dans la banque via le champ "img".

EXEMPLE (packages/shared/src/games/reconnaissance/bank.ts) :

  {
    id: "dory",
    wiki: "",                 // laissé vide : on utilise l'image locale
    question: "Quel est ce personnage ?",
    answer: "Dory",
    accepted: ["dory"],
    category: "Animation",
    franchise: "Le Monde de Nemo",
    difficulty: "easy",
    img: "/reco/dory.png"     // <-- ton fichier déposé dans public/reco/
  },

- Le chemin commence toujours par /reco/ (jamais public/).
- Formats conseillés : .png ou .jpg, ~800x800 ou plus.
- Après avoir ajouté des fichiers, relance "dev:web".
