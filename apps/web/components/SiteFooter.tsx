import Link from "next/link";
import { SupportButton } from "@/components/SupportButton";

/** Pied de page commun (accueil + pages d'info). */
export function SiteFooter() {
  const link = { color: "#A79FC7", textDecoration: "none" } as const;
  return (
    <footer style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "40px 16px 28px", fontSize: 13, color: "#6E6796" }}>
      <SupportButton />
      <nav style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 20px" }}>
        <Link href="/entreprise" style={link}>LeBoum pour les entreprises</Link>
        <Link href="/mentions-legales" style={link}>Mentions légales & confidentialité</Link>
        <Link href="/cgv" style={link}>Conditions de vente</Link>
      </nav>
      <span>LeBoum · le party-game français entre potes</span>
    </footer>
  );
}
