// Run: npx tsx theme.test.ts
import {
  EMPTY_THEME, THEME_COLORS, THEME_CSS_MAX, THEME_FONTS, THEME_PRESETS,
  contrastRatio, darken, hexToTriplet, sanitizeTheme, themeColor, themeFontsUrl, themeToCss,
} from "./theme";
import { editsToCss, routeKey, sanitizeEdits } from "./edits";

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
  const css = themeToCss({ v: 1, colors: { gold: "#FF0080" }, fonts: { display: "Syne" }, css: ".x{}", edits: [] });
  assert(css.includes("html:root{--c-gold:255 0 128;}"), css);
  assert(css.includes("body{--font-display:'Syne',system-ui, sans-serif;}"), css);
  assert(css.trimEnd().endsWith(".x{}"), "css libre à la fin");
});

test("adresse Google Fonts : une famille par police, sans doublon", () => {
  const url = themeFontsUrl({ v: 1, colors: {}, fonts: { display: "Space Grotesk", body: "Space Grotesk", mono: "DM Mono" }, css: "", edits: [] })!;
  assert(url === "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap", url);
  const one = themeFontsUrl({ v: 1, colors: {}, fonts: { display: "Bungee" }, css: "", edits: [] })!;
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


test("modifications à la souris : nettoyage", () => {
  const ok = { id: "abcd1234", route: "/", path: "main:nth-child(1) > h1:nth-child(2)", tag: "h1", fp: "Boum", texts: ["Salut", null], style: { color: "#ff0000", x: 12, y: -4, fontSize: 9999, hidden: true, bidon: 1 } };
  const out = sanitizeEdits([
    ok,
    { ...ok, id: "abcd1234" }, // doublon
    { ...ok, id: "x" }, // id invalide
    { ...ok, id: "evil0001", path: "main > h1{}" }, // chemin invalide
    { ...ok, id: "evil0002", href: "javascript:alert(1)" },
    { ...ok, id: "evil0003", src: "data:image/png;base64,AAAA" },
    { ...ok, id: "add00001", add: { kind: "button", where: "after" }, href: "/cgv" },
    { ...ok, id: "add00002", add: { kind: "script", where: "after" } },
  ]);
  assert(out.length === 4, `4 gardées, pas ${out.length}`);
  const a = out[0];
  assert(a.style!.fontSize === 200 && a.style!.color === "#FF0000" && !("bidon" in a.style!), JSON.stringify(a.style));
  assert(out.find((e) => e.id === "evil0002")!.href === undefined, "javascript: refusé");
  assert(out.find((e) => e.id === "evil0003")!.src === undefined, "data: refusé");
  assert(out.find((e) => e.id === "add00001")!.add!.kind === "button", "ajout gardé");
  assert(!out.some((e) => e.id === "add00002"), "type d'ajout inconnu refusé");
});

test("modifications à la souris : CSS et pages", () => {
  const css = editsToCss(sanitizeEdits([{ id: "abcd1234", route: "/", path: "div:nth-child(1)", tag: "div", fp: "", style: { hidden: true, x: 5, y: 0, opacity: 50 } }]));
  assert(css.includes('[data-lbe~="abcd1234"]{display:none !important;opacity:0.5 !important;translate:5px 0px !important}'), css);
  assert(routeKey("/room/ABCD") === "/room/*" && routeKey("/cgv/") === "/cgv" && routeKey("/") === "/", "clés de page");
  const t = sanitizeTheme({ edits: [{ id: "abcd1234", route: "*", path: "p:nth-child(3)", tag: "p", fp: "x", texts: ["y"] }] })!;
  assert(t.edits.length === 1 && themeToCss(t) === "", "un simple texte ne génère pas de CSS");
});

test("modifications à la souris : taille (poignées)", () => {
  const [e] = sanitizeEdits([{ id: "abcd1234", route: "/", path: "div:nth-child(1)", tag: "div", fp: "%div,button", style: { width: 320.4, height: 99999, x: 5 } }]);
  assert(e.style?.width === 320 && e.style?.height === 4000, JSON.stringify(e.style));
  const css = editsToCss([e]);
  assert(css.includes("width:320px !important") && css.includes("height:4000px !important") && css.includes("max-width:none !important"), css);
  assert(!css.includes("display:"), "la taille ne change jamais le display");
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
