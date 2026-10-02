// Petits utilitaires communs aux Game Modes (évite de les recopier par jeu).

/** Mélange de Fisher–Yates, déterministe pour un `rng` donné. */
export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Borne un nombre (repli sur `def` si l'entrée n'est pas un nombre fini). */
export function clampInt(v: unknown, min: number, max: number, def: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : def;
  return Math.max(min, Math.min(max, n));
}

/** Les clés qui ont la valeur maximale (> 0) — gère les égalités. */
export function argmaxAll(rec: Record<string, number>): string[] {
  let max = 0;
  for (const v of Object.values(rec)) if (v > max) max = v;
  if (max <= 0) return [];
  return Object.keys(rec).filter((k) => rec[k] === max);
}
