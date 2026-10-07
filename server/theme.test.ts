// Run: npx tsx server/theme.test.ts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { THEME_COLORS, hexToTriplet } from "@subtitles-party/shared";
import { DraftStore, ThemeStore, designAllowed } from "./theme";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  \u001b[32m✓\u001b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \u001b[31m✗ ${name}\u001b[0m\n      ${(e as Error).message}`); }
}
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

console.log("\nThème du site (serveur)\n");

test("le thème publié survit à un redémarrage", () => {
  const dir = mkdtempSync(join(tmpdir(), "lb-theme-"));
  const file = join(dir, "sub", "theme.json");
  try {
    const a = new ThemeStore(file);
    assert(a.get().updatedAt === null && Object.keys(a.get().theme.colors).length === 0, "vide au départ");
    assert(a.set({ colors: { gold: "#112233" }, css: "p{}" }, 1234), "accepté");
    const b = new ThemeStore(file);
    assert(b.get().theme.colors.gold === "#112233" && b.get().theme.css === "p{}" && b.get().updatedAt === 1234, "relu depuis le disque");
    assert(a.set("n'importe quoi", 5) === null, "entrée invalide refusée");
    assert(new ThemeStore(file).get().updatedAt === 1234, "fichier inchangé après un refus");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("le brouillon (sauvegarde auto) survit à un redémarrage, puis s'efface", () => {
  const dir = mkdtempSync(join(tmpdir(), "lb-draft-"));
  const file = join(dir, "data", "draft.json");
  try {
    const a = new DraftStore(file);
    assert(a.get() === null, "vide au départ");
    assert(a.set({ colors: { gold: "#ABCDEF" }, edits: [] }, 77, 1000), "accepté");
    const b = new DraftStore(file);
    assert(b.get()?.theme.colors.gold === "#ABCDEF" && b.get()?.base === 77 && b.get()?.savedAt === 1000, "relu");
    assert(b.set(42, null, 5) === false && new DraftStore(file).get()?.base === 77, "entrée invalide refusée");
    b.set(null, null, 6);
    assert(new DraftStore(file).get() === null, "effacé");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("design du code (site-theme.json) contre design publié en ligne : le plus récent gagne", () => {
  const dir = mkdtempSync(join(tmpdir(), "lb-theme-"));
  const online = join(dir, "online.json");
  const code = join(dir, "site-theme.json");
  try {
    writeFileSync(code, JSON.stringify({ theme: { colors: { gold: "#111111" } }, updatedAt: 2000 }));
    writeFileSync(online, JSON.stringify({ theme: { colors: { gold: "#222222" } }, updatedAt: 1000 }));
    assert(new ThemeStore(online, code).get().theme.colors.gold === "#111111", "code plus récent → code");
    writeFileSync(online, JSON.stringify({ theme: { colors: { gold: "#222222" } }, updatedAt: 3000 }));
    assert(new ThemeStore(online, code).get().theme.colors.gold === "#222222", "publié en ligne plus récent → en ligne");
    // Publier écrit dans le premier fichier, jamais dans le design du code.
    new ThemeStore(online, code).set({ colors: { gold: "#333333" } }, 4000);
    assert(JSON.parse(readFileSync(code, "utf8")).theme.colors.gold === "#111111", "site-theme.json intact");
    // En local : un seul et même fichier.
    new ThemeStore(code, code).set({ colors: { gold: "#444444" } }, 5000);
    assert(new ThemeStore(code, code).get().theme.colors.gold === "#444444", "local : publié dans site-theme.json");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("fichier abîmé : thème d'origine, pas de plantage", () => {
  const dir = mkdtempSync(join(tmpdir(), "lb-theme-"));
  const file = join(dir, "theme.json");
  try {
    writeFileSync(file, "{pas du json");
    assert(Object.keys(new ThemeStore(file).get().theme.colors).length === 0, "origine");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("éditeur : seulement depuis ce PC, jamais via un proxy", () => {
  assert(designAllowed("127.0.0.1", {}) && designAllowed("::1", {}) && designAllowed("::ffff:127.0.0.1", {}), "localhost accepté");
  assert(!designAllowed("203.0.113.9", {}), "adresse extérieure refusée");
  assert(!designAllowed("192.168.1.20", {}), "autre appareil du Wi-Fi refusé");
  assert(!designAllowed("127.0.0.1", { "x-forwarded-for": "203.0.113.9" }), "via un proxy (site en ligne) refusé");
  assert(!designAllowed("127.0.0.1", { forwarded: "for=1.2.3.4" }) && !designAllowed("127.0.0.1", { via: "1.1 proxy" }), "autres en-têtes de proxy refusés");
  assert(!designAllowed(undefined, {}), "adresse inconnue refusée");
});

test("les couleurs d'origine de l'éditeur = celles de globals.css", () => {
  const css = readFileSync(resolve(__dirname, "../apps/web/app/globals.css"), "utf8");
  for (const t of THEME_COLORS) {
    assert(css.includes(`--c-${t.name}: ${hexToTriplet(t.hex)};`), `--c-${t.name} absent ou différent de ${t.hex}`);
  }
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
