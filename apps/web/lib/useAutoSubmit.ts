"use client";

import { useEffect, useRef } from "react";

/**
 * Envoie automatiquement la réponse tapée (mais pas validée) juste avant la
 * fin du chrono, pour qu'un joueur ne perde jamais une bonne réponse faute
 * d'avoir appuyé sur Entrée.
 *
 * Partagé par tous les jeux à réponse libre (quiz, Œil de Boum, Pixel Panic…).
 * `key` identifie la question courante : un seul envoi auto par question.
 */
export function useAutoSubmit(opts: {
  key: string | number;
  active: boolean;
  deadline: number | null;
  now: () => number;
  text: string;
  submit: (text: string) => void;
  /** Marge avant l'échéance serveur (ms) pour absorber la latence réseau. */
  marginMs?: number;
}) {
  const { key, active, deadline, now, text, submit, marginMs = 400 } = opts;
  const textRef = useRef(text);
  textRef.current = text;
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const sentFor = useRef<string | number | null>(null);

  useEffect(() => {
    if (!active || deadline == null || sentFor.current === key) return;
    const id = setInterval(() => {
      if (deadline - now() > marginMs) return;
      clearInterval(id);
      const t = textRef.current.trim();
      if (t && sentFor.current !== key) {
        sentFor.current = key;
        submitRef.current(t);
      }
    }, 100);
    return () => clearInterval(id);
  }, [key, active, deadline, now, marginMs]);
}
