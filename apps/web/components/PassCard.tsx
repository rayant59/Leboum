"use client";

import { useEffect, useState } from "react";
import { passActive, type PublicRoomState } from "@subtitles-party/shared";
import { serverHttpUrl } from "@/lib/useRoom";

/** Bonus du Pass Soirée — une seule liste, réutilisée partout. */
export const PASS_PERKS = [
  "Jusqu'à 12 joueurs dans le salon au lieu de 8 (Mimic Boum reste à 8)",
  "Tes propres questions dans « Ça te parle ? »",
  "Valable 12 h pour toute la tablée, sans compte",
];

interface PassConfig { enabled: boolean; priceLabel: string }

/** Le paiement est-il disponible ? (lu une fois depuis le serveur de jeu) */
export function usePassConfig(): PassConfig | null {
  const [cfg, setCfg] = useState<PassConfig | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(serverHttpUrl("/pass/config"))
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => alive && setCfg(c as PassConfig | null))
      .catch(() => alive && setCfg(null));
    return () => { alive = false; };
  }, []);
  return cfg;
}

const fmtHour = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * Carte « Pass Soirée » dans le salon. N'importe qui peut l'offrir à la
 * tablée (esprit « je paie ma tournée ») ; une fois actif, tout le monde le voit.
 */
export function PassCard({ state, serverNow, cfg }: { state: PublicRoomState; serverNow: () => number; cfg: PassConfig | null }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const active = passActive(state, serverNow());

  if (active && state.pass) {
    return (
      <section className="mb-8" style={{ borderRadius: 18, padding: "16px 18px", border: "1px solid rgba(255,194,75,.55)", background: "linear-gradient(135deg, rgba(255,194,75,.14), rgba(255,77,141,.08))" }}>
        <p style={{ margin: 0, fontFamily: "var(--font-display), sans-serif", fontWeight: 800, fontSize: 18, color: "#FFC24B" }}>
          ✨ Pass Soirée actif
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "#C9C2E6" }}>
          {state.pass.offeredBy ? <>Offert par <b style={{ color: "#F3EEFF" }}>{state.pass.offeredBy}</b> · </> : null}
          jusqu&apos;à {fmtHour(state.pass.activeUntil)}. Merci, vous faites vivre LeBoum&nbsp;!
        </p>
      </section>
    );
  }

  if (!cfg?.enabled) return null;

  async function buy() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(serverHttpUrl("/pass/checkout"), {
        method: "POST",
        body: JSON.stringify({ room: state.code, origin: window.location.origin }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Paiement indisponible.");
      window.location.href = json.url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="mb-8" style={{ borderRadius: 18, padding: "16px 18px", border: "1px solid #332A5A", background: "rgba(28,22,54,.6)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: "var(--font-display), sans-serif", fontWeight: 800, fontSize: 18, color: "#F3EEFF" }}>
            Pass Soirée <span style={{ color: "#FFC24B" }}>· {cfg.priceLabel}</span>
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#A79FC7" }}>Un seul paiement, toute la tablée en profite.</p>
        </div>
        <button onClick={buy} disabled={busy} className="arc arc-p" style={{ flex: "none" }}>
          {busy ? "Ouverture du paiement…" : "Offrir le Pass à la tablée"}
        </button>
      </div>
      <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 14, color: "#C9C2E6" }}>
        {PASS_PERKS.map((p) => <li key={p}>{p}</li>)}
      </ul>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6E6796", lineHeight: 1.5 }}>
        Paiement sécurisé par Stripe. Le jeu de base reste 100 % gratuit. En payant, tu demandes l&apos;accès
        immédiat au Pass et renonces à ton droit de rétractation pour ce contenu numérique.{" "}
        <a href="/cgv" target="_blank" style={{ color: "#A79FC7" }}>Conditions de vente</a>
      </p>
      {err && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#FF8A8A" }}>{err}</p>}
    </section>
  );
}
