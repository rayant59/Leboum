"use client";

// Charge le thème publié (et le garde à jour) ; en mode design, ouvre l'éditeur
// par-dessus le site. Monté une seule fois, dans app/layout.tsx.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { applyTheme, designToken, fetchPublished } from "@/lib/theme";

// L'éditeur n'est même pas inclus dans le site en ligne (build de production).
const DesignPanel =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("@/components/DesignPanel").then((m) => m.DesignPanel), { ssr: false })
    : () => null;

const REFRESH_MS = 60_000;

export function ThemeRuntime() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setToken(designToken());
    sync();
    window.addEventListener("lb:design-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lb:design-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Visiteurs : thème publié, rafraîchi de temps en temps (l'éditeur, lui,
  // applique son brouillon).
  useEffect(() => {
    if (token) return;
    let alive = true;
    const load = async () => {
      const r = await fetchPublished();
      if (alive && r) applyTheme(r.theme);
    };
    void load();
    const id = window.setInterval(load, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  return token ? <DesignPanel /> : null;
}
