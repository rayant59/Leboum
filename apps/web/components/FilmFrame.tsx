import { type PublicGameState } from "@subtitles-party/shared";
import { SubtitleStrip } from "./SubtitleStrip";

/** Styled "film frame" — used as the writing-phase reminder and as the video
 *  fallback when a clip can't load. */
export function FilmFrame({
  game,
  small = false,
}: {
  game: PublicGameState;
  small?: boolean;
}) {
  const clip = game.clip;
  const accent = clip?.posterColor ?? "#FFC24B";
  return (
    <div
      className="relative grid place-items-center overflow-hidden rounded-2xl border border-ink-border"
      style={{
        aspectRatio: small ? "16 / 7" : "16 / 10",
        background: "linear-gradient(160deg,#0b0918,#1a1436)",
      }}
    >
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(60% 80% at 30% 40%, color-mix(in srgb, ${accent} 55%, transparent), transparent 70%), radial-gradient(50% 70% at 75% 65%, color-mix(in srgb, ${accent} 35%, transparent), transparent 70%)`,
        }}
      />
      <span className="absolute left-3 top-3 rounded-md border border-ink-border bg-black/40 px-2 py-1 font-mono text-[11px] tracking-widest text-text-muted">
        {clip?.lang ? `♪ ${clip.lang.toUpperCase()}` : "▶ EXTRAIT"}
      </span>
      <div className="relative px-5 text-center font-display text-2xl font-extrabold sm:text-3xl">
        {clip?.title ?? "Scène"}
      </div>
      <span className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <SubtitleStrip>que disent-ils&nbsp;?</SubtitleStrip>
      </span>
    </div>
  );
}
