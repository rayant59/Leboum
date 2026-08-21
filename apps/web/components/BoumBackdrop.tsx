"use client";

// Shared immersive backdrop for the "Boum" universe: animated aurora blobs,
// drifting dots, the keyframes and the display/mono fonts. Render it once, high
// in a page; place your content above it with position:relative / zIndex:1.

const DOT_COLORS = ["rgba(255,194,75,0.7)", "rgba(255,77,141,0.6)", "rgba(70,224,176,0.6)", "rgba(243,238,255,0.5)"];
const DOTS = Array.from({ length: 14 }, (_, i) => ({
  left: ((i * 67) % 100) + "%",
  size: (3 + (i % 3) * 2) + "px",
  color: DOT_COLORS[i % DOT_COLORS.length],
  opacity: (0.35 + (i % 3) * 0.12).toFixed(2),
  dx: (i % 2 ? 1 : -1) * (10 + (i % 4) * 8) + "px",
  dur: (11 + (i % 5) * 3) + "s",
  delay: (i * 0.9).toFixed(1) + "s",
}));

export const BOUM_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Space+Mono:wght@400;700&display=swap');
@keyframes caretBlink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
@keyframes tagIn { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes titlePop { 0% { opacity: 0; transform: scale(0.82) translateY(12px); } 55% { transform: scale(1.05) translateY(0); } 100% { opacity: 1; transform: none; } }
@keyframes wiggle { 0%,100% { transform: rotate(0); } 20% { transform: rotate(16deg); } 55% { transform: rotate(-11deg); } 80% { transform: rotate(6deg); } }
@keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes goldGlow { 0%,100% { text-shadow: 0 0 18px rgba(255,194,75,0.55), 0 0 2px rgba(255,194,75,0.4); } 50% { text-shadow: 0 0 34px rgba(255,194,75,0.85), 0 0 6px rgba(255,194,75,0.6); } }
@keyframes tilePop { 0% { opacity: 0; transform: scale(0.6) translateY(8px); } 60% { transform: scale(1.08); } 100% { opacity: 1; transform: none; } }
@keyframes revealPop { 0% { opacity: 0; transform: scale(0.8) translateY(10px); } 60% { transform: scale(1.04); } 100% { opacity: 1; transform: none; } }
@keyframes winnerGlow { 0%,100% { box-shadow: 0 0 0 1px rgba(255,194,75,0.35), 0 0 22px -6px rgba(255,194,75,0.5); } 50% { box-shadow: 0 0 0 1px rgba(255,194,75,0.6), 0 0 34px -4px rgba(255,194,75,0.8); } }
@keyframes revealPop { 0% { opacity: 0; transform: scale(0.85) translateY(8px); } 60% { transform: scale(1.04); } 100% { opacity: 1; transform: none; } }
@keyframes auroraA { 0% { transform: translate(-4%,-2%) scale(1); } 50% { transform: translate(6%,5%) scale(1.18); } 100% { transform: translate(-4%,-2%) scale(1); } }
@keyframes auroraB { 0% { transform: translate(3%,4%) scale(1.1); } 50% { transform: translate(-6%,-4%) scale(1); } 100% { transform: translate(3%,4%) scale(1.1); } }
@keyframes auroraC { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(-5%,6%) scale(1.22); } 100% { transform: translate(0,0) scale(1); } }
@keyframes driftUp { 0% { transform: translateY(0) translateX(0); opacity: 0; } 12% { opacity: var(--o,0.5); } 88% { opacity: var(--o,0.5); } 100% { transform: translateY(-110px) translateX(var(--dx,0)); opacity: 0; } }
@keyframes confettiFall { 0% { transform: translateY(-14vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(114vh) rotate(760deg); opacity: 0.85; } }
@keyframes sheen { 0% { transform: translateX(-140%) skewX(-18deg); } 100% { transform: translateX(340%) skewX(-18deg); } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; } }
`;

/** Fixed full-screen animated background. */
export function BoumBackdrop({ withStyle = true }: { withStyle?: boolean }) {
  return (
    <>
      {withStyle && <style dangerouslySetInnerHTML={{ __html: BOUM_CSS }} />}
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundColor: "#14102A", backgroundImage: "radial-gradient(130% 120% at 50% 30%, transparent 58%, rgba(6,4,14,0.5) 100%)" }}>
        <div style={{ position: "absolute", top: "-12%", left: "10%", width: 620, height: 620, borderRadius: "50%", filter: "blur(70px)", background: "radial-gradient(circle, rgba(255,194,75,0.14), transparent 62%)", animation: "auroraA 17s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "-8%", right: "2%", width: 560, height: 560, borderRadius: "50%", filter: "blur(72px)", background: "radial-gradient(circle, rgba(255,77,141,0.12), transparent 62%)", animation: "auroraB 21s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "36%", left: "44%", width: 480, height: 480, borderRadius: "50%", filter: "blur(78px)", background: "radial-gradient(circle, rgba(70,224,176,0.08), transparent 64%)", animation: "auroraC 25s ease-in-out infinite" }} />
        {DOTS.map((d, i) => (
          <div key={i} style={{ position: "absolute", left: d.left, bottom: -12, width: d.size, height: d.size, borderRadius: "50%", background: d.color, ["--o" as string]: d.opacity, ["--dx" as string]: d.dx, animation: `driftUp ${d.dur} linear ${d.delay} infinite` }} />
        ))}
      </div>
    </>
  );
}
