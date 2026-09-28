// ---------------------------------------------------------------------------
// Mimic — mesure de ressemblance « rythme + énergie » entre deux sons.
//
// On ne compare PAS les fichiers audio bruts : le client extrait, pour chaque
// son, une « enveloppe d'énergie » (le volume au fil du temps, échantillonné en
// quelques dizaines de points) puis appelle `envelopeSimilarity` ci-dessous.
// Le calcul est PUR (aucune dépendance navigateur) → testable et réutilisable
// côté serveur si besoin. Il renvoie un score 0–100.
//
// Choix de conception (validé avec le produit) : on juge le RYTHME et l'ÉNERGIE.
//   - on ré-échantillonne les deux enveloppes à la même longueur → la durée
//     absolue ne domine pas, c'est le motif temporel (le « quand ça monte /
//     descend ») qui compte ;
//   - on normalise par le maximum → le gain du micro n'influe pas, seule la
//     forme relative des variations de volume est comparée ;
//   - on mesure la corrélation de Pearson entre les deux → 1 = même rythme,
//     0 = sans rapport. On mappe sur 0–100.
// ---------------------------------------------------------------------------

/** Ré-échantillonne une enveloppe à `n` points (interpolation linéaire). */
export function resampleEnvelope(env: number[], n: number): number[] {
  if (n <= 0) return [];
  if (env.length === 0) return new Array(n).fill(0);
  if (env.length === 1) return new Array(n).fill(env[0]);
  if (env.length === n) return env.slice();
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (env.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(env.length - 1, lo + 1);
    const f = t - lo;
    out[i] = env[lo] * (1 - f) + env[hi] * f;
  }
  return out;
}

/** Normalise une enveloppe dans [0,1] par son maximum (robuste au gain micro). */
export function normalizeEnvelope(env: number[]): number[] {
  let max = 0;
  for (const v of env) max = Math.max(max, v);
  if (max <= 1e-9) return env.map(() => 0);
  return env.map((v) => v / max);
}

/**
 * Ressemblance rythme + énergie de deux enveloppes, en 0–100.
 * 100 = mêmes montées/descentes de volume dans le temps ; 0 = sans rapport
 * (ou l'un des deux est silencieux/vide).
 */
export function envelopeSimilarity(a: number[], b: number[], n = 64): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const A = normalizeEnvelope(resampleEnvelope(a, n));
  const B = normalizeEnvelope(resampleEnvelope(b, n));
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += A[i];
    mb += B[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = A[i] - ma;
    const xb = B[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  if (da <= 1e-9 || db <= 1e-9) return 0; // enveloppe plate → indéterminé
  const r = num / Math.sqrt(da * db); // corrélation de Pearson ∈ [-1,1]
  return Math.round(Math.max(0, r) * 100);
}

/** Borne une valeur de ressemblance reçue d'un client dans 0–100 entier. */
export function clampCloseness(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
