import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "LeBoum pour les entreprises — team building & afterwork",
  description: "Une soirée de party-games français pour votre équipe : quiz sur mesure, dessin, bombe à mots. Sans installation, jouable au téléphone.",
};

export default function EntreprisePage() {
  const mail = SITE.contactEmail
    ? `mailto:${SITE.contactEmail}?subject=${encodeURIComponent("LeBoum pour mon équipe")}&body=${encodeURIComponent("Bonjour,\n\nNous aimerions organiser une session LeBoum.\n\nEntreprise :\nNombre de participants :\nDate envisagée :\nSur place / à distance :\n\nMerci !")}`
    : "";
  return (
    <InfoPage kicker="Afterwork · séminaire · pot de départ" title="Une soirée LeBoum pour votre équipe">
      <p>
        Des jeux courts, drôles et en français, lancés en 10 secondes depuis un navigateur :
        chacun rejoint avec son téléphone, sans compte ni installation. Parfait pour briser la
        glace en séminaire, animer un afterwork ou fêter un départ — sur place comme à distance.
      </p>

      <h2>Ce qu&apos;on peut préparer pour vous</h2>
      <ul>
        <li><b>Un quiz sur votre boîte</b> : vos questions, vos private jokes, votre culture d&apos;équipe.</li>
        <li><b>Des mots à dessiner sur mesure</b> : vos produits, vos clients, votre jargon.</li>
        <li><b>Plusieurs salons en parallèle</b> pour les grands groupes, avec un enchaînement de jeux.</li>
        <li><b>Un accompagnement</b> pour lancer la session le jour J.</li>
      </ul>

      <h2>Les jeux</h2>
      <p>Boum Dessin, Ça te parle ? (quiz), Œil de Boum et Pixel Panic (images à deviner), Boum Rush (la bombe à mots) et Mimic Boum (imitations).</p>

      <h2>Parlons-en</h2>
      {mail ? (
        <p>
          <a href={mail} style={{ display: "inline-block", marginTop: 4, borderRadius: 14, background: "#FFC24B", color: "#14102A", padding: "14px 22px", fontFamily: "var(--font-display), 'Bricolage Grotesque', sans-serif", fontWeight: 800, textDecoration: "none" }}>
            Demander un devis
          </a>
          <br />
          <span style={{ fontSize: 14, color: "#A79FC7" }}>Ou écrivez-nous : {SITE.contactEmail}</span>
        </p>
      ) : (
        <p>Le formulaire de contact arrive très bientôt.</p>
      )}
    </InfoPage>
  );
}
