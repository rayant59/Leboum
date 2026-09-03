import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, Space_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
});
// Inter reste chargé en secours : Bricolage n'a pas d'italique.
const body = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

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
    <html lang="fr" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
