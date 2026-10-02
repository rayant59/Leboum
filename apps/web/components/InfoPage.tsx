import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";

/** Mise en page des pages d'information (entreprises, légal, stats). */
export function InfoPage({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "radial-gradient(1200px 600px at 50% -10%, #241A4A 0%, #14102A 55%, #0E0B1A 100%)", color: "#F3EEFF" }}>
      <main style={{ width: "min(760px, calc(100vw - 32px))", margin: "0 auto", padding: "28px 0 0" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#A79FC7", textDecoration: "none", fontSize: 14 }}>
          ← Retour à LeBoum
        </Link>
        <p style={{ margin: "36px 0 6px", fontFamily: "var(--font-mono), 'Space Mono', monospace", fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "#FFC24B" }}>{kicker}</p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display), 'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "clamp(30px, 6vw, 46px)", lineHeight: 1.05, letterSpacing: "-.02em" }}>{title}</h1>
        <div className="info-body" style={{ marginTop: 22, fontSize: 16, lineHeight: 1.65, color: "#C9C2E6" }}>{children}</div>
      </main>
      <style dangerouslySetInnerHTML={{ __html: `.info-body h2{font-family:var(--font-display),'Bricolage Grotesque',sans-serif;font-size:21px;font-weight:800;color:#F3EEFF;margin:32px 0 8px}.info-body a{color:#FFC24B}.info-body ul{padding-left:20px}.info-body li{margin:4px 0}` }} />
      <SiteFooter />
    </div>
  );
}
