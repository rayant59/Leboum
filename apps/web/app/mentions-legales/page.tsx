import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Mentions légales & confidentialité — LeBoum" };

export default function MentionsLegales() {
  const { editor, hosts } = SITE.legal;
  return (
    <InfoPage kicker="Infos légales" title="Mentions légales & confidentialité">
      <h2>Éditeur du site</h2>
      {editor.name ? (
        <p>
          {editor.name}
          {editor.siret && <><br />SIRET : {editor.siret}</>}
        </p>
      ) : (
        <p>Site édité à titre non professionnel par un particulier.</p>
      )}
      {SITE.contactEmail && <p>Contact : <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></p>}

      <h2>Hébergement</h2>
      <ul>
        {hosts.map((h) => (
          <li key={h.role}>
            {h.role} : {h.name}{h.address ? ` — ${h.address}` : ""} — <a href={h.website} target="_blank" rel="noopener noreferrer">{h.website.replace("https://", "")}</a>
          </li>
        ))}
      </ul>

      <h2>Données personnelles</h2>
      <p>LeBoum se joue sans compte. Concrètement :</p>
      <ul>
        <li>Ton <b>pseudo</b> et un identifiant aléatoire sont gardés <b>dans ton navigateur</b> pour te reconnecter à ton salon. Ils ne sont pas revendus ni utilisés pour de la pub.</li>
        <li>Les salons, dessins, réponses et enregistrements de voix (Mimic Boum) n&apos;existent que <b>le temps de la partie</b>, en mémoire sur le serveur de jeu, puis disparaissent.</li>
        <li>Nous comptons la fréquentation de façon <b>anonyme et sans cookie</b> : nombre de salons, de joueurs et de parties par jour. Aucun pseudo n&apos;est conservé dans ces statistiques.</li>
        <li>Aucun cookie publicitaire n&apos;est utilisé.</li>
        <li>Les paiements du Pass Soirée sont traités par <b>Stripe</b> : LeBoum ne voit jamais tes données bancaires et ne garde que l&apos;identifiant du paiement et le salon concerné.</li>
        <li>Certaines images des jeux sont chargées depuis Wikipédia (Wikimedia) au moment de la partie.</li>
      </ul>

      <h2>Contenus</h2>
      <p>Les images des jeux d&apos;images à deviner sont citées à des fins de jeu. Si tu es ayant droit d&apos;une image et souhaites son retrait, écris-nous{SITE.contactEmail ? <> à <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></> : ""} : elle sera retirée rapidement.</p>
    </InfoPage>
  );
}
