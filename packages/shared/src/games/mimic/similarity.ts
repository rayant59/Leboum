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

// ---------------------------------------------------------------------------
// Version fine (utilisée par le jeu) : plusieurs critères combinés pour un
// pourcentage précis (42 %, 66 %…) au lieu de quelques valeurs rondes.
//   - rythme      : forme du volume dans le temps, haute résolution, avec une
//                   petite tolérance de décalage (on teste ±8 % de décalage) ;
//   - timbre      : « brillance » (taux de passage par zéro ≈ hauteur / souffle)
//                   dans le temps + en moyenne ;
//   - durée       : la prise dure-t-elle autant que l'original ?
//   - densité     : part du temps où le son est fort (son continu vs hachuré).
// ---------------------------------------------------------------------------

export interface SoundFeatures {
  /** Volume (RMS) image par image, silences de début/fin rognés. */
  env: number[];
  /** Taux de passage par zéro image par image (même découpage que env). */
  zcr: number[];
  /** Durée « active » (sans les silences de bord), en secondes. */
  activeSec: number;
}

/** Extrait les caractéristiques d'un son mono (échantillons bruts). */
export function extractSoundFeatures(mono: ArrayLike<number>, sampleRate: number, frames = 256): SoundFeatures {
  const len = mono.length;
  if (!len || !sampleRate) return { env: [], zcr: [], activeSec: 0 };
  const n = Math.max(8, Math.min(frames, Math.floor(len / 32)));
  const env = new Array<number>(n).fill(0);
  const zcr = new Array<number>(n).fill(0);
  const per = len / n;
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * per);
    const end = Math.min(len, Math.floor((i + 1) * per));
    let sum = 0;
    let crossings = 0;
    for (let j = start; j < end; j++) {
      const v = mono[j];
      sum += v * v;
      if (j > start && (v >= 0) !== (mono[j - 1] >= 0)) crossings++;
    }
    const w = Math.max(1, end - start);
    env[i] = Math.sqrt(sum / w);
    zcr[i] = crossings / w;
  }
  // Rognage des silences de début/fin (sous 8 % du maximum).
  let max = 0;
  for (const v of env) max = Math.max(max, v);
  if (max <= 1e-6) return { env: [], zcr: [], activeSec: 0 };
  const thr = max * 0.08;
  let lo = 0;
  while (lo < n && env[lo] < thr) lo++;
  let hi = n - 1;
  while (hi > lo && env[hi] < thr) hi--;
  const duration = len / sampleRate;
  return {
    env: env.slice(lo, hi + 1),
    zcr: zcr.slice(lo, hi + 1),
    activeSec: ((hi - lo + 1) / n) * duration,
  };
}

function smooth(x: number[], k = 1): number[] {
  if (x.length < 3 || k <= 0) return x.slice();
  return x.map((_, i) => {
    let s = 0;
    let c = 0;
    for (let j = i - k; j <= i + k; j++) if (j >= 0 && j < x.length) { s += x[j]; c++; }
    return s / c;
  });
}

function pearson(A: number[], B: number[]): number {
  const n = Math.min(A.length, B.length);
  if (n < 2) return 0;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += A[i]; mb += B[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = A[i] - ma, xb = B[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  if (da <= 1e-12 || db <= 1e-12) return 0;
  return num / Math.sqrt(da * db);
}

/** Meilleure corrélation en autorisant un léger décalage temporel. */
function bestLagCorrelation(A: number[], B: number[], maxLag: number): number {
  let best = -1;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const a = lag >= 0 ? A.slice(lag) : A.slice(0, A.length + lag);
    const b = lag >= 0 ? B.slice(0, B.length - lag) : B.slice(-lag);
    // On pénalise un peu les grands décalages.
    const r = pearson(a, b) - Math.abs(lag) / (maxLag * 40 || 1);
    if (r > best) best = r;
  }
  return best;
}

const ratio = (x: number, y: number) => (x <= 0 || y <= 0 ? 0 : Math.min(x, y) / Math.max(x, y));
const mean = (x: number[]) => (x.length ? x.reduce((s, v) => s + v, 0) / x.length : 0);

/**
 * Ressemblance d'une prise à l'original, 0–100 (entier, précision 1 %).
 * 0 si l'une des deux est silencieuse / vide.
 */
export function soundSimilarity(take: SoundFeatures, original: SoundFeatures): number {
  if (!take?.env?.length || !original?.env?.length || take.env.length < 2 || original.env.length < 2) return 0;
  const N = 96;
  const ea = normalizeEnvelope(smooth(resampleEnvelope(take.env, N)));
  const eb = normalizeEnvelope(smooth(resampleEnvelope(original.env, N)));
  const za = smooth(resampleEnvelope(take.zcr, N), 2);
  const zb = smooth(resampleEnvelope(original.zcr, N), 2);

  const rhythm = Math.max(0, bestLagCorrelation(ea, eb, Math.round(N * 0.08)));
  const timbreShape = Math.max(0, pearson(za, zb));
  const timbreLevel = ratio(mean(take.zcr), mean(original.zcr));
  const duration = ratio(take.activeSec, original.activeSec);
  const dens = (e: number[]) => e.filter((v) => v > 0.3).length / e.length;
  const density = 1 - Math.abs(dens(ea) - dens(eb));

  const score = 0.5 * rhythm + 0.12 * timbreShape + 0.13 * timbreLevel + 0.15 * duration + 0.1 * density;
  // Légère courbe : une prise sans rapport descend un peu plus, une très bonne
  // imitation reste tout en haut.
  return Math.max(0, Math.min(100, Math.round(Math.pow(Math.max(0, score), 1.25) * 100)));
}
