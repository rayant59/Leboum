// ---------------------------------------------------------------------------
// Icônes LeBoum (phase 16 — identité). Un seul jeu d'icônes dessinées pour
// toute la plateforme, à la place des emojis utilisés comme icônes : trait
// arrondi, épais, avec un léger remplissage teinté — reconnaissable et
// cohérent d'un jeu à l'autre. Les emojis restent pour les RÉACTIONS des
// joueurs (c'est leur voix), pas pour l'interface.
//
//   <BoumIcon name="trophy" size={20} color="#FFC24B" />
// ---------------------------------------------------------------------------

import type { CSSProperties } from "react";

export type BoumIconName =
  | "trophy"
  | "medal"
  | "heart"
  | "bomb"
  | "blast"
  | "skull"
  | "bolt"
  | "handshake"
  | "mic"
  | "micOff"
  | "speaker"
  | "speakerOff"
  | "headphones"
  | "pencil"
  | "eye"
  | "bell"
  | "bellOff"
  | "star"
  | "sparkle"
  | "target"
  | "bulb"
  | "replay"
  | "wave"
  | "dot"
  | "party"
  | "cheers"
  | "cross"
  | "warning"
  | "chat";

export function BoumIcon({
  name,
  size = 20,
  color = "currentColor",
  fill,
  strokeWidth = 2,
  label,
  style,
  className,
}: {
  name: BoumIconName;
  size?: number | string;
  color?: string;
  /** Teinte de remplissage (par défaut : la couleur à 18 %). */
  fill?: string;
  strokeWidth?: number;
  /** Texte lu par les lecteurs d'écran ; sans lui l'icône est décorative. */
  label?: string;
  style?: CSSProperties;
  className?: string;
}) {
  const tint = fill ?? ((color.startsWith("#") && color.length === 7) || color.startsWith("rgb(var(") ? `color-mix(in srgb, ${color} 18%, transparent)` : "none");
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", flex: "none", verticalAlign: "-0.15em", ...style }}
      className={className}
      {...a11y}
    >
      {label && <title>{label}</title>}
      {paths(name, color, tint)}
    </svg>
  );
}

function paths(name: BoumIconName, c: string, t: string) {
  switch (name) {
    case "trophy":
      return (
        <>
          <path d="M7 3.5h10v5.5a5 5 0 0 1-10 0V3.5Z" fill={t} />
          <path d="M7 5.5H4.2a3.2 3.2 0 0 0 3.3 4.4M17 5.5h2.8a3.2 3.2 0 0 1-3.3 4.4M12 14v3.5M8.5 20.5h7M9.5 17.5h5v3h-5z" />
        </>
      );
    case "medal":
      return (
        <>
          <path d="M8 2.5 10.5 8M16 2.5 13.5 8" />
          <circle cx="12" cy="14.5" r="6" fill={t} />
          <path d="m12 11.6 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3 1-2Z" fill={c} stroke="none" />
        </>
      );
    case "heart":
      return <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z" fill={t === "none" ? "none" : c} />;
    case "bomb":
      return (
        <>
          <circle cx="10.5" cy="14" r="6.5" fill={t} />
          <path d="m15 9.5 2-2M17 7.5c.6-1.6 2-2.4 3.5-2" />
          <path d="M20.5 2.5v1.2M22 4.5h-1.2M19.4 3.4l.6.6" strokeWidth={1.6} />
          <path d="M7.5 12a3 3 0 0 1 2.2-2" opacity={0.7} />
        </>
      );
    case "blast":
      return <path d="m12 2 1.9 5.2L19 4.6l-2.1 5L22 12l-5.1 1.9 2.1 5.5-5.2-2.6L12 22l-1.8-5.2L5 19.4l2.1-5.5L2 12l5.1-2.4L5 4.6l5.1 2.6L12 2Z" fill={t} />;
    case "skull":
      return (
        <>
          <path d="M5 11a7 7 0 1 1 14 0c0 2.3-1 3.6-2.5 4.4V19a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-3.6C6 14.6 5 13.3 5 11Z" fill={t} />
          <circle cx="9.3" cy="11.5" r="1.6" fill={c} stroke="none" />
          <circle cx="14.7" cy="11.5" r="1.6" fill={c} stroke="none" />
          <path d="M10.5 20v-2M13.5 20v-2" />
        </>
      );
    case "bolt":
      return <path d="M13.5 2 4.5 13.5h6.5L10 22l9.5-12H13l.5-8Z" fill={t} />;
    case "handshake":
      return (
        <>
          <path d="M2.5 11 6 7.5l3 1 3-2 3.5 1L21.5 11" />
          <path d="m6 13 4.5 4.5a1.5 1.5 0 0 0 2.1-2.1M9 15.5l2.4 2.4a1.5 1.5 0 0 0 2.1-2.1M12 13.4l2 2a1.5 1.5 0 0 0 2.1-2.1L12 9.2l-2.3 1.6a1.6 1.6 0 0 1-2-2.4" fill={t} />
          <path d="m16 13.3 2.3-2.3" />
        </>
      );
    case "mic":
      return (
        <>
          <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill={t} />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7" />
        </>
      );
    case "micOff":
      return (
        <>
          <path d="M15.5 9V6a3.5 3.5 0 0 0-6.6-1.6M8.5 9v2.5a3.5 3.5 0 0 0 5.6 2.8" />
          <path d="M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.6 2.8M12 18v3.5M8.5 21.5h7M3 3l18 18" />
        </>
      );
    case "speaker":
      return (
        <>
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill={t} />
          <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
        </>
      );
    case "speakerOff":
      return (
        <>
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill={t} />
          <path d="m16 9.5 5 5M21 9.5l-5 5" />
        </>
      );
    case "headphones":
      return (
        <>
          <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
          <rect x="3" y="14" width="4.5" height="7" rx="2" fill={t} />
          <rect x="16.5" y="14" width="4.5" height="7" rx="2" fill={t} />
        </>
      );
    case "pencil":
      return (
        <>
          <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5 4 20Z" fill={t} />
          <path d="m13.5 7 3 3" />
        </>
      );
    case "eye":
      return (
        <>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill={t} />
          <circle cx="12" cy="12" r="3" fill={c} stroke="none" />
        </>
      );
    case "bell":
      return (
        <>
          <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z" fill={t} />
          <path d="M10 21a2.2 2.2 0 0 0 4 0" />
        </>
      );
    case "bellOff":
      return (
        <>
          <path d="M8.2 5.6A6 6 0 0 1 18 11v4M6 11v5.5l-1.5 2h12M10 21a2.2 2.2 0 0 0 4 0M3 3l18 18" />
        </>
      );
    case "star":
      return <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.2 6.1L12 16.8l-5.5 2.9 1.2-6.1-4.5-4.2 6.1-.8L12 3Z" fill={t} />;
    case "sparkle":
      return (
        <>
          <path d="M10 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z" fill={t} />
          <path d="M18.5 14.5c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3Z" fill={c} strokeWidth={1.2} />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="12" cy="12" r="9" fill={t} />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" fill={c} stroke="none" />
        </>
      );
    case "bulb":
      return (
        <>
          <path d="M8.5 15.5a6 6 0 1 1 7 0c-.6.5-1 1.2-1 2v.5h-5v-.5c0-.8-.4-1.5-1-2Z" fill={t} />
          <path d="M9.5 21h5" />
        </>
      );
    case "replay":
      return (
        <>
          <path d="M3.5 12a8.5 8.5 0 1 1 2.5 6" />
          <path d="M3.5 19.5V14H9" />
        </>
      );
    case "wave":
      return (
        <>
          <path d="M8 13.5V6.2a1.4 1.4 0 0 1 2.8 0V12M10.8 11V4.8a1.4 1.4 0 0 1 2.8 0V11M13.6 11V6.2a1.4 1.4 0 0 1 2.8 0V13c0 4-2.4 7.5-6.2 7.5-2.4 0-3.7-1.1-5-3.1L3.6 14a1.4 1.4 0 0 1 2.2-1.7L8 14.5" fill={t} />
          <path d="M18.5 3.5c1.2.6 2 1.7 2.2 3M17.8 6.2c.5.3.8.8.9 1.4" strokeWidth={1.6} />
        </>
      );
    case "dot":
      return <circle cx="12" cy="12" r="5.5" fill={c} stroke="none" />;
    case "party":
      return (
        <>
          <path d="M3 21 8 7l9 9-14 5Z" fill={t} />
          <path d="M13.5 6.5c1-1.5 1-3 0-4M17 10c1.5-1 3-1 4.5 0M15.5 8.5l4-4" />
          <path d="M7 12.5 11.5 17M5.5 16.5l2 2" strokeWidth={1.6} />
        </>
      );
    case "cheers":
      return (
        <>
          <path d="M5 4h6l-.6 6.2A2.4 2.4 0 0 1 8 12.4a2.4 2.4 0 0 1-2.4-2.2L5 4Z" fill={t} />
          <path d="M13 4h6l-.6 6.2a2.4 2.4 0 0 1-2.4 2.2 2.4 2.4 0 0 1-2.4-2.2L13 4Z" fill={t} />
          <path d="M8 12.4V20M16 12.4V20M5.5 20.5h5M13.5 20.5h5M5.4 7h5.2M13.4 7h5.2" />
        </>
      );
    case "cross":
      return <path d="M6 6l12 12M18 6 6 18" />;
    case "warning":
      return (
        <>
          <path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" fill={t} />
          <path d="M12 9v4.5M12 17v.01" />
        </>
      );
    case "chat":
      return <path d="M4 5.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" fill={t} />;
  }
}

/** Médaille de place (1, 2, 3) aux couleurs du podium. */
export function PlaceMedal({ place, size = 22 }: { place: number; size?: number }) {
  const color = place === 1 ? "rgb(var(--c-gold))" : place === 2 ? "#C9C3E6" : place === 3 ? "#E39A5B" : "rgb(var(--c-text-faint))";
  return (
    <span style={{ position: "relative", display: "inline-grid", placeItems: "center", width: size, height: size, flex: "none" }} aria-label={`${place}e place`} role="img">
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <path d="M8 1.5 10.5 7M16 1.5 13.5 7" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
        <circle cx="12" cy="14.5" r="7.5" fill={color} />
      </svg>
      <span style={{ position: "absolute", top: "38%", left: 0, right: 0, textAlign: "center", fontFamily: "var(--font-display), system-ui, sans-serif", fontWeight: 800, fontSize: size * 0.42, lineHeight: 1, color: "rgb(var(--c-ink))" }}>{place}</span>
    </span>
  );
}
