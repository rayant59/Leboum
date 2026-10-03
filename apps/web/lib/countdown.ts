"use client";

// Chrono partagé par tous les jeux (phase 17 — plus de copie par vue).
// Le serveur donne une échéance (`deadline`, en heure serveur) ; on affiche le
// temps restant en se recalant sur `now()` (horloge serveur estimée).

import { useEffect, useState } from "react";

/**
 * Secondes restantes avant `deadline` (arrondi supérieur), ou `null` sans
 * échéance. `exact` renvoie la valeur décimale (anneaux / jauges fluides).
 */
export function useCountdown(deadline: number | null, now: () => number, exact = false, tickMs = exact ? 120 : 200): number | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (deadline == null) return;
    const id = window.setInterval(() => force((n) => n + 1), tickMs);
    return () => window.clearInterval(id);
  }, [deadline, tickMs]);
  if (deadline == null) return null;
  const rem = Math.max(0, (deadline - now()) / 1000);
  return exact ? rem : Math.ceil(rem);
}
