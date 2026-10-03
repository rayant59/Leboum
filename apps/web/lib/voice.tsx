"use client";

// ---------------------------------------------------------------------------
// La voix LeBoum (phase 16 — identité) : les petites phrases qui donnent le
// ton. Français, drôle, un peu chaotique, jamais méchant. Un seul endroit
// pour les écrire, pour qu'elles restent cohérentes d'un jeu à l'autre.
// ---------------------------------------------------------------------------

import { useEffect, useState, type CSSProperties } from "react";

export const VOICE = {
  /** Quand tout le monde attend une action de l'hôte. */
  waitHost: [
    "L'hôte réfléchit… ou il est parti chercher des chips.",
    "On attend l'hôte. Profitez-en pour vous hydrater.",
    "L'hôte a le pouvoir. Et il prend son temps.",
    "Patience : l'hôte cherche le gros bouton.",
    "Ça arrive. L'hôte fait monter le suspense.",
  ],
  /** Connexion au serveur. */
  connecting: [
    "Connexion… on gonfle les ballons.",
    "Connexion… on branche les enceintes.",
    "Connexion… le serveur enfile ses chaussures de soirée.",
  ],
  /** Sous le compte à rebours d'un nouveau jeu. */
  introPunch: [
    "Que le meilleur gagne. Ou le plus drôle.",
    "Pas de pitié entre potes.",
    "Mauvaise foi autorisée, triche interdite.",
    "Celui qui perd range les verres.",
    "Respirez. Ça va bien se passer. Probablement.",
    "Concentration maximale. Ou pas.",
  ],
  /** Entre deux jeux d'une soirée. */
  soireeNext: [
    "On enchaîne, pas le temps de souffler !",
    "Le classement peut encore basculer.",
    "Tout se joue maintenant. Enfin, presque.",
    "Les compteurs tournent, la soirée continue.",
  ],
} as const;

export type VoiceKey = keyof typeof VOICE;

/** Une phrase au hasard (stable tant que la clé ne change pas). */
export function pickLine(key: VoiceKey, seed?: number): string {
  const lines = VOICE[key];
  const i = seed == null ? Math.floor(Math.random() * lines.length) : Math.abs(Math.floor(seed)) % lines.length;
  return lines[i];
}

/**
 * Phrase du moment ; change toutes les `everyMs` (0 = jamais). Le premier
 * rendu (serveur) prend la première phrase pour éviter un écart d'hydratation.
 */
export function useLine(key: VoiceKey, everyMs = 0): string {
  const [line, setLine] = useState<string>(VOICE[key][0]);
  useEffect(() => {
    setLine(pickLine(key));
    if (!everyMs) return;
    const id = window.setInterval(() => {
      setLine((prev) => {
        const lines = VOICE[key];
        if (lines.length < 2) return prev;
        let next = prev;
        while (next === prev) next = pickLine(key);
        return next;
      });
    }, everyMs);
    return () => window.clearInterval(id);
  }, [key, everyMs]);
  return line;
}

/** « En attente de l'hôte », version LeBoum. */
export function WaitHost({ style, className }: { style?: CSSProperties; className?: string }) {
  const line = useLine("waitHost", 7000);
  return (
    <span className={className} style={style} aria-live="polite">
      {line}
    </span>
  );
}

/** Une phrase de la voix LeBoum, à poser n'importe où. */
export function VoiceLine({ k, everyMs = 0, style, className }: { k: VoiceKey; everyMs?: number; style?: CSSProperties; className?: string }) {
  const line = useLine(k, everyMs);
  return (
    <span className={className} style={style}>
      {line}
    </span>
  );
}
