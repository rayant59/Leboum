// Run: npx tsx server/pass.test.ts
import { PassRegistry, PASS_DURATION_MS, isAllowedOrigin, stripeProvider, fakeProvider, passConfigFromEnv } from "./pass";

let passed = 0, failed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  \u001b[32m✓\u001b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \u001b[31m✗ ${name}\u001b[0m\n      ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

async function main() {
console.log("\nPass Soirée\n");

await test("un paiement = 12 h, rejouer le lien ne prolonge rien", () => {
  const r = new PassRegistry(null);
  const a = r.redeem("cs_1", "ABCD", 1000, () => true);
  assert("until" in a && a.until === 1000 + PASS_DURATION_MS && a.fresh, "première activation");
  const b = r.redeem("cs_1", "ABCD", 5000, () => true);
  assert("until" in b && b.until === 1000 + PASS_DURATION_MS && !b.fresh, "même échéance, pas « nouveau »");
});

await test("un pass ne sert pas à deux salons en même temps", () => {
  const r = new PassRegistry(null);
  r.redeem("cs_2", "AAAA", 0, () => true);
  const b = r.redeem("cs_2", "BBBB", 10, (c) => c === "AAAA");
  assert("refused" in b, "refusé tant que AAAA existe");
  const c = r.redeem("cs_2", "BBBB", 10, () => false);
  assert("until" in c, "déplaçable si le salon d'origine a disparu (redémarrage)");
});

await test("un pass expiré est refusé", () => {
  const r = new PassRegistry(null);
  r.redeem("cs_3", "AAAA", 0, () => true);
  const b = r.redeem("cs_3", "AAAA", PASS_DURATION_MS + 1, () => true);
  assert("refused" in b, "expiré");
});

await test("retour après paiement : seulement le site officiel ou le réseau local", () => {
  assert(isAllowedOrigin("https://leboum.fr", "https://leboum.fr/"), "site officiel");
  assert(isAllowedOrigin("http://localhost:3000", undefined), "localhost");
  assert(isAllowedOrigin("http://192.168.1.20:3000", undefined), "réseau local");
  assert(!isAllowedOrigin("https://evil.example", "https://leboum.fr"), "site tiers refusé");
  assert(!isAllowedOrigin("https://localhost:3000", undefined), "https localhost refusé (pas de cas réel)");
});

await test("Stripe : création de paiement avec le bon prix, le salon et le retour", async () => {
  let captured: { url: string; body: string; auth: string } | null = null;
  const fake = (async (url: string, init?: RequestInit) => {
    captured = { url, body: String(init?.body), auth: String((init?.headers as Record<string, string>).Authorization) };
    return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/x" }), { status: 200 });
  }) as unknown as typeof fetch;
  const p = stripeProvider("sk_test_123", "price_abc", fake);
  const { url } = await p.createCheckout("ABCD", "https://leboum.fr");
  assert(url.startsWith("https://checkout.stripe.com"), "URL Stripe renvoyée");
  const c = captured!;
  assert(c.auth === "Bearer sk_test_123", "clé secrète envoyée en en-tête");
  const body = new URLSearchParams(c.body);
  assert(body.get("line_items[0][price]") === "price_abc", "prix");
  assert(body.get("metadata[room]") === "ABCD", "salon en métadonnée");
  assert(body.get("success_url") === "https://leboum.fr/room/ABCD?pass={CHECKOUT_SESSION_ID}", "retour au salon");
});

await test("Stripe : seule une session « paid » est acceptée", async () => {
  const mk = (status: string) => (async () => new Response(JSON.stringify({ payment_status: status, metadata: { room: "ABCD" } }), { status: 200 })) as unknown as typeof fetch;
  assert((await stripeProvider("k", "p", mk("paid")).verify("cs_test_1")).paid, "payée");
  assert(!(await stripeProvider("k", "p", mk("unpaid")).verify("cs_test_1")).paid, "non payée");
  assert(!(await stripeProvider("k", "p", mk("paid")).verify("../../v1/customers")).paid, "identifiant suspect refusé sans appel");
});

await test("paiement simulé : uniquement si demandé ET hors production", () => {
  assert(passConfigFromEnv({ PASS_DEV_FAKE: "1" } as NodeJS.ProcessEnv).config.mode === "fake", "dev");
  assert(passConfigFromEnv({ PASS_DEV_FAKE: "1", NODE_ENV: "production" } as NodeJS.ProcessEnv).config.mode === "off", "jamais en prod");
  assert(passConfigFromEnv({} as NodeJS.ProcessEnv).config.enabled === false, "désactivé par défaut");
});

await test("paiement simulé : lien de retour vérifiable", async () => {
  const p = fakeProvider();
  const { url } = await p.createCheckout("ABCD", "http://localhost:3000");
  const id = new URL(url).searchParams.get("pass")!;
  const v = await p.verify(id);
  assert(v.paid && v.room === "ABCD", "vérifié pour ABCD");
});

console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exit(1);
}
void main();
