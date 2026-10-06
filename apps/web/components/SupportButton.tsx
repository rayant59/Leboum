"use client";

import { SITE } from "@/lib/site";
import { NeonIcon } from "@/components/NeonIcon";

/**
 * « Paie ta tournée à LeBoum » — lien vers la page de dons (Ko-fi…).
 * Discret, jamais pendant une partie : accueil, salon, fins de partie et de
 * soirée. Caché tant que `SITE.supportUrl` est vide (voir lib/site.ts).
 *
 *  - "pill"     : bouton doré (accueil, fin de soirée)
 *  - "floating" : même bouton, fixé en bas à gauche (fin de partie)
 *  - "line"     : simple ligne de texte (salon)
 */
export function SupportButton({ floating = false, variant }: { floating?: boolean; variant?: "pill" | "floating" | "line" }) {
  if (!SITE.supportUrl) return null;
  const v = variant ?? (floating ? "floating" : "pill");

  if (v === "line") {
    return (
      <a
        href={SITE.supportUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="lb-support-line"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "#A79FC7", textDecoration: "none" }}
      >
        <NeonIcon name="heart" size={18} />
        <span>
          LeBoum est gratuit et fait maison.{" "}
          <span style={{ color: "#FFC24B", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}>Paie ta tournée</span>
        </span>
      </a>
    );
  }

  return (
    <a
      href={SITE.supportUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="lb-support"
      title="Soutenir LeBoum par un petit don"
      style={{
        ...(v === "floating" ? { position: "fixed", left: 16, bottom: "max(16px, env(safe-area-inset-bottom))", zIndex: 60 } : {}),
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        border: "1px solid rgba(255,194,75,.45)",
        background: "rgba(14,11,26,.8)",
        backdropFilter: "blur(6px)",
        padding: "7px 15px 7px 10px",
        fontFamily: "var(--font-display), 'Bricolage Grotesque', sans-serif",
        fontWeight: 700,
        fontSize: 13.5,
        color: "#FFC24B",
        textDecoration: "none",
        transition: "transform .15s ease, border-color .15s ease",
      }}
    >
      <NeonIcon name="heart" size={22} />
      Paie ta tournée à LeBoum
    </a>
  );
}
