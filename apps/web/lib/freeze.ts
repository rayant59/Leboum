"use client";

// « Temps figé » (panneau Admin de l'éditeur, en local) : le serveur arrête
// les chronos du salon, et les écrans qui ont leur propre minuterie (annonce
// 3·2·1, consigne de Faux-artiste, enchaînement des prises Mimic…) attendent
// eux aussi. La page reste entièrement cliquable et modifiable.

import { useSyncExternalStore } from "react";

let frozen = false;
let room: string | null = null;
const subs = new Set<() => void>();

export function setFrozen(value: boolean, roomCode: string | null) {
  if (value === frozen && roomCode === room) return;
  frozen = value;
  room = roomCode;
  for (const f of subs) f();
}

export function isFrozen(): boolean {
  return frozen;
}

/** Salon dont on reçoit l'état (pour le bouton « Reprendre »). */
export function frozenRoom(): string | null {
  return room;
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}

/** Vrai tant que le temps du salon est figé. */
export function useFrozen(): boolean {
  return useSyncExternalStore(subscribe, () => frozen, () => false);
}

/** Salon courant (code) — mis à jour par useRoom. */
export function useCurrentRoom(): string | null {
  return useSyncExternalStore(subscribe, () => room, () => null);
}

/** Demande au salon de rejouer l'annonce du jeu en cours (3·2·1). */
export const REPLAY_INTRO_EVENT = "lb:replay-intro";
