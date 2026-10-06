// Run: npx tsx theme.test.ts
import {
  EMPTY_THEME, THEME_COLORS, THEME_CSS_MAX, THEME_FONTS, THEME_PRESETS,
  contrastRatio, darken, hexToTriplet, sanitizeTheme, themeColor, themeFontsUrl, themeToCss,
} from "./theme";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  \u001b[32m✓\u001b[0m ${name}`);
  } catch (e) {
    failed++;
    console.log(`  \u001b[31m✗ ${name}\u001b[0m\n      ${(e as Error).message}`);
  }
}
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

console.log("\nThème du site\n");

test("le thème vide ne change rien", () => {
  assert(themeToCss(EMPTY_THEME) === "", "aucune règle");
  assert(themeFontsUrl(EMPTY_THEME) === null, "aucune police");
});

test("sanitizeTheme garde le valide et jette le reste", () => {
  const t = sanitizeTheme({
    colors: { gold: "#00ff00", inconnu: "#123456", mint: "rouge", ink: "#12345" },
    fonts: { display: "Poppins", body: "Comic Sans MS", mono: 42 },
    css: "a{color:red}",
    extra: true,
  });
  assert(t, "thème accepté");
  assert(JSON.stringify(t!.colors) === JSON.stringify({ gold: "#00FF00" }), `couleurs : ${JSON.stringify(t!.colors)}`);
  assert(JSON.stringify(t!.fonts) === JSON.stringify({ display: "Poppins" }), "polices de la liste seulement");
  assert(t!.css === "a{color:red}", "css conservé");
  assert(sanitizeTheme(null) === null && sanitizeTheme("x") === null, "entrées absurdes refusées");
});

test("le CSS libre est plafonné", () => {
  const t = sanitizeTheme({ css: "x".repeat(THEME_CSS_MAX + 500) });
  assert(t!.css.length === THEME_CSS_MAX, "tronqué");
});

test("themeToCss écrit des variables R G B prioritaires", () => {
  const css = themeToCss({ v: 1, colors: { gold: "#FF0080" }, fonts: { display: "Syne" }, css: ".x{}" });
  assert(css.includes("html:root{--c-gold:255 0 128;}"), css);
  assert(css.includes("body{--font-display:'Syne',system-ui, sans-serif;}"), css);
  assert(css.trimEnd().endsWith(".x{}"), "css libre à la fin");
});

test("adresse Google Fonts : une famille par police, sans doublon", () => {
  const url = themeFontsUrl({ v: 1, colors: {}, fonts: { display: "Space Grotesk", body: "Space Grotesk", mono: "DM Mono" }, css: "" })!;
  assert(url === "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap", url);
  const one = themeFontsUrl({ v: 1, colors: {}, fonts: { display: "Bungee" }, css: "" })!;
  assert(one.includes("family=Bungee&"), "police à graisse unique : pas de wght");
});

test("couleurs d'origine = celles du CSS du site", () => {
  assert(hexToTriplet("#FFC24B") === "255 194 75", "doré");
  assert(themeColor(EMPTY_THEME, "gold") === "#FFC24B", "repli sur l'origine");
  const names = new Set(THEME_COLORS.map((t) => t.name));
  assert(names.size === THEME_COLORS.length, "noms uniques");
  for (const t of THEME_COLORS) if (t.shadeOf) assert(names.has(t.shadeOf), `${t.name} suit une couleur existante`);
});

test("contraste et assombrissement", () => {
  assert(Math.abs(contrastRatio("#000000", "#FFFFFF") - 21) < 0.01, "noir/blanc = 21");
  assert(darken("#FFFFFF", 0.5) === "#808080", darken("#FFFFFF", 0.5));
});

test("les thèmes tout prêts sont valides et lisibles", () => {
  const fams = new Set(THEME_FONTS.map((f) => f.family));
  assert(fams.size === THEME_FONTS.length, "polices uniques");
  for (const p of THEME_PRESETS) {
    const t = sanitizeTheme({ colors: p.colors })!;
    assert(Object.keys(t.colors).length === Object.keys(p.colors).length, `${p.name} : couleurs valides`);
    const r1 = contrastRatio(themeColor(t, "text"), themeColor(t, "ink-surface"));
    const r2 = contrastRatio(themeColor(t, "ink-deep"), themeColor(t, "gold"));
    const r3 = contrastRatio(themeColor(t, "text-muted"), themeColor(t, "ink-surface"));
    assert(r1 >= 4.5 && r2 >= 4.5 && r3 >= 4.5, `${p.name} : contrastes ${r1.toFixed(1)} / ${r2.toFixed(1)} / ${r3.toFixed(1)}`);
  }
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
