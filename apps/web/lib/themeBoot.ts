// Clés partagées avec lib/theme.ts (gardées ici sans dépendance : ce fichier
// est importé par app/layout.tsx, côté serveur).
const CSS_KEY = "lb:themeCss";
const FONTS_KEY = "lb:themeFonts";

/**
 * Script lancé dans <head> avant l'affichage : remet le dernier thème connu
 * pour éviter un « flash » des couleurs d'origine au chargement.
 */
export const THEME_BOOT_SCRIPT = `try{var c=localStorage.getItem("${CSS_KEY}");if(c){var s=document.createElement("style");s.id="lb-theme";s.textContent=c;document.head.appendChild(s)}var f=localStorage.getItem("${FONTS_KEY}");if(f){var l=document.createElement("link");l.id="lb-theme-fonts";l.rel="stylesheet";l.href=f;document.head.appendChild(l)}}catch(e){}`;

