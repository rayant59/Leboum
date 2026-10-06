"use client";

import { useEffect, useState } from "react";
import { BoumIcon } from "@/components/BoumIcon";

/**
 * Bouton commun à tous les jeux : l'hôte peut arrêter la partie en cours et
 * ramener tout le monde au salon (sans attendre la fin du jeu).
 * Double clic de sécurité : « Quitter » → « Sûr ? » (6 s pour confirmer).
 */
export function HostQuitButton({ onQuit }: { onQuit: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 6000);
    return () => window.clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => (armed ? onQuit() : setArmed(true))}
      title="Arrêter la partie et revenir au salon"
      style={{
        position: "fixed",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderStyle: "none solid solid",
        borderWidth: 1,
        borderColor: armed ? "rgba(255,107,107,.7)" : "rgba(243,238,255,.14)",
        background: armed ? "rgba(255,107,107,.16)" : "rgba(14,11,26,.72)",
        backdropFilter: "blur(6px)",
        color: armed ? "#FF8A8A" : "#A79FC7",
        borderRadius: "0 0 10px 10px",
        padding: "6px 16px 7px",
        fontSize: 13,
        lineHeight: "16px",
        fontWeight: 600,
        cursor: "pointer",
        opacity: armed ? 1 : 0.9,
      }}
    >
      <BoumIcon name={armed ? "warning" : "cross"} size={15} />
      {armed ? "Arrêter pour tout le monde ? Clique encore" : "Retour au salon"}
    </button>
  );
}
