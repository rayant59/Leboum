// Video library for the Doublage (dubbing) game.
//
// ⚠️ Plus aucune scène de test : les vidéos viennent EXCLUSIVEMENT du dossier
// apps/web/public/doublage/ (fichiers .mp4 + manifeste scenes.txt).
// Voir le README de ce dossier — aucune ligne de code à toucher pour en ajouter.

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

/** Bibliothèque intégrée : volontairement vide (voir en-tête). */
export const DOUBLAGE_VIDEOS: DoublageVideo[] = [];

/** Scènes chargées depuis apps/web/public/doublage/ par le serveur au démarrage. */
let CUSTOM_VIDEOS: DoublageVideo[] = [];

export function setCustomDoublageVideos(videos: DoublageVideo[]): void {
  const seen = new Set<string>();
  CUSTOM_VIDEOS = videos.filter((v) => {
    if (!v || seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });
}

export function doublageVideos(): DoublageVideo[] {
  return CUSTOM_VIDEOS.length ? [...DOUBLAGE_VIDEOS, ...CUSTOM_VIDEOS] : DOUBLAGE_VIDEOS;
}

export function customDoublageCount(): number {
  return CUSTOM_VIDEOS.length;
}

/**
 * Parse le manifeste des scènes. Une scène par ligne :
 *
 *     ma-scene.mp4 | Titre de la scène | 20 = Personnage A | Personnage B
 *
 *   - le fichier doit être dans apps/web/public/doublage/
 *   - le titre est facultatif (par défaut : le nom du fichier)
 *   - la durée est en SECONDES (0 ou absente = l'hôte termine à la main)
 *   - après le "=", la liste des personnages séparés par des "|"
 *
 * Lignes vides et lignes commençant par # ignorées.
 */
export function parseDoublageScenes(text: string): DoublageVideo[] {
  const out: DoublageVideo[] = [];
  let n = 0;
  for (const raw of (text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const left = line.slice(0, eq).trim();
    const right = line.slice(eq + 1).trim();
    if (!left || !right) continue;

    const leftParts = left.split("|").map((p) => p.trim());
    const file = leftParts[0];
    if (!file) continue;
    const title = leftParts[1] || file.replace(/\.[^.]+$/, "");
    const secs = Number(leftParts[2]);
    const durationMs = Number.isFinite(secs) && secs > 0 ? Math.round(secs * 1000) : 0;

    const names = right.split("|").map((p) => p.trim()).filter(Boolean);
    if (!names.length) continue;

    n += 1;
    out.push({
      id: `cs${n}`,
      title,
      src: file.startsWith("/") ? file : `/doublage/${file}`,
      durationMs,
      source: "Perso",
      characters: names.map((name, i) => ({ id: String.fromCharCode(97 + i), name })),
    });
  }
  return out;
}

export function getDoublageVideo(id: string | null | undefined): DoublageVideo | null {
  return doublageVideos().find((v) => v.id === id) ?? null;
}
