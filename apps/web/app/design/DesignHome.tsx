"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { InfoPage } from "@/components/InfoPage";
import { designLogin, designLogout, designToken, editorAllowedHere } from "@/lib/theme";

const button = { borderRadius: 12, border: "none", background: "rgb(var(--c-gold))", color: "rgb(var(--c-ink-deep))", fontWeight: 800, padding: "12px 20px", cursor: "pointer", fontSize: 15 } as const;

/** Page /design (en local uniquement) : ouvre l'éditeur par-dessus le site. */
export function DesignHome() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState(false);
  const [here, setHere] = useState(true);

  useEffect(() => {
    setLogged(!!designToken());
    setHere(editorAllowedHere());
  }, []);

  async function open() {
    setBusy(true);
    setError("");
    const r = await designLogin();
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    window.dispatchEvent(new Event("lb:design-change"));
    router.push("/");
  }

  return (
    <InfoPage kicker="En local uniquement" title="Éditeur de design">
      <p>
        Modifie le site <b>en direct</b>, directement sur les vraies pages. Enchaîne autant de changements que tu
        veux, puis clique sur <b>Sauvegarder</b> (ou Ctrl+S) pour les garder sur ton PC. Quand tu as fini,
        <b>Publier</b> crée le fichier <code>site-theme.json</code> ; fais ensuite un <b>commit + push</b> pour le
        mettre en ligne.
      </p>
      {!here ? (
        <p style={{ color: "rgb(var(--c-danger))" }}>
          L&apos;éditeur ne marche que sur ton PC : ouvre <b>http://localhost:3000/design</b>.
        </p>
      ) : logged ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <button style={button} onClick={() => router.push("/")}>Ouvrir l&apos;éditeur sur le site</button>
          <button style={{ ...button, background: "transparent", color: "rgb(var(--c-text-muted))", border: "1px solid rgb(var(--c-ink-border))" }}
            onClick={() => { designLogout(); setLogged(false); window.dispatchEvent(new Event("lb:design-change")); }}>
            Fermer l&apos;éditeur
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 20 }}>
          <button style={{ ...button, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void open()}>
            {busy ? "Ouverture…" : "Ouvrir l'éditeur"}
          </button>
        </div>
      )}
      {error && <p style={{ color: "rgb(var(--c-danger))" }}>{error}</p>}
      <h2>Comment ça marche</h2>
      <ul>
        <li>Le panneau s&apos;ouvre par-dessus le site : déplace-le en le tirant par sa barre de titre, agrandis-le par son coin en bas à droite (double-clic sur la barre = position d&apos;origine). Navigue (accueil, salon, jeux) pour voir chaque écran.</li>
        <li><b>Contenu</b> : clique sur un élément du site pour changer son texte, son lien, son image ou son style, le cacher, le déplacer à la souris, ou ajouter un texte, un titre, un bouton ou une image à côté. Glisse l&apos;élément sélectionné pour le déplacer (ou double-clic), tire les poignées de son cadre pour le redimensionner.</li>
        <li><b>Couleurs</b> : chaque couleur du site, des thèmes tout prêts et une alerte si un texte devient peu lisible.</li>
        <li><b>Polices</b> : titres, texte et étiquettes, parmi une trentaine de polices.</li>
        <li><b>Avancé</b> : du CSS libre pour tout le reste, et l&apos;export / import du thème.</li>
        <li><b>Revenir au design d&apos;origine</b> à tout moment, puis Publier.</li>
      </ul>
      <p style={{ fontSize: 14, color: "rgb(var(--c-text-faint))" }}>
        Il faut que les deux terminaux tournent : <code>npm run dev:server</code> et <code>npm run dev:web</code>.
        Sur le site en ligne, cette page n&apos;existe pas et personne ne peut modifier le design.
      </p>
    </InfoPage>
  );
}
