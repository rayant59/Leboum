"use client";

import { useEffect } from "react";

/** Route-level error boundary: turns an unexpected crash into a readable
 *  message (with a retry) instead of a blank grey page. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the error in the console for easy debugging.
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="eyebrow mb-2 text-magenta">Oups, une erreur est survenue</p>
        <p className="mb-4 text-text-muted">{error?.message || "Erreur inattendue."}</p>
        <div className="flex justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-xl bg-gold px-4 py-2 font-display font-bold text-ink-deep transition-transform hover:-translate-y-0.5"
          >
            Réessayer
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="rounded-xl border border-ink-border px-4 py-2 text-text-muted hover:border-gold hover:text-text"
          >
            Accueil
          </button>
        </div>
        <p className="mt-4 text-xs text-text-faint">Si ça persiste, recharge la page (Ctrl+Maj+R).</p>
      </div>
    </main>
  );
}
