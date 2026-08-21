// Video library for the Doublage (dubbing) game. Add scenes here without
// touching game code. `src` may be a same-origin file (public/) or an embeddable
// URL; the client resolves playback. Characters drive per-player assignment.

export interface DoublageCharacter {
  id: string;
  name: string;
}

export interface DoublageVideo {
  id: string;
  title: string;
  src: string; // e.g. "/doublage/scene1.mp4" (place files in apps/web/public/doublage)
  thumbnail?: string;
  durationMs: number; // used for the auto end-of-scene; 0 = host ends manually
  source?: string; // "Film", "Série", "YouTube", …
  characters: DoublageCharacter[];
}

export const DOUBLAGE_VIDEOS: DoublageVideo[] = [
  {
    id: "scene-test",
    title: "Scène test (intégrée)",
    src: "/doublage/scene.mp4", // fichier embarqué : marche partout, sans réseau
    durationMs: 12_000,
    source: "Test",
    characters: [
      { id: "a", name: "Voix 1" },
      { id: "b", name: "Voix 2" },
    ],
  },
  {
    id: "demo-le-nom",
    title: "Scène démo (le-nom.mp4)",
    src: "/le-nom.mp4",
    durationMs: 0, // l'hôte termine à la main
    source: "Démo",
    characters: [
      { id: "a", name: "Personnage A" },
      { id: "b", name: "Personnage B" },
    ],
  },
  {
    id: "test",
    title: "Scène test (vidéo en ligne)",
    // Vidéo publique de secours (nécessite une connexion) — jouée par le navigateur.
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    durationMs: 15_000,
    source: "Démo test",
    characters: [
      { id: "a", name: "Voix 1" },
      { id: "b", name: "Voix 2" },
    ],
  },
  {
    id: "restaurant",
    title: "Scène du restaurant",
    src: "/doublage/restaurant.mp4",
    durationMs: 45_000,
    source: "Démo",
    characters: [
      { id: "a", name: "Le client" },
      { id: "b", name: "Le serveur" },
      { id: "c", name: "Le cuisinier" },
    ],
  },
];

export function getDoublageVideo(id: string | null | undefined): DoublageVideo | null {
  return DOUBLAGE_VIDEOS.find((v) => v.id === id) ?? null;
}
