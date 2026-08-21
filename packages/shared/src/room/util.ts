// Pure helpers with no I/O — deterministic and trivially testable.

/** Unambiguous alphabet: no O/0, I/1, so codes read cleanly on a phone. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;

/**
 * Generate a room code. `rng` is injectable so tests are deterministic and the
 * server can plug in a collision-checking loop.
 */
export function generateRoomCode(rng: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  }
  return code;
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return [...code].every((c) => CODE_ALPHABET.includes(c));
}

/** Curated, high-contrast-on-dark avatar palette. */
export const AVATAR_COLORS = [
  "#FFC24B", // marquee gold
  "#FF4D8D", // hot magenta
  "#46E0B0", // mint
  "#5B8CFF", // periwinkle
  "#FF7A45", // coral
  "#B98CFF", // lilac
  "#4BE0E0", // aqua
  "#FF5C5C", // red
] as const;

/** Deterministic colour from an id — same player, same colour, everywhere. */
export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export const NAME_MAX = 20;

/**
 * Normalise a player name. Defensive against control chars and angle brackets;
 * the client still HTML-escapes on render (defence in depth), but the server
 * must never store something it wouldn't want broadcast.
 */
export function sanitizeName(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);
}

export function isValidName(raw: string): boolean {
  return sanitizeName(raw).length >= 1;
}
