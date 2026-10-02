"use client";

import { SITE } from "@/lib/site";

/**
 * « Soutenir LeBoum » — lien vers la page de dons. Discret, jamais pendant
 * une partie : affiché sur l'accueil et sur les écrans de fin de jeu.
 * Caché tant que `SITE.supportUrl` est vide.
 */
export function SupportButton({ floating = false }: { floating?: boolean }) {
  if (!SITE.supportUrl) return null;
  return (
    <a
      href={SITE.supportUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="lb-support"
      style={{
        ...(floating ? { position: "fixed", left: 16, bottom: "max(16px, env(safe-area-inset-bottom))", zIndex: 60 } : {}),
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        border: "1px solid rgba(255,194,75,.45)",
        background: "rgba(14,11,26,.8)",
        backdropFilter: "blur(6px)",
        padding: "8px 14px",
        fontFamily: "var(--font-display), 'Bricolage Grotesque', sans-serif",
        fontWeight: 700,
        fontSize: 13,
        color: "#FFC24B",
        textDecoration: "none",
      }}
    >
      <span aria-hidden>🍻</span>
      Paie ta tournée à LeBoum
    </a>
  );
}
