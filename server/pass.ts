// ---------------------------------------------------------------------------
// Pass Soirée — paiement unique qui débloque des bonus pour UN salon pendant
// une soirée (12 h). Pas de compte joueur : le paiement est lié au salon.
//
// Parcours :
//   1. le site appelle POST /pass/checkout {room, origin} → URL de paiement
//      Stripe Checkout (page de paiement hébergée par Stripe : aucune donnée
//      bancaire ne passe par LeBoum) ;
//   2. après paiement, Stripe renvoie vers /room/CODE?pass=<session_id> ;
//   3. le site envoie {type:"redeem_pass", sessionId} sur le WebSocket ;
//   4. le serveur VÉRIFIE auprès de Stripe que la session est payée, puis
//      active le pass sur le salon.
//
// Configuration (variables d'environnement du serveur de jeu) :
//   STRIPE_SECRET_KEY   clé secrète Stripe (sk_test_… pour tester, sk_live_…)
//   STRIPE_PASS_PRICE   identifiant du prix Stripe (price_…)
//   PASS_PRICE_LABEL    prix affiché, ex. « 2,99 € » (doit correspondre au prix Stripe)
//   PUBLIC_SITE_URL     ex. https://leboum.fr (retour après paiement)
//   PASS_FILE           fichier des pass déjà utilisés (défaut data/passes.json)
//   PASS_DEV_FAKE=1     DÉVELOPPEMENT UNIQUEMENT : paiement simulé, sans Stripe
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const PASS_DURATION_MS = 12 * 60 * 60 * 1000;

export interface PassConfig {
  enabled: boolean;
  priceLabel: string;
  mode: "stripe" | "fake" | "off";
}

export interface CheckoutResult { url: string }
export interface VerifyResult { paid: boolean; room: string | null }

/** Fournisseur de paiement (Stripe en vrai, simulé en développement). */
export interface PassProvider {
  createCheckout(room: string, origin: string): Promise<CheckoutResult>;
  verify(sessionId: string): Promise<VerifyResult>;
}

// --- Stripe (API REST, sans SDK) ---------------------------------------------

export function stripeProvider(secretKey: string, priceId: string, fetchImpl: typeof fetch = fetch): PassProvider {
  const auth = { Authorization: `Bearer ${secretKey}` };
  return {
    async createCheckout(room, origin) {
      const body = new URLSearchParams({
        mode: "payment",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: `${origin}/room/${room}?pass={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/room/${room}`,
        client_reference_id: room,
        "metadata[room]": room,
        locale: "fr",
      });
      const res = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const json = (await res.json()) as { url?: string; error?: { message?: string } };
      if (!res.ok || !json.url) throw new Error(json.error?.message ?? `Stripe ${res.status}`);
      return { url: json.url };
    },
    async verify(sessionId) {
      if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { paid: false, room: null };
      const res = await fetchImpl(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, { headers: auth });
      if (!res.ok) return { paid: false, room: null };
      const s = (await res.json()) as { payment_status?: string; metadata?: { room?: string } };
      return { paid: s.payment_status === "paid", room: s.metadata?.room ?? null };
    },
  };
}

// --- Paiement simulé (développement / tests) --------------------------------

export function fakeProvider(): PassProvider {
  return {
    async createCheckout(room, origin) {
      const id = `fake_${room}_${Math.random().toString(36).slice(2, 10)}`;
      return { url: `${origin}/room/${room}?pass=${id}` };
    },
    async verify(sessionId) {
      const m = /^fake_([A-Z0-9]+)_[a-z0-9]+$/.exec(sessionId);
      return m ? { paid: true, room: m[1] } : { paid: false, room: null };
    },
  };
}

export function passConfigFromEnv(env: NodeJS.ProcessEnv): { config: PassConfig; provider: PassProvider | null } {
  const priceLabel = env.PASS_PRICE_LABEL ?? "2,99 €";
  if (env.STRIPE_SECRET_KEY && env.STRIPE_PASS_PRICE) {
    return { config: { enabled: true, priceLabel, mode: "stripe" }, provider: stripeProvider(env.STRIPE_SECRET_KEY, env.STRIPE_PASS_PRICE) };
  }
  if (env.PASS_DEV_FAKE === "1" && env.NODE_ENV !== "production") {
    return { config: { enabled: true, priceLabel, mode: "fake" }, provider: fakeProvider() };
  }
  return { config: { enabled: false, priceLabel, mode: "off" }, provider: null };
}

/** Origines autorisées pour le retour après paiement (anti-redirection). */
export function isAllowedOrigin(origin: string, publicSiteUrl: string | undefined): boolean {
  if (publicSiteUrl && origin === publicSiteUrl.replace(/\/$/, "")) return true;
  try {
    const u = new URL(origin);
    if (u.pathname !== "/" || u.search) return false;
    return /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(u.hostname) && u.protocol === "http:";
  } catch {
    return false;
  }
}

// --- Registre des pass utilisés ----------------------------------------------

interface Redemption { room: string; until: number }

/**
 * Un paiement = un pass de 12 h, jamais plus. On mémorise chaque session
 * Stripe déjà utilisée : rejouer le même lien ne prolonge rien, et le pass ne
 * peut pas servir à deux salons à la fois. Il peut seulement être « déplacé »
 * si son salon d'origine n'existe plus (ex. redémarrage du serveur).
 */
export class PassRegistry {
  private used: Record<string, Redemption> = {};

  constructor(private file: string | null) {
    if (file && existsSync(file)) {
      try { this.used = JSON.parse(readFileSync(file, "utf8")) as Record<string, Redemption>; } catch { /* repart à vide */ }
    }
  }

  /** Renvoie l'échéance du pass pour ce salon, ou une raison de refus. */
  redeem(sessionId: string, room: string, now: number, roomExists: (code: string) => boolean): { until: number; fresh: boolean } | { refused: string } {
    const prev = this.used[sessionId];
    if (prev) {
      if (prev.until <= now) return { refused: "Ce Pass Soirée a expiré." };
      if (prev.room !== room && roomExists(prev.room)) return { refused: "Ce Pass Soirée est déjà utilisé dans un autre salon." };
      this.used[sessionId] = { room, until: prev.until };
    } else {
      this.used[sessionId] = { room, until: now + PASS_DURATION_MS };
    }
    this.save(now);
    return { until: this.used[sessionId].until, fresh: !prev };
  }

  private save(now: number) {
    // On oublie les pass expirés depuis plus d'une semaine.
    for (const [k, v] of Object.entries(this.used)) if (v.until < now - 7 * 24 * 3600_000) delete this.used[k];
    if (!this.file) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(this.used));
    } catch (e) {
      console.warn("[pass] écriture impossible :", (e as Error).message);
    }
  }
}
