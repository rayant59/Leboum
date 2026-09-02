// ---------------------------------------------------------------------------
// Mimic — banque de sons de référence.
//
// Les sons NE SONT PAS mis en dur dans les composants. L'hôte dépose ses
// fichiers audio dans apps/web/public/sounds/ et les décrit dans un manifeste
// sounds.txt (exactement comme les vidéos du Doublage). Le serveur charge le
// manifeste au démarrage et l'injecte ici via setMimicSounds.
//
// Un petit pack de sons « absurdes » (synthétisés) est fourni par défaut pour
// que le mode soit jouable tout de suite ; l'utilisateur ajoute les animaux,
// véhicules, voix… avec ses propres fichiers.
// ---------------------------------------------------------------------------

export interface MimicSound {
  id: string;
  name: string;
  category: string;     // clé de catégorie (animals, vehicles, objects, voices, absurd, custom…)
  src: string;          // ex. "/sounds/absurd/laser.mp3"
}

/** Catégories connues (libellé + emoji) pour l'affichage. */
export const MIMIC_CATEGORIES: Record<string, { label: string; emoji: string }> = {
  animals: { label: "Animaux", emoji: "🐶" },
  vehicles: { label: "Véhicules", emoji: "🚗" },
  objects: { label: "Objets / machines", emoji: "🔧" },
  voices: { label: "Voix / personnages", emoji: "👤" },
  absurd: { label: "Sons absurdes", emoji: "💥" },
  custom: { label: "Perso", emoji: "🎵" },
};

export function mimicCategoryLabel(cat: string): { label: string; emoji: string } {
  return MIMIC_CATEGORIES[cat] ?? { label: cat, emoji: "🎵" };
}

// Pack de démarrage — fichiers synthétisés livrés dans public/sounds/absurd/.
// (Décrits aussi dans sounds.txt ; ils restent une base par défaut si le
//  manifeste est absent, pour que le jeu tourne dès l'installation.)
const STARTER_SOUNDS: MimicSound[] = [
  { id: "laser", name: "Bruit de laser", category: "absurd", src: "/sounds/absurd/laser.mp3" },
  { id: "explosion", name: "Explosion", category: "absurd", src: "/sounds/absurd/explosion.mp3" },
  { id: "coin", name: "Pièce de jeu vidéo", category: "absurd", src: "/sounds/absurd/coin.mp3" },
  { id: "powerup", name: "Power-up", category: "absurd", src: "/sounds/absurd/powerup.mp3" },
  { id: "hurt", name: "Bruit de dégât", category: "absurd", src: "/sounds/absurd/hurt.mp3" },
  { id: "buzzer", name: "Buzzer (erreur)", category: "absurd", src: "/sounds/absurd/buzzer.mp3" },
  { id: "ufo", name: "Soucoupe volante", category: "absurd", src: "/sounds/absurd/ufo.mp3" },
  { id: "siren", name: "Sirène", category: "absurd", src: "/sounds/absurd/siren.mp3" },
  { id: "boing", name: "Boing cartoon", category: "absurd", src: "/sounds/absurd/boing.mp3" },
  { id: "robot", name: "Bip de robot", category: "absurd", src: "/sounds/absurd/robot.mp3" },
];

let CUSTOM_SOUNDS: MimicSound[] = [];

/** Injecté par le serveur au démarrage (manifeste public/sounds/sounds.txt). */
export function setMimicSounds(sounds: MimicSound[]): void {
  const seen = new Set<string>();
  CUSTOM_SOUNDS = sounds.filter((s) => {
    if (!s || !s.id || !s.src || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

/** Tous les sons disponibles : pack de démarrage + sons perso. */
export function mimicSounds(): MimicSound[] {
  if (!CUSTOM_SOUNDS.length) return STARTER_SOUNDS;
  // Les sons perso s'ajoutent au pack ; en cas d'id identique, le perso gagne.
  const ids = new Set(CUSTOM_SOUNDS.map((s) => s.id));
  return [...STARTER_SOUNDS.filter((s) => !ids.has(s.id)), ...CUSTOM_SOUNDS];
}

export function mimicSoundCount(): number {
  return mimicSounds().length;
}

export function getMimicSound(id: string | null | undefined): MimicSound | null {
  if (!id) return null;
  return mimicSounds().find((s) => s.id === id) ?? null;
}

/** Catégories réellement présentes (pour un éventuel filtre). */
export function mimicCategories(): string[] {
  return [...new Set(mimicSounds().map((s) => s.category))];
}

/**
 * Manifeste des sons. Une ligne par son :
 *
 *     fichier.mp3 | Nom affiché | catégorie
 *     animals/chien.mp3 | Chien | animals
 *
 *   - le fichier doit être dans apps/web/public/sounds/
 *   - la catégorie est facultative (par défaut « custom »)
 *   - on peut aussi grouper par section :  == animals ==
 *
 * Lignes vides et lignes commençant par # ignorées.
 */
export function parseMimicSounds(text: string): MimicSound[] {
  const out: MimicSound[] = [];
  let n = 0;
  let currentCat = "custom";
  for (const raw of (text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const section = line.match(/^==\s*(.+?)\s*==$/) || line.match(/^\[\s*(.+?)\s*\]$/);
    if (section) {
      currentCat = section[1].trim() || "custom";
      continue;
    }
    const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) continue;
    const file = parts[0];
    if (!file) continue;
    const name = parts[1] || file.replace(/\.[^.]+$/, "").replace(/^.*\//, "");
    const category = parts[2] || currentCat;
    n += 1;
    out.push({
      id: `snd${n}_${file.replace(/[^a-z0-9]+/gi, "").slice(0, 24)}`,
      name,
      category,
      src: file.startsWith("/") ? file : `/sounds/${file}`,
    });
  }
  return out;
}

/** Tire un son jouable, en évitant les sons récents. */
export function pickMimicSound(rng: () => number, exclude?: readonly string[]): MimicSound | null {
  const pool = mimicSounds();
  if (!pool.length) return null;
  const used = new Set(exclude ?? []);
  let fresh = pool.filter((s) => !used.has(s.id));
  if (fresh.length === 0) fresh = pool;
  return fresh[Math.floor(rng() * fresh.length)];
}
