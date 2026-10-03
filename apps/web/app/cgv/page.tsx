import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Conditions de vente — LeBoum" };

export default function CGV() {
  const { editor } = SITE.legal;
  return (
    <InfoPage kicker="Pass Soirée" title="Conditions générales de vente">
      <h2>Vendeur</h2>
      <p>
        {editor.name || "LeBoum"}
        {editor.siret && <><br />SIRET : {editor.siret}</>}
        {SITE.contactEmail && <><br />Contact : <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></>}
      </p>

      <h2>Ce que tu achètes</h2>
      <p>
        Le <b>Pass Soirée</b> est un contenu numérique qui active des bonus sur <b>un salon LeBoum</b> pendant
        <b> 12 heures</b> à partir de son activation : salon jusqu&apos;à 12 joueurs, questions personnalisées
        dans « Ça te parle ? ». Il profite à tous les joueurs du salon. Le jeu de base reste gratuit.
      </p>

      <h2>Prix et paiement</h2>
      <p>Le prix est affiché en euros avant le paiement. TVA non applicable, article 293 B du Code général des impôts. Le paiement est traité par Stripe ; LeBoum n&apos;a jamais accès à tes données bancaires.</p>

      <h2>Accès immédiat et rétractation</h2>
      <p>
        Le Pass est activé dès le paiement confirmé. En validant le paiement, tu demandes son exécution immédiate et
        reconnais renoncer à ton droit de rétractation, conformément à l&apos;article L221-28 du Code de la consommation.
      </p>

      <h2>Un problème ?</h2>
      <p>
        Si le Pass ne s&apos;active pas ou si le service est interrompu pendant ta soirée, écris-nous
        {SITE.contactEmail ? <> à <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></> : ""} avec l&apos;heure du paiement :
        nous réactiverons le Pass ou te rembourserons.
      </p>

      <h2>Médiation</h2>
      <p>
        En cas de litige non résolu avec nous, tu peux recourir gratuitement à un médiateur de la consommation
        {SITE.legal.mediator ? <> : {SITE.legal.mediator}</> : null}.
      </p>
    </InfoPage>
  );
}
