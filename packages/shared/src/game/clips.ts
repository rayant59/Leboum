// ---------------------------------------------------------------------------
// Bibliothèque d'extraits pour le jeu « Sous-titres ».
//
// ⚠️  CE FICHIER T'APPARTIENT. Remplace les extraits ci-dessous par les tiens.
//     Chaque clip peut être :
//       • kind: "file"    → une vidéo dans apps/web/public/clips/… (même origine)
//       • kind: "youtube" → un identifiant YouTube (le bout après ?v=)
//
//     Les clips sans url/youtubeId valides s'afficheront comme un cadre coloré
//     (posterColor) — parfait pour tester la mécanique sans vidéo.
//
//     IMPORTANT : ce fichier DOIT être présent (et commité sur GitHub) pour que
//     le serveur déployé ne plante pas au lancement d'une partie « Sous-titres ».
// ---------------------------------------------------------------------------

import type { Clip, ClipProvider } from "./types";

/** Tes extraits. Remplace-les — ceci n'est qu'un jeu d'exemple jouable. */
export const CLIP_LIBRARY: Clip[] = [
  {
    id: "demo-1",
    title: "Duel de regards",
    kind: "file",
    url: "/clips/demo-1.mp4",
    lang: "coréen",
    posterColor: "#7c3aed",
  },
  {
    id: "demo-2",
    title: "La grande annonce",
    kind: "file",
    url: "/clips/demo-2.mp4",
    lang: "japonais",
    posterColor: "#db2777",
  },
  {
    id: "demo-3",
    title: "Le plan secret",
    kind: "file",
    url: "/clips/demo-3.mp4",
    lang: "italien",
    posterColor: "#0ea5e9",
  },
];

/**
 * Fournisseur d'extraits statique. Mélange la bibliothèque et en prend `count`.
 * Si `count` dépasse la taille de la bibliothèque, on recycle (cycle) pour
 * toujours renvoyer exactement `count` clips — le jeu ne reste jamais à court.
 *
 * Signatures acceptées :
 *   staticClipProvider()                       // serveur : bibliothèque + Math.random
 *   staticClipProvider(CLIP_LIBRARY, () => 0)  // tests   : rng déterministe injecté
 */
export function staticClipProvider(
  library: Clip[] = CLIP_LIBRARY,
  rng: () => number = Math.random,
): ClipProvider {
  return {
    pick(count: number): Clip[] {
      const pool = [...library];
      // Mélange de Fisher–Yates avec le rng fourni.
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      if (pool.length === 0) return [];
      const out: Clip[] = [];
      for (let i = 0; i < count; i++) out.push(pool[i % pool.length]);
      return out;
    },
  };
}
