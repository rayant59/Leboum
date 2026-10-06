"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { InfoPage } from "@/components/InfoPage";
import { designLogin, designLogout, designToken } from "@/lib/theme";

const input = { flex: "1 1 220px", borderRadius: 12, border: "1px solid rgb(var(--c-ink-border))", background: "rgb(var(--c-ink-deep))", color: "rgb(var(--c-text))", padding: "12px 14px", fontSize: 16 } as const;
const button = { borderRadius: 12, border: "none", background: "rgb(var(--c-gold))", color: "rgb(var(--c-ink-deep))", fontWeight: 800, padding: "12px 20px", cursor: "pointer", fontSize: 15 } as const;

export default function DesignPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState(false);

  useEffect(() => setLogged(!!designToken()), []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await designLogin(token.trim());
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    window.dispatchEvent(new Event("lb:design-change"));
    router.push("/");
  }

  return (
    <InfoPage kicker="Réservé à l'équipe" title="Éditeur de design">
      <p>
        Modifie les couleurs, les polices et le style du site <b>en direct</b>, directement sur les vraies pages.
        Tes changements restent un brouillon visible par toi seul jusqu&apos;à ce que tu cliques sur <b>Publier</b> :
        tous les joueurs reçoivent alors le nouveau design, sans redéployer le site.
      </p>
      {logged ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <button style={button} onClick={() => router.push("/")}>Ouvrir l&apos;éditeur sur le site</button>
          <button style={{ ...button, background: "transparent", color: "rgb(var(--c-text-muted))", border: "1px solid rgb(var(--c-ink-border))" }}
            onClick={() => { designLogout(); setLogged(false); window.dispatchEvent(new Event("lb:design-change")); }}>
            Se déconnecter
          </button>
        </div>
      ) : (
        <form onSubmit={login} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Code d'accès" type="password" autoComplete="current-password" style={input} />
          <button style={{ ...button, opacity: busy ? 0.6 : 1 }} disabled={busy}>{busy ? "Connexion…" : "Entrer"}</button>
        </form>
      )}
      {error && <p style={{ color: "rgb(var(--c-danger))" }}>{error}</p>}
      <h2>Comment ça marche</h2>
      <ul>
        <li>Le panneau s&apos;ouvre par-dessus le site : navigue (accueil, salon, jeux) pour voir chaque écran.</li>
        <li><b>Contenu</b> : clique sur un élément du site pour changer son texte, son lien, son image ou son style, le cacher, le déplacer à la souris, ou ajouter un texte, un titre, un bouton ou une image à côté.</li>
        <li><b>Couleurs</b> : chaque couleur du site, des thèmes tout prêts et une alerte si un texte devient peu lisible.</li>
        <li><b>Polices</b> : titres, texte et étiquettes, parmi une trentaine de polices.</li>
        <li><b>Avancé</b> : du CSS libre pour tout le reste, et l&apos;export / import du thème.</li>
        <li><b>Revenir au design d&apos;origine</b> à tout moment, puis Publier.</li>
      </ul>
      <p style={{ fontSize: 14, color: "rgb(var(--c-text-faint))" }}>
        Le code d&apos;accès est la variable <code>DESIGN_TOKEN</code> du serveur de jeu (à défaut, celui des statistiques).
        En local, sans code configuré, laisse le champ vide.
      </p>
    </InfoPage>
  );
}
