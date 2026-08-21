"use client";

/** Catches errors thrown in the root layout itself (must render <html>/<body>). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ background: "#0b0b12", color: "#e7e7ef", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ display: "grid", minHeight: "100dvh", placeItems: "center", padding: "24px", textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <p style={{ color: "#ff5db1", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontSize: 12 }}>Erreur</p>
            <p style={{ margin: "8px 0 16px", opacity: 0.8 }}>{error?.message || "Erreur inattendue."}</p>
            <button
              onClick={reset}
              style={{ background: "#ffc24b", color: "#0b0b12", fontWeight: 700, border: 0, borderRadius: 12, padding: "8px 16px", cursor: "pointer" }}
            >
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
