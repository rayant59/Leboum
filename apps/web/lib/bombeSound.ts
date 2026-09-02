"use client";

// ---------------------------------------------------------------------------
// Sons du mode « Bombe » — vrais fichiers audio (apps/web/public/sounds/bombe).
//
// On passe par la Web Audio API (buffers décodés) pour pouvoir superposer
// plusieurs sons (frappes rapides) et gérer proprement les boucles/arrêts.
// Le mute est PARTAGÉ avec le reste du jeu via isSoundOn() (clé "stp-sound").
// ---------------------------------------------------------------------------

import { isSoundOn } from "@/lib/sound";

const BASE = "/sounds/bombe";
// Version des sons : à incrémenter à CHAQUE remplacement d'un .mp3. Le suffixe
// « ?v=N » change l'URL, ce qui force le navigateur et le CDN à recharger les
// nouveaux fichiers au lieu de resservir les anciens depuis le cache.
const V = "3";
const u = (name: string) => `${BASE}/${name}.mp3?v=${V}`;

/** Sons « one-shot ». */
const CLIP: Record<string, string> = {
  bonmot: u("bonmot"),
  mauvaismot: u("mauvaismot"),
  effacer: u("effacer"),
  explosion: u("explosion"),
};
const COUNTDOWN_URL = u("compte3s");
const CHRONO_URL = u("chrono");
const TOUCHES = [u("touche1"), u("touche2"), u("touche3")];

export type BombeClip = keyof typeof CLIP;

let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer | null>>();

function actx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function load(url: string): Promise<AudioBuffer | null> {
  const c = actx();
  if (!c) return Promise.resolve(null);
  const cached = buffers.get(url);
  if (cached) return Promise.resolve(cached);
  const inflight = loading.get(url);
  if (inflight) return inflight;
  const p = fetch(url)
    .then((r) => r.arrayBuffer())
    .then((a) => c.decodeAudioData(a))
    .then((buf) => {
      buffers.set(url, buf);
      loading.delete(url);
      return buf;
    })
    .catch(() => {
      loading.delete(url);
      return null;
    });
  loading.set(url, p);
  return p;
}

function playUrl(url: string, gain = 1): AudioBufferSourceNode | null {
  if (!isSoundOn()) return null;
  const c = actx();
  if (!c) return null;
  const buf = buffers.get(url);
  if (!buf) {
    // pas encore décodé : on charge puis on joue (léger retard au 1er coup)
    void load(url).then((b) => {
      if (b && isSoundOn()) playBuffer(c, b, gain);
    });
    return null;
  }
  return playBuffer(c, buf, gain);
}

function playBuffer(c: AudioContext, buf: AudioBuffer, gain: number, loop = false): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = loop;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(c.destination);
  src.start();
  return src;
}

/** Précharge tous les sons (à appeler au montage de la vue). */
export function preloadBombeSounds(): void {
  [...Object.values(CLIP), COUNTDOWN_URL, CHRONO_URL, ...TOUCHES].forEach((u) => void load(u));
}

/** Joue un son ponctuel. */
export function playBombe(clip: BombeClip, gain = 1): void {
  playUrl(CLIP[clip], gain);
}

/** Frappe clavier (une des 3 variantes, au hasard). */
export function playTouche(): void {
  playUrl(TOUCHES[Math.floor(Math.random() * TOUCHES.length)], 0.85);
}

// ── Chronomètre stressant : boucle pendant TON tour ─────────────────────────
let chronoSrc: AudioBufferSourceNode | null = null;
export function startChrono(gain = 0.4): void {
  if (!isSoundOn() || chronoSrc) return;
  const c = actx();
  if (!c) return;
  void load(CHRONO_URL).then((buf) => {
    if (!buf || !isSoundOn() || chronoSrc) return;
    chronoSrc = playBuffer(c, buf, gain, true);
  });
}
export function stopChrono(): void {
  if (chronoSrc) {
    try { chronoSrc.stop(); } catch { /* ignore */ }
    chronoSrc = null;
  }
}

// ── Décompte des 3 dernières secondes (arrêtable) ───────────────────────────
let countdownSrc: AudioBufferSourceNode | null = null;
export function playCountdown(gain = 0.9): void {
  if (!isSoundOn()) return;
  const c = actx();
  if (!c) return;
  stopCountdown();
  void load(COUNTDOWN_URL).then((buf) => {
    if (!buf || !isSoundOn()) return;
    countdownSrc = playBuffer(c, buf, gain);
    countdownSrc.onended = () => { countdownSrc = null; };
  });
}
export function stopCountdown(): void {
  if (countdownSrc) {
    try { countdownSrc.stop(); } catch { /* ignore */ }
    countdownSrc = null;
  }
}

/** Coupe tout (fin de tour, explosion, démontage…). */
export function stopBombeTimers(): void {
  stopChrono();
  stopCountdown();
}
