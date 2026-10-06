// ---------------------------------------------------------------------------
// Réglages du site LeBoum — tout ce qui sert à gagner de l'argent et les
// informations légales est ici, au même endroit.
//
// Chaque valeur peut être remplie ICI, ou via une variable d'environnement
// au BUILD du site (Northflank → service leboum-web → Build arguments),
// qui est prioritaire (Next.js fige les NEXT_PUBLIC_* au moment du build).
// Une valeur vide = la fonctionnalité correspondante reste cachée.
// ---------------------------------------------------------------------------

/** ☕ Ton lien de dons — colle-le entre les guillemets, par ex.
 *  "https://ko-fi.com/leboum". Tant qu'il est vide, le bouton reste caché.
 *  (La variable NEXT_PUBLIC_SUPPORT_URL, si elle est définie au build, a la priorité.) */
const DONATION_URL = "";

/** N'accepte qu'un vrai lien https (évite un bouton cassé en ligne). */
const safeUrl = (u: string | undefined) => (u && /^https:\/\/\S+$/.test(u.trim()) ? u.trim() : "");

export const SITE = {
  name: "LeBoum",
  url: "https://leboum.fr",

  /** Lien de la page de dons (Ko-fi, Tipeee, Buy Me a Coffee…).
   *  Vide → le bouton « Soutenir LeBoum » n'apparaît nulle part. */
  supportUrl: safeUrl(process.env.NEXT_PUBLIC_SUPPORT_URL) || safeUrl(DONATION_URL),

  /** Adresse de contact (page Entreprises + mentions légales). */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",

  /** Mentions légales : nom, SIRET, contact et hébergeur. Aucune adresse
   *  postale n'est affichée sur le site (choix de l'éditeur). */
  legal: {
    editor: {
      name: process.env.NEXT_PUBLIC_LEGAL_NAME ?? "",
      siret: process.env.NEXT_PUBLIC_LEGAL_SIRET ?? "",
    },
    /** Médiateur de la consommation (obligatoire dès qu'on vend aux particuliers). */
    mediator: process.env.NEXT_PUBLIC_LEGAL_MEDIATOR ?? "",
    hosts: [
      { role: "Site web et serveur de jeu", name: "Northflank Ltd.", website: "https://northflank.com", address: "" },
    ],
  },
} as const;
