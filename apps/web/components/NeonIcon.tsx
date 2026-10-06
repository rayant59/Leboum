// ---------------------------------------------------------------------------
// Icônes illustrées LeBoum (style néon, fond transparent) : /public/icons/*.webp
// Découpées dans la planche d'icônes officielle. À utiliser pour les moments
// « vitrine » (trophée de soirée, vies, podium, distinctions…). Les petites
// icônes d'interface au trait (micro, son, cloche…) restent dans BoumIcon.
//
//   <NeonIcon name="trophy" size={40} />
// ---------------------------------------------------------------------------

import type { CSSProperties } from "react";

export type NeonIconName =
  | "crown" | "trophy" | "bomb" | "mic" | "gamepad" | "target" | "bulb" | "clapper"
  | "question" | "magnifier" | "palette" | "picture" | "film" | "speaker" | "soundwave" | "headphones"
  | "heart" | "heart-broken" | "star" | "bolt" | "fire" | "snowflake" | "hourglass" | "stopwatch"
  | "check" | "cross" | "chat" | "thinking" | "laughing" | "cool" | "surprised" | "angry"
  | "skull" | "ghost" | "alien" | "ufo" | "rocket" | "planet" | "sparkles" | "magic-wand"
  | "medal" | "laurel" | "diamond" | "gift" | "love-letter" | "calendar" | "megaphone" | "gear";

export function NeonIcon({
  name,
  size = 24,
  label,
  style,
  className,
  dim = false,
}: {
  name: NeonIconName;
  size?: number;
  /** Texte lu par les lecteurs d'écran ; sans lui l'icône est décorative. */
  label?: string;
  style?: CSSProperties;
  className?: string;
  /** Version éteinte (vie perdue, élément inactif). */
  dim?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/${name}.webp`}
      width={size}
      height={size}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      draggable={false}
      className={className}
      style={{
        width: size,
        height: size,
        flex: "none",
        objectFit: "contain",
        userSelect: "none",
        verticalAlign: "middle",
        ...(dim ? { filter: "grayscale(1) brightness(.75)", opacity: 0.45 } : null),
        ...style,
      }}
    />
  );
}
