import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ThemeRuntime } from "@/components/ThemeRuntime";
import { THEME_BOOT_SCRIPT } from "@/lib/themeBoot";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
});
// Inter reste chargé en secours : Bricolage n'a pas d'italique.
const body = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Texte courant et étiquettes « mono » utilisent aussi Bricolage (voir
// --font-body / --font-mono dans globals.css).

export const metadata: Metadata = {
  title: "Boum — le party-game entre amis",
  description:
    "Des jeux de soirée entre amis : dessin, faux-artiste, relais, doublage, quiz, images à deviner. Aucun compte, jouable au téléphone.",
};

export const viewport: Viewport = {
  themeColor: "#14102A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <head>
        {/* Remet le thème personnalisé avant l'affichage (pas de flash de couleurs). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        {children}
        {/* Thème publié depuis /design (+ l'éditeur en direct quand il est ouvert). */}
        <ThemeRuntime />
        {/* Mesure d'audience Vercel : seulement si le site est hébergé sur Vercel. */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  );
}
