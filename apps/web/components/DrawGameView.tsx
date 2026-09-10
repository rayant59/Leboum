"use client";

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import type { DrawPublic, DrawStroke } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { SoundToggle } from "@/lib/sound";
import { Avatar } from "@/components/Avatar";
import { LB, DISPLAY, MONO, hexA, Aurora, type RailRow, lbShell, lbCard, lbGoldBtn, lbGhostBtn, topBar, LB_SCOPED_CSS } from "@/components/leboum";

const CW = 1200;
const CH = 800;
const MAX_TRAITS = 10;

type Tool = "brush" | "eraser" | "fill" | "line" | "rect" | "circle" | "arrow";
const TOOLS: { id: Tool; label: string }[] = [
  { id: "brush", label: "Pinceau" },
  { id: "eraser", label: "Gomme" },
  { id: "fill", label: "Remplir" },
  { id: "line", label: "Ligne" },
  { id: "rect", label: "Rectangle" },
  { id: "circle", label: "Cercle" },
  { id: "arrow", label: "Flèche" },
];

/** Clean line-art icons (no emoji). Stroke uses currentColor so the button's
 *  text colour drives the icon colour. */
function ToolSvg({ id }: { id: Tool | "clear" | "undo" }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "brush":
      return <svg viewBox="0 0 24 24" className="h-5 w-5"><path {...p} d="M4 20c1.5.2 3-.3 3.5-2 .4-1.4-.7-2.6-2-2.2C4 16.2 3.6 18.4 4 20Z" /><path {...p} d="m8 16 9-9M14 4l6 6-2 2-6-6z" /></svg>;
    case "eraser":
      return <svg viewBox="0 0 24 24" className="h-5 w-5"><path {...p} d="M8 20h10M5 15l6 6 8-8-6-6-8 8Z" /><path {...p} d="m9 11 4 4" /></svg>;
    case "fill":
      return <svg viewBox="0 0 24 24" className="h-5 w-5"><path {...p} d="M6 4l8 8-6 6a2 2 0 0 1-3 0l-3-3a2 2 0 0 1 0-3l4-4Z" /><path {...p} d="M14 12l3 4c.8 1.2 2.2 1.2 3 0 .8-1.2-.4-3-1.5-4" /></svg>;
    case "line":
      return <svg viewBox="0 0 24 24" className="h-5 w-5"><path {...p} d="M5 19 19 5" /></svg>;
    case "rect":
      return <svg viewBox="0 0 24 24" className="h-5 w-5"><rect {...p} x="4" y="6" width="16" height="12" rx="1.5" /></svg>;
    case "circle":
      return <svg viewBox="0 0 24 24" className="h-5 w-5"><circle {...p} cx="12" cy="12" r="8" /></svg>;
    case "arrow":
      return <svg viewBox="0 0 24 24" className="h-5 w-5"><path {...p} d="M4 20 20 4M20 4v7M20 4h-7" /></svg>;
    case "undo":
      return <svg viewBox="0 0 24 24" className="h-5 w-5"><path {...p} d="M9 14L4 9l5-5" /><path {...p} d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H8" /></svg>;
    case "clear":
      return <svg viewBox="0 0 24 24" className="h-5 w-5"><path {...p} d="M5 7h14M10 7V5h4v2M6 7l1 12h10l1-12" /></svg>;
  }
}

/** Tool glyph: uses the neon image at /tools/<id>.png when present, otherwise
 *  falls back to the clean SVG (never an emoji). The PNG fills the button. */
function ToolGlyph({ id }: { id: Tool | "clear" | "undo" }) {
  const [imgOk, setImgOk] = useState(false);
  const src = `/tools/${id}.png`;
  useEffect(() => {
    let alive = true;
    const im = new Image();
    im.onload = () => alive && setImgOk(true);
    im.onerror = () => alive && setImgOk(false);
    im.src = src;
    return () => { alive = false; };
  }, [src]);
  return imgOk ? <img src={src} alt="" className="h-full w-full object-contain" draggable={false} /> : <ToolSvg id={id} />;
}

/** Bouton d'outil neon : 44px, sans bordure, l'actif porte le double anneau doré. */
function toolBtnStyle(active: boolean): CSSProperties {
  return {
    width: 44, height: 44, padding: 0, border: "none", background: "transparent", borderRadius: 13,
    cursor: "pointer", display: "grid", placeItems: "center", flex: "none",
    boxShadow: active ? "0 0 0 2px #FFC24B, 0 0 0 5px rgba(255,194,75,.22)" : "none",
    transition: "transform .06s ease, box-shadow .12s ease",
  };
}

// §1 — colours grouped into families. Each family shows ONE primary swatch;
// double-click opens a popover with its shades ordered DARK → LIGHT.
const COLOR_FAMILIES: { name: string; main: string; variants: string[] }[] = [
  { name: "Noir & gris", main: "#000000", variants: ["#000000", "#4A4D66", "#8A8DA6", "#C7C9D9", "#FFFFFF"] },
  { name: "Rouge", main: "#E23B3B", variants: ["#7F1D1D", "#C81D3B", "#E23B3B", "#FF6B6B", "#FF9ED1"] },
  { name: "Orange", main: "#F97316", variants: ["#7C3A12", "#B45309", "#F97316", "#FFB454", "#FFD9A0"] },
  { name: "Jaune", main: "#F5C518", variants: ["#B8860B", "#E0A800", "#F5C518", "#FFE066", "#FFF3B0"] },
  { name: "Vert", main: "#1FA971", variants: ["#14532D", "#3F6B2F", "#1FA971", "#46E0B0", "#8CE99A"] },
  { name: "Cyan", main: "#22B8CF", variants: ["#0E5A66", "#137A8A", "#22B8CF", "#5BE0E6", "#A5F3F7"] },
  { name: "Bleu", main: "#3B82F6", variants: ["#1E3A8A", "#2563EB", "#3B82F6", "#7FB2FF", "#BBD4FF"] },
  { name: "Violet", main: "#7C3AED", variants: ["#4C1D95", "#6D28D9", "#7C3AED", "#A855F7", "#C9A7FF"] },
  { name: "Rose", main: "#FF4D8D", variants: ["#9D174D", "#DB2777", "#FF4D8D", "#FF9ED1", "#FFD1E6"] },
  { name: "Marron", main: "#8B5A2B", variants: ["#4A2E12", "#6B4020", "#8B5A2B", "#B07A45", "#D2A679"] },
  { name: "Blanc", main: "#FFFFFF", variants: ["#FFFFFF"] },
];

/** Host "skip phase" control with a two-click confirmation to avoid misfires. */
export function SkipButton({ onSkip }: { onSkip: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(id);
  }, [armed]);
  return (
    <button
      onClick={() => (armed ? (onSkip(), setArmed(false)) : setArmed(true))}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
        armed ? "border-magenta bg-magenta/10 text-magenta" : "border-ink-border text-text-muted hover:border-gold hover:text-text"
      }`}
    >
      {armed ? "Confirmer ?" : "Passer ›"}
    </button>
  );
}

/** Masked word for guessers. Space-separated sub-words get a wide gap; a hyphen
 *  is shown literally so "casse-noisette" reads with a "-" and "tourne disque"
 *  reads with a clear space. */
export function MaskedWord({ segments, separators }: { segments: string[]; separators?: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center">
          {i > 0 &&
            (separators?.[i - 1] === "-" ? (
              <span className="mx-1 font-mono text-lg text-text-faint">-</span>
            ) : (
              <span className="inline-block w-7 sm:w-10" aria-hidden />
            ))}
          <span className="font-mono text-lg tracking-[0.32em] text-text-muted">{[...seg].join(" ")}</span>
        </span>
      ))}
    </div>
  );
}

function ColorPalette({ color, setColor, locked, noVariants }: { color: string; setColor: (c: string) => void; locked: boolean; noVariants?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const famOf = (c: string) => COLOR_FAMILIES.findIndex((f) => f.variants.some((v) => v.toLowerCase() === c.toLowerCase()));
  const activeFam = famOf(color);
  return (
    <div className="relative flex flex-wrap gap-1.5">
      {open !== null && !noVariants && <div className="fixed inset-0 z-10" onClick={() => setOpen(null)} />}
      {COLOR_FAMILIES.map((fam, i) => {
        const disabled = locked && i !== activeFam;
        const selected = i === activeFam;
        return (
          <div key={fam.name} className="relative">
            <button
              onClick={() => { if (!disabled) setColor(fam.main); }}
              onDoubleClick={() => { if (!disabled && !noVariants) setOpen(open === i ? null : i); }}
              disabled={disabled}
              title={noVariants ? fam.name : `${fam.name} — double-clic pour les nuances`}
              className={`h-7 w-7 rounded-md border transition-transform hover:scale-110 ${selected ? "border-gold ring-2 ring-gold/40" : "border-black/25"} ${disabled ? "opacity-20" : ""}`}
              style={{ backgroundColor: selected ? color : fam.main }}
              aria-label={fam.name}
            />
            {!noVariants && open === i && (
              <div className="absolute left-1/2 top-9 z-20 flex -translate-x-1/2 gap-1 rounded-xl border border-ink-border bg-ink-deep p-1.5 shadow-xl">
                {fam.variants.map((v) => (
                  <button
                    key={v}
                    onClick={() => { setColor(v); setOpen(null); }}
                    title={v}
                    className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 ${v.toLowerCase() === color.toLowerCase() ? "border-gold ring-2 ring-gold/40" : "border-black/30"}`}
                    style={{ backgroundColor: v }}
                    aria-label={v}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function useCountdown(deadline: number | null, serverNow: () => number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (deadline == null) return;
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline == null) return null;
  return Math.max(0, Math.ceil((deadline - serverNow()) / 1000));
}

/** Compte à rebours lisible : discret tant qu'il reste du temps, puis il grossit,
 *  passe au rose et pulse dans les 10 dernières secondes (plus vite sous 5 s) —
 *  pour donner le petit coup de pression de fin de manche sans surcharger. */
function CountdownPill({ secs, accent }: { secs: number | null; accent: string }) {
  if (secs == null) return null;
  const urgent = secs <= 10;
  const critical = secs <= 5;
  return (
    <span
      data-lb-anim={urgent ? "" : undefined}
      style={{
        fontFamily: DISPLAY,
        fontWeight: 800,
        fontSize: urgent ? 16 : 13,
        lineHeight: 1,
        color: urgent ? LB.pink : accent,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: urgent ? 30 : undefined,
        padding: urgent ? "3px 8px" : undefined,
        borderRadius: 9,
        background: urgent ? hexA(LB.pink, 0.12) : undefined,
        boxShadow: urgent ? `inset 0 0 0 1px ${hexA(LB.pink, 0.5)}` : undefined,
        transition: "color .2s ease, font-size .2s ease",
        animation: urgent ? `lbCountdownPulse ${critical ? 0.5 : 0.9}s ease-in-out infinite` : undefined,
      }}
    >
      {secs}s
    </span>
  );
}

type Pt = { x: number; y: number };

const SHIFT_COLORS = ["#111827", "#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2"];

// Pure transform applied to a stroke's points for certain constraints.
// Kept module-level and deterministic-friendly (rng injectable) so it's testable.
export function transformStrokePoints(
  points: { x: number; y: number }[],
  rule: string | null | undefined,
  rng: () => number = Math.random,
): { x: number; y: number }[] {
  if (!rule || points.length === 0) return points;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  if (rule === "jitter") {
    return points.map((p) => ({ x: clamp(p.x + (rng() - 0.5) * 0.02), y: clamp(p.y + (rng() - 0.5) * 0.02) }));
  }
  if (rule === "betray") {
    // Rotate the whole segment around its first point by a small random angle.
    const a = (rng() - 0.5) * 0.5; // ±~14°
    const cos = Math.cos(a), sin = Math.sin(a);
    const o = points[0];
    return points.map((p) => {
      const dx = p.x - o.x, dy = p.y - o.y;
      return { x: clamp(o.x + dx * cos - dy * sin), y: clamp(o.y + dx * sin + dy * cos) };
    });
  }
  if (rule === "elastic") {
    // The further a point is from the start, the more it bows sideways.
    const o = points[0];
    const last = points[points.length - 1];
    const dx = last.x - o.x, dy = last.y - o.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len; // perpendicular unit
    return points.map((p, i) => {
      const t = points.length > 1 ? i / (points.length - 1) : 0;
      const bow = Math.sin(t * Math.PI) * len * 0.4; // max bow at the middle
      return { x: clamp(p.x + nx * bow), y: clamp(p.y + ny * bow) };
    });
  }
  return points;
}

function drawStroke(ctx: CanvasRenderingContext2D, s: DrawStroke) {
  if (!s.points.length) return;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(s.points[0].x * CW, s.points[0].y * CH);
  for (const p of s.points.slice(1)) ctx.lineTo(p.x * CW, p.y * CH);
  if (s.points.length === 1) ctx.lineTo(s.points[0].x * CW + 0.1, s.points[0].y * CH + 0.1);
  ctx.stroke();
}

function shapePoints(tool: Tool, a: Pt, b: Pt): Pt[] {
  if (tool === "line") return [a, b];
  if (tool === "rect") return [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }, a];
  if (tool === "circle") {
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
    const pts: Pt[] = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
    }
    return pts;
  }
  if (tool === "arrow") {
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const h = 0.035;
    const w1 = { x: b.x - h * Math.cos(ang - 0.4), y: b.y - h * Math.sin(ang - 0.4) };
    const w2 = { x: b.x - h * Math.cos(ang + 0.4), y: b.y - h * Math.sin(ang + 0.4) };
    return [a, b, w1, b, w2];
  }
  return [a, b];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function floodFill(ctx: CanvasRenderingContext2D, nx: number, ny: number, hex: string) {
  const sx = Math.max(0, Math.min(CW - 1, Math.round(nx * CW)));
  const sy = Math.max(0, Math.min(CH - 1, Math.round(ny * CH)));
  const img = ctx.getImageData(0, 0, CW, CH);
  const d = img.data;
  const start = sy * CW + sx;
  const s4 = start * 4;
  const tr = d[s4], tg = d[s4 + 1], tb = d[s4 + 2], ta = d[s4 + 3];
  const [fr, fg, fb] = hexToRgb(hex);
  if (tr === fr && tg === fg && tb === fb && ta === 255) return; // already that colour
  const tol = 40;
  const matches = (p: number) => {
    const i = p * 4;
    return (
      Math.abs(d[i] - tr) <= tol && Math.abs(d[i + 1] - tg) <= tol &&
      Math.abs(d[i + 2] - tb) <= tol && Math.abs(d[i + 3] - ta) <= tol
    );
  };
  const paint = (p: number) => {
    const i = p * 4;
    d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255;
  };
  // Scanline flood: fill whole horizontal runs at once and only seed the rows
  // above/below — far fewer stack ops than a per-pixel 4-neighbour BFS.
  const visited = new Uint8Array(CW * CH);
  const stack = [start];
  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p] || !matches(p)) continue;
    const y = (p / CW) | 0;
    const rowStart = y * CW;
    const rowEnd = rowStart + CW - 1;
    let l = p;
    let r = p;
    while (l > rowStart && !visited[l - 1] && matches(l - 1)) l--;
    while (r < rowEnd && !visited[r + 1] && matches(r + 1)) r++;
    for (let q = l; q <= r; q++) {
      visited[q] = 1;
      paint(q);
      if (y > 0) {
        const u = q - CW;
        if (!visited[u] && matches(u)) stack.push(u);
      }
      if (y < CH - 1) {
        const dn = q + CW;
        if (!visited[dn] && matches(dn)) stack.push(dn);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Cursor with a dual-tone ring so it stays visible on ANY colour. */
function CustomCursor({ tool, pos, size, color }: { tool: Tool; pos: Pt; size: number; color: string }) {
  // Dual-tone rings (dark + light) guarantee contrast on ANY background/colour.
  const rings = "0 0 0 1px rgba(0,0,0,0.9), 0 0 0 2px rgba(255,255,255,0.95)";
  if (tool === "brush" || tool === "eraser") {
    const d = Math.max(8, size);
    return (
      <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pos.x, top: pos.y }}>
        <div
          className={`rounded-full ${tool === "eraser" ? "border-2 border-dashed" : ""}`}
          style={{
            width: d,
            height: d,
            boxShadow: rings,
            borderColor: tool === "eraser" ? "rgba(0,0,0,0.55)" : undefined,
            backgroundColor: tool === "brush" ? color : "transparent",
            opacity: tool === "brush" ? 0.35 : 1,
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ boxShadow: "0 0 0 1px #000" }} />
      </div>
    );
  }
  // fill + shapes: a crosshair dot with a guaranteed dual-tone outline (no emoji)
  return (
    <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pos.x, top: pos.y }}>
      <div className="h-3.5 w-3.5 rounded-sm" style={{ boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.95)` }} />
      <div className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ boxShadow: "0 0 0 1px #000" }} />
    </div>
  );
}

export function DrawCanvas({
  room,
  drawable,
  blind,
  constraintRule,
  turnKey,
  authorFilter,
  fit = false,
  ctaSlot,
}: {
  room: UseRoom;
  drawable: boolean;
  blind: boolean;
  constraintRule?: string | null;
  turnKey?: string;
  authorFilter?: string | null; // impostor mode: show only this author's strokes
  fit?: boolean; // true = la toile se cale sur la hauteur dispo (desktop), pas de scroll
  ctaSlot?: ReactNode; // bouton "J'ai fini" injecté à gauche de la barre du bas
}) {
  const mainRef = useRef<HTMLCanvasElement | null>(null);
  const overRef = useRef<HTMLCanvasElement | null>(null);
  const mctx = useRef<CanvasRenderingContext2D | null>(null);
  const octx = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const startPt = useRef<Pt | null>(null);
  const segment = useRef<Pt[]>([]);
  const scaleRef = useRef(1);
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("#000000");
  const [width, setWidth] = useState(8);
  const [cursorPos, setCursorPos] = useState<Pt | null>(null);
  const [traits, setTraits] = useState(0);
  const [colorLocked, setColorLocked] = useState(false);
  const [shaking, setShaking] = useState(false);
  const toolRef = useRef(tool); toolRef.current = tool;
  const colorRef = useRef(color); colorRef.current = color;
  const widthRef = useRef(width); widthRef.current = width;
  const traitsRef = useRef(traits); traitsRef.current = traits;

  // Undo history, grouped per "trait" (a full brush stroke, shape, or fill).
  type DrawOp = { kind: "stroke"; stroke: DrawStroke } | { kind: "fill"; x: number; y: number; color: string };
  const historyRef = useRef<DrawOp[][]>([]);
  const curTraitRef = useRef<DrawOp[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const syncUndo = () => setCanUndo(historyRef.current.length > 0);

  const shapesOnly = constraintRule === "only_shapes";
  const maxStrokes = constraintRule === "max_strokes";
  const oneColor = constraintRule === "one_color";
  const mirror = constraintRule === "mirror";
  const shake = constraintRule === "shake";
  const inverted = constraintRule === "inverted";
  const transformRule = constraintRule === "jitter" || constraintRule === "betray" || constraintRule === "elastic" ? constraintRule : null;
  const sizeShift = constraintRule === "size_shift";
  const colorShift = constraintRule === "color_shift";
  const fog = constraintRule === "fog";
  const shrink = constraintRule === "shrink";
  const ghostCursor = constraintRule === "ghost_cursor";
  const roam = constraintRule === "roam";

  // Turn clock driving the timed drawer-only effects (reset each turn).
  const turnStartRef = useRef(Date.now());
  const [, setFxTick] = useState(0);
  const hasTimedFx = sizeShift || colorShift || fog || shrink || ghostCursor || roam;
  useEffect(() => {
    turnStartRef.current = Date.now();
    setFxTick(0);
    if (!hasTimedFx) return;
    const iv = setInterval(() => setFxTick((t) => t + 1), roam ? 90 : 200);
    return () => clearInterval(iv);
  }, [turnKey, hasTimedFx, roam]);
  const fxElapsed = hasTimedFx ? Date.now() - turnStartRef.current : 0;
  // Taille : change vite (toutes les ~1.6 s) et de façon extrême (tout petit ↔ énorme).
  const sizeFactor = sizeShift ? [0.25, 3, 0.5, 2.2, 0.3][Math.floor(fxElapsed / 1600) % 5] : 1;
  const shiftColor = colorShift ? SHIFT_COLORS[Math.floor(fxElapsed / 5000) % SHIFT_COLORS.length] : null;
  const fogOpacity = fog ? Math.min(0.85, 0.12 + (fxElapsed / 22000) * 0.75) : 0;
  // Rétrécit plus vite : atteint ~40 % en ~35 s.
  const shrinkScale = shrink ? Math.max(0.4, 1 - (fxElapsed / 35000) * 0.6) : 1;
  // Curseur fantôme : totalement invisible en permanence.
  const cursorVisible = !ghostCursor;
  // Toile baladeuse : se déplace vite un peu partout.
  const roamX = roam ? Math.round(Math.sin(fxElapsed / 190) * 26 + Math.sin(fxElapsed / 70) * 10) : 0;
  const roamY = roam ? Math.round(Math.cos(fxElapsed / 150) * 22 + Math.cos(fxElapsed / 90) * 9) : 0;
  const capped = maxStrokes && traits >= MAX_TRAITS;
  const paletteLocked = oneColor && colorLocked;
  const toolAllowed = (id: Tool) => !shapesOnly || id === "line" || id === "circle";

  useEffect(() => {
    const m = mainRef.current, o = overRef.current;
    if (!m || !o) return;
    m.width = CW; m.height = CH; o.width = CW; o.height = CH;
    const mc = m.getContext("2d");
    if (mc) { mc.fillStyle = "#ffffff"; mc.fillRect(0, 0, CW, CH); mctx.current = mc; }
    octx.current = o.getContext("2d");
  }, []);

  // reset constraint counters each new turn; enforce only-shapes tool
  useEffect(() => {
    setTraits(0);
    setColorLocked(false);
    historyRef.current = [];
    curTraitRef.current = [];
    setCanUndo(false);
  }, [turnKey]);
  useEffect(() => {
    if (shapesOnly && !(toolRef.current === "line" || toolRef.current === "circle")) setTool("line");
  }, [shapesOnly, turnKey]);

  const filterRef = useRef<string | null | undefined>(undefined);
  const lastIdRef = useRef(-1);
  const lastResetRef = useRef(0);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const ctx = mctx.current;
      if (ctx) {
        // Left/rejoined a game → wipe and replay from scratch.
        if (room.strokeResetRef.current !== lastResetRef.current) {
          lastResetRef.current = room.strokeResetRef.current;
          lastIdRef.current = -1;
          ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, CW, CH);
        }
        // Switching to another player's canvas (impostor) → rebuild for them.
        if (filterRef.current !== authorFilter) {
          ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, CW, CH);
          lastIdRef.current = -1;
          filterRef.current = authorFilter;
        }
        const evs = room.strokeQueueRef.current;
        for (const e of evs) {
          if (e.id <= lastIdRef.current) continue;
          lastIdRef.current = e.id;
          if (authorFilter != null && e.type !== "clear" && e.from !== authorFilter) continue;
          if (e.type === "clear") {
            if (authorFilter == null || e.from === "*" || e.from === authorFilter) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, CW, CH); }
          } else if (blind) continue;
          else if (e.type === "stroke") drawStroke(ctx, e.stroke);
          else if (e.type === "fill") floodFill(ctx, e.x, e.y, e.color);
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [room, blind, authorFilter]);

  function measure() {
    const r = mainRef.current!.getBoundingClientRect();
    scaleRef.current = r.width / CW;
    return r;
  }
  function norm(e: React.PointerEvent) {
    const r = measure();
    let x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (inverted) x = 1 - x;
    return { x, y };
  }
  function cssPos(e: React.PointerEvent) {
    const r = measure();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  const effColor = () => (toolRef.current === "eraser" ? "#ffffff" : (shiftColor ?? colorRef.current));
  const effWidth = () => {
    const base = toolRef.current === "eraser" ? Math.max(widthRef.current, 18) : widthRef.current;
    return sizeShift ? Math.max(2, Math.round(base * sizeFactor)) : base;
  };

  function commit(points: Pt[]) {
    const pts = transformRule ? transformStrokePoints(points, transformRule) : points;
    const s: DrawStroke = { points: pts, color: effColor(), width: effWidth() };
    if (!blind && mctx.current) drawStroke(mctx.current, s);
    room.sendStroke(s);
    curTraitRef.current.push({ kind: "stroke", stroke: s });
    if (mirror) {
      // Symmetric twin across the vertical centre.
      const m: DrawStroke = { points: pts.map((p) => ({ x: 1 - p.x, y: p.y })), color: s.color, width: s.width };
      if (!blind && mctx.current) drawStroke(mctx.current, m);
      room.sendStroke(m);
      curTraitRef.current.push({ kind: "stroke", stroke: m });
    }
  }
  function flushBrush() {
    if (segment.current.length < 2) return;
    commit(segment.current);
    segment.current = [segment.current[segment.current.length - 1]];
  }
  function clearOverlay() {
    if (octx.current) octx.current.clearRect(0, 0, CW, CH);
  }
  function preview(a: Pt, b: Pt) {
    const o = octx.current;
    if (!o) return;
    clearOverlay();
    const pts = shapePoints(toolRef.current, a, b);
    o.strokeStyle = effColor() === "#ffffff" ? "#999999" : effColor();
    o.lineWidth = effWidth();
    o.lineCap = "round"; o.lineJoin = "round";
    o.beginPath();
    o.moveTo(pts[0].x * CW, pts[0].y * CH);
    for (const p of pts.slice(1)) o.lineTo(p.x * CW, p.y * CH);
    o.stroke();
  }
  function afterTrait() {
    setTraits((t) => t + 1);
    if (oneColor) setColorLocked(true);
  }

  function finalizeStroke(e: React.PointerEvent) {
    if (shake) setShaking(false);
    if (drawing.current) {
      const t = toolRef.current;
      if (t === "brush" || t === "eraser") flushBrush();
      else if (startPt.current) { commit(shapePoints(t, startPt.current, norm(e))); clearOverlay(); }
      if (curTraitRef.current.length) { historyRef.current.push(curTraitRef.current); curTraitRef.current = []; syncUndo(); }
      afterTrait();
    }
    drawing.current = false;
    segment.current = [];
    startPt.current = null;
  }

  /** Undo the last trait: clear everyone, then replay the remaining traits so
   *  all clients (via the shared stroke log) rebuild the same picture. */
  function undo() {
    if (!historyRef.current.length) return;
    historyRef.current.pop();
    room.clearCanvas();
    for (const trait of historyRef.current) {
      for (const op of trait) {
        if (op.kind === "stroke") room.sendStroke(op.stroke);
        else room.sendFill(op.x, op.y, op.color);
      }
    }
    setTraits(historyRef.current.length);
    if (oneColor && historyRef.current.length === 0) setColorLocked(false);
    syncUndo();
  }

  const handlers = drawable
    ? {
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => {
          e.preventDefault();
          // Draw with the normal (left) button; ignore secondary/middle buttons.
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if (maxStrokes && traitsRef.current >= MAX_TRAITS) return; // trait limit reached
          const t = toolRef.current;
          if (t === "fill") {
            if (shapesOnly) return;
            const n = norm(e);
            if (!blind && mctx.current) floodFill(mctx.current, n.x, n.y, colorRef.current);
            room.sendFill(n.x, n.y, colorRef.current);
            historyRef.current.push([{ kind: "fill", x: n.x, y: n.y, color: colorRef.current }]);
            if (mirror) {
              const mx = 1 - n.x;
              if (!blind && mctx.current) floodFill(mctx.current, mx, n.y, colorRef.current);
              room.sendFill(mx, n.y, colorRef.current);
            }
            syncUndo();
            afterTrait();
            return;
          }
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drawing.current = true;
          if (shake) setShaking(true);
          curTraitRef.current = [];
          startPt.current = norm(e);
          if (t === "brush" || t === "eraser") segment.current = [startPt.current];
        },
        onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => {
          setCursorPos(e.pointerType === "touch" ? null : cssPos(e));
          if (!drawing.current) return;
          // If the (left) mouse button was released without a pointerup, stop.
          if (e.pointerType === "mouse" && (e.buttons & 1) === 0) { finalizeStroke(e); return; }
          const n = norm(e);
          const t = toolRef.current;
          if (t === "brush" || t === "eraser") {
            segment.current.push(n);
            if (segment.current.length >= 4) flushBrush();
          } else if (startPt.current) {
            preview(startPt.current, n);
          }
        },
        onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => {
          if (e.pointerType === "mouse" && e.button !== 0) return; // ignore non-left releases
          finalizeStroke(e);
        },
        onPointerLeave: () => setCursorPos(null),
      }
    : { onContextMenu: (e: React.MouseEvent) => e.preventDefault() };

  return (
    <div className={fit ? "dc-fit" : undefined} style={fit ? { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } : undefined}>
      {drawable && constraintRule && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-magenta/30 bg-magenta/[0.06] px-3 py-1.5 text-xs text-magenta">
          <span className="font-semibold">Contrainte active :</span>
          {oneColor && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Une seule couleur{colorLocked ? " · verrouillée" : ""}</span>}
          {maxStrokes && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Traits {traits}/{MAX_TRAITS}</span>}
          {shapesOnly && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Lignes &amp; ronds uniquement</span>}
          {mirror && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Effet miroir 🪞</span>}
          {shake && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Ça tremble ! 🫨</span>}
          {inverted && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Curseur inversé 🔄</span>}
          {transformRule === "jitter" && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Le trait tremble 〰️</span>}
          {transformRule === "betray" && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Pinceau traître 😈</span>}
          {transformRule === "elastic" && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Pinceau élastique 🪢</span>}
          {sizeShift && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Taille qui change 📏</span>}
          {colorShift && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Couleur qui change 🌈</span>}
          {fog && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Brouillard 🌫️</span>}
          {shrink && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Toile qui rétrécit 🔻</span>}
          {ghostCursor && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Curseur fantôme 👻</span>}
          {roam && <span className="rounded border border-magenta/30 px-1.5 py-0.5">Toile baladeuse 🏃</span>}
        </div>
      )}

      <div className="dc-row flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {/* Barre d'outils neon — 9 boutons PNG borderless, actif = double anneau doré */}
        {drawable && (
          <div className="dc-tools order-2 flex shrink-0 flex-wrap gap-1.5 sm:order-1 sm:flex-col sm:flex-nowrap">
            {TOOLS.filter((t) => toolAllowed(t.id)).map((t) => (
              <button key={t.id} onClick={() => setTool(t.id)} title={t.label} aria-label={t.label} className="dc-toolbtn" style={toolBtnStyle(tool === t.id)}>
                <ToolGlyph id={t.id} />
              </button>
            ))}
            <button onClick={undo} disabled={!canUndo} title="Annuler le dernier trait" aria-label="Annuler le dernier trait" className="dc-toolbtn" style={{ ...toolBtnStyle(false), opacity: canUndo ? 1 : 0.3, cursor: canUndo ? "pointer" : "default", marginTop: 4 }}>
              <ToolGlyph id="undo" />
            </button>
            <button onClick={() => { historyRef.current = []; curTraitRef.current = []; setCanUndo(false); setColorLocked(false); setTraits(0); room.clearCanvas(); }} title="Tout effacer" aria-label="Tout effacer" className="dc-toolbtn" style={toolBtnStyle(false)}>
              <ToolGlyph id="clear" />
            </button>
          </div>
        )}

        {/* La toile prend le reste */}
        <div className="dc-col order-1 min-w-0 flex-1 sm:order-2">
          <div className="dc-wrap">
            <div className={`dc-box relative w-full select-none overflow-hidden rounded-2xl${shake && shaking ? " animate-canvasshake" : ""}`} style={{ aspectRatio: "3 / 2", boxShadow: `inset 0 0 0 1px ${LB.line}`, transform: (roam || shrink) ? `translate(${roamX}px, ${roamY}px) scale(${shrinkScale})` : undefined, transformOrigin: "center", transition: roam ? "transform .09s linear" : "transform .2s linear" }}>
              <canvas ref={mainRef} {...handlers} className="absolute inset-0 h-full w-full touch-none" style={{ background: "#EDEAF6", cursor: drawable ? "none" : "default" }} />
              <canvas ref={overRef} className="pointer-events-none absolute inset-0 h-full w-full" />
              {fog && <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(160deg, #eef1f6, #cfd6e3)", opacity: fogOpacity, transition: "opacity .3s linear" }} />}
              {drawable && cursorVisible && cursorPos && <CustomCursor tool={tool} pos={cursorPos} size={width * scaleRef.current} color={color} />}
            </div>
          </div>
        </div>
      </div>

      {/* Barre du bas : CTA « J'ai fini » + palette + tailles (pleine largeur) */}
      {drawable && (
        <div className="dc-bottombar" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 18, padding: "14px 2px 2px" }}>
          {ctaSlot}
          {ctaSlot && <span style={{ width: 1, height: 32, background: LB.line, flex: "none" }} />}
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <ColorPalette color={color} setColor={setColor} locked={paletteLocked} noVariants={oneColor} />
          </div>
          <span style={{ width: 1, height: 32, background: LB.line, flex: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>Taille</span>
            {[4, 8, 16, 28].map((w, i) => {
              const dot = [4, 6, 10, 16][i];
              const on = width === w;
              return (
                <button key={w} onClick={() => setWidth(w)} aria-label={`Épaisseur ${w}`} style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 10, border: "none", background: on ? hexA(LB.gold, 0.14) : "transparent", boxShadow: on ? `inset 0 0 0 1px ${LB.gold}` : `inset 0 0 0 1px ${LB.line}`, cursor: "pointer" }}>
                  <span style={{ borderRadius: 99, background: on ? LB.gold : LB.text, width: dot, height: dot }} />
                </button>
              );
            })}
          </div>
          {capped && <span style={{ fontSize: 12, color: LB.pink, width: "100%" }}>Limite de traits atteinte — « Tout effacer » pour recommencer.</span>}
        </div>
      )}
    </div>
  );
}

/** §4 — the answer bar, placed directly under the canvas. */
export function GuessBar({ room }: { room: UseRoom }) {
  const [text, setText] = useState("");
  const [wrong, setWrong] = useState(false);
  const lastId = useRef(-1);
  useEffect(() => {
    for (const m of room.chat) {
      if (m.id <= lastId.current) continue;
      if (m.from === room.you && m.kind === "guess") {
        setWrong(true);
        window.setTimeout(() => setWrong(false), 450);
      }
    }
    if (room.chat.length) lastId.current = Math.max(lastId.current, room.chat[room.chat.length - 1].id);
  }, [room.chat, room.you]);
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    room.guess(t);
    setText("");
  };
  return (
    <div className="mt-3">
      <p className="eyebrow mb-1 text-gold">Ta réponse</p>
      <div className={`flex gap-2 ${wrong ? "animate-shake" : ""}`}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Tape le mot que tu devines…"
          maxLength={40}
          autoFocus
          className={`flex-1 rounded-xl border bg-ink-deep px-4 py-3 text-base outline-none transition-colors ${wrong ? "border-magenta" : "border-gold/40 focus:border-gold"}`}
        />
        <button onClick={submit} className="rounded-xl bg-gold px-5 font-display font-bold text-ink-deep transition-transform active:scale-95">
          Go
        </button>
      </div>
    </div>
  );
}

export function ChatPanel({ room }: { room: UseRoom }) {
  const [talkText, setTalkText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [room.chat.length]);
  const submitTalk = () => {
    const t = talkText.trim();
    if (!t) return;
    room.sendTalk(t);
    setTalkText("");
  };
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={listRef}
        className="mb-2 min-h-[8rem] min-w-0 flex-1 space-y-1.5 overflow-y-auto break-words rounded-xl border border-ink-border bg-ink-surface p-3.5 text-sm leading-relaxed"
      >
        {room.chat.length === 0 && <p className="text-text-faint">Discussion et propositions apparaissent ici. Écris ta réponse sous le dessin, discute ici.</p>}
        {room.chat.map((m) => {
          if (m.kind === "correct")
            return (
              <p key={m.id} className="font-semibold text-mint">
                ✓ <span className="text-text">{m.name}</span> {m.text}
              </p>
            );
          if (m.kind === "talk")
            return (
              <p key={m.id} className="text-text-muted">
                <span className="font-semibold text-text">{m.name}</span> : {m.text}
              </p>
            );
          if (m.kind === "guess")
            return (
              <p key={m.id} className="text-text-faint">
                🔤 <span className="font-medium">{m.name}</span> : <span className="italic">{m.text}</span>
              </p>
            );
          return (
            <p key={m.id} className="text-center text-text-faint">
              {m.text}
            </p>
          );
        })}
      </div>
      <div className="flex min-w-0 gap-2">
        <input
          value={talkText}
          onChange={(e) => setTalkText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitTalk()}
          placeholder="💬 Discuter…"
          maxLength={140}
          className="min-w-0 flex-1 rounded-xl border border-ink-border bg-ink-deep px-3 py-2.5 text-sm text-text-muted outline-none transition-colors focus:border-text-faint"
        />
        <button onClick={submitTalk} className="shrink-0 rounded-xl border border-ink-border px-3 text-sm text-text-muted transition-colors hover:text-text">
          Envoyer
        </button>
      </div>
    </div>
  );
}

function BlindReveal({ room }: { room: UseRoom }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CW, CH);
    const evs = room.strokeQueueRef.current;
    // Replay only the current turn: everything after the last full clear.
    let start = 0;
    for (let i = evs.length - 1; i >= 0; i--) {
      if (evs[i].type === "clear" && (evs[i] as { from?: string }).from === "*") { start = i + 1; break; }
    }
    for (let i = start; i < evs.length; i++) {
      const e = evs[i];
      if (e.type === "stroke") drawStroke(ctx, e.stroke);
      else if (e.type === "fill") floodFill(ctx, e.x, e.y, e.color);
    }
  }, [room]);
  const download = () => {
    const c = ref.current;
    if (!c) return;
    c.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mon-dessin-aveugle.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  return (
    <div className="mx-auto mt-6 max-w-md">
      <p className="eyebrow mb-2 text-cyan-300">Ton chef-d&apos;œuvre à l&apos;aveugle 👀</p>
      <div className="overflow-hidden rounded-xl border border-ink-border bg-white">
        <canvas ref={ref} width={CW} height={CH} className="block w-full" style={{ aspectRatio: `${CW} / ${CH}` }} />
      </div>
      <button onClick={download} className="arc arc-sec arc-block mt-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
        Télécharger mon dessin
      </button>
    </div>
  );
}

// ── Anneau de chrono autour d'un avatar carré (spec socle) ──────────────────
function AvatarRing({ name, color, avatar, size = 40, ring = LB.gold, p = 1 }: { name: string; color: string; avatar?: string | null; size?: number; ring?: string; p?: number }) {
  const sw = 3, r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.max(0, Math.min(1, p)));
  return (
    <span style={{ position: "relative", width: size, height: size, flex: "none", display: "inline-grid", placeItems: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={LB.lineFaint} strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring} strokeWidth={sw} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} />
      </svg>
      <Avatar name={name} color={color} avatar={avatar} size={size - 10} />
    </span>
  );
}

// ── Gabarit du mot pour les devineurs : un underscore par lettre, .34em mint ─
function WordStencil({ segments, separators, color = LB.mint }: { segments: string[]; separators?: string[]; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap" }}>
      {segments.map((seg, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
          {i > 0 && (separators?.[i - 1] === "-"
            ? <span style={{ margin: "0 6px", fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, color: LB.faint }}>-</span>
            : <span style={{ width: 22 }} aria-hidden />)}
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, letterSpacing: ".34em", color, lineHeight: 1 }}>{[...seg].join(" ")}</span>
        </span>
      ))}
    </span>
  );
}

// ── Plaque de saisie « Proposer » (gros texte + caret + CTA doré) ───────────
function GuessPlate({ room }: { room: UseRoom }) {
  const [text, setText] = useState("");
  const [wrong, setWrong] = useState(false);
  const lastId = useRef(-1);
  useEffect(() => {
    for (const m of room.chat) {
      if (m.id <= lastId.current) continue;
      if (m.from === room.you && m.kind === "guess") { setWrong(true); window.setTimeout(() => setWrong(false), 450); }
    }
    if (room.chat.length) lastId.current = Math.max(lastId.current, room.chat[room.chat.length - 1].id);
  }, [room.chat, room.you]);
  const submit = () => { const t = text.trim(); if (!t) return; room.guess(t); setText(""); };
  return (
    <div className={wrong ? "animate-shake" : ""} style={{ display: "flex", alignItems: "stretch", gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", padding: "16px 22px", borderRadius: 18, background: LB.bg, boxShadow: `0 0 0 2px ${hexA(wrong ? LB.pink : LB.gold, 0.5)}, inset 0 1px 0 rgba(243,238,255,.04)` }}>
        <input
          className="lb-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Tape le mot que tu devines…"
          maxLength={40}
          autoFocus
          autoComplete="off"
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: LB.text, fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, letterSpacing: "-.01em", lineHeight: 1.15, caretColor: LB.gold }}
        />
      </div>
      <button onClick={submit} className="lb-gold" style={{ ...lbGoldBtn, alignSelf: "stretch", padding: "0 30px" }}>Proposer</button>
    </div>
  );
}

// ── Rejoue le dessin du tour (toutes les traces depuis le dernier clear) ────
function TurnDrawing({ room, style }: { room: UseRoom; style?: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#EDEAF6"; ctx.fillRect(0, 0, CW, CH);
    const evs = room.strokeQueueRef.current;
    let start = 0;
    for (let i = evs.length - 1; i >= 0; i--) { const e = evs[i] as { type: string; from?: string }; if (e.type === "clear" && (e.from === "*" || e.from == null)) { start = i + 1; break; } }
    for (let i = start; i < evs.length; i++) { const e = evs[i]; if (e.type === "stroke") drawStroke(ctx, e.stroke); else if (e.type === "fill") floodFill(ctx, e.x, e.y, e.color); }
  }, [room]);
  return <canvas ref={ref} width={CW} height={CH} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", ...style }} />;
}

// ── Rail du mode Dessin (joueurs + chat optionnel dans le rail) ─────────────
function DrawRail({ kicker, heading, sub, rows, chat, pops }: { kicker: string; heading: string; sub: string; rows: RailRow[]; chat?: ReactNode; pops?: Record<string, { id: number; text: string }> }) {
  return (
    <aside className="lb-rail" style={{ position: "relative", width: chat ? 264 : 296, flex: "none", zIndex: 1, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16, padding: "24px 20px", background: LB.aside, borderRight: `1px solid ${LB.line}`, minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "none" }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>{kicker}</span>
        <span style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.1 }}>{heading}</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: LB.faint }}>{sub}</span>
      </div>
      <div style={{ height: 1, flex: "none", background: "linear-gradient(90deg,transparent,rgba(243,238,255,.14) 18%,rgba(243,238,255,.14) 82%,transparent)" }} />
      <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => {
          const ac = r.accent;
          return (
            <div key={r.id} style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: ac ? "12px 14px 12px 16px" : "12px 14px", borderRadius: 14, background: ac ? hexA(ac, 0.1) : "transparent", boxShadow: ac ? `0 0 0 1px ${hexA(ac, 0.55)}, 0 0 26px -12px ${hexA(ac, 0.9)}` : `0 0 0 1px ${LB.line}` }}>
              {ac && <span style={{ position: "absolute", left: 0, top: 13, bottom: 13, width: 3, borderRadius: 3, background: ac }} />}
              {r.rank != null && <span style={{ flex: "none", width: 14, fontFamily: DISPLAY, fontWeight: 700, fontSize: 12, color: r.rank === 1 ? LB.gold : LB.faint }}>{r.rank}</span>}
              <Avatar name={r.name} color={r.color} avatar={r.avatar} size={34} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}{r.you && <span style={{ color: LB.faint, fontWeight: 400 }}> · toi</span>}</span>
                {r.meta && <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, color: r.meta.color }}>{r.meta.text}</span>}
              </span>
              {r.badge && <span style={{ flex: "none", marginLeft: 6, whiteSpace: "nowrap", fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: r.badge.color }}>{r.badge.text}</span>}
              {r.score && <span style={{ flex: "none", fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: r.rank === 1 ? LB.gold : LB.muted }}>{r.score}</span>}
              {pops?.[r.id] && (
                <span key={pops[r.id].id} data-lb-anim="" style={{ position: "absolute", right: 14, top: -2, fontFamily: DISPLAY, fontWeight: 800, fontSize: 14, color: LB.mint, textShadow: `0 2px 10px ${hexA(LB.mint, 0.8)}`, animation: "lbScorePop 1.3s ease-out forwards", pointerEvents: "none" }}>{pops[r.id].text}</span>
              )}
            </div>
          );
        })}
      </div>
      {chat && (
        <>
          <span style={{ flex: "none", fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint, marginTop: 2 }}>Discussion</span>
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>{chat}</div>
        </>
      )}
    </aside>
  );
}

// ── Feedback d'événements (Étape 2) ────────────────────────────────────────
// Rend perceptible AUSSITÔT, pour tout le monde, les moments clés de la manche :
// « 🟢 X a trouvé ! +72 », dessinateur qui termine, joueur qui rejoint. Le son
// est déjà géré par useGameSounds ; ici on ajoute uniquement le visuel, à partir
// de l'état déjà diffusé (scores, guessedIds) — aucune nouvelle plomberie.
type DrawToast = { id: number; icon: string; title: string; points: string | null; accent: string; mine: boolean };
type ScorePop = { id: number; text: string };

function useDrawFeedback(
  game: DrawPublic,
  nameOf: (id: string) => string,
  you: string,
  turnKey: string,
): { toasts: DrawToast[]; pops: Record<string, ScorePop> } {
  const [toasts, setToasts] = useState<DrawToast[]>([]);
  const [pops, setPops] = useState<Record<string, ScorePop>>({});
  const scores = useRef<Record<string, number>>({});
  const announced = useRef<Set<string>>(new Set());
  const finishedRef = useRef(false);
  const countRef = useRef(game.players.length);
  const seeded = useRef(false);
  const idRef = useRef(1);

  // Nouveau tour → on ré-arme les annonces (les mêmes joueurs peuvent re-trouver).
  useEffect(() => {
    announced.current = new Set();
    finishedRef.current = false;
  }, [turnKey]);

  useEffect(() => {
    // Premier passage (ou reconnexion) : on prend l'état comme référence, sans
    // rejouer l'historique.
    if (!seeded.current) {
      for (const p of game.players) scores.current[p.id] = game.scores[p.id] ?? 0;
      announced.current = new Set(game.guessedIds);
      finishedRef.current = !!game.finished;
      countRef.current = game.players.length;
      seeded.current = true;
      return;
    }

    const newToasts: DrawToast[] = [];
    const newPops: Record<string, ScorePop> = {};

    // Toute hausse de score → petit « +N » sur la ligne du joueur (devineurs ET
    // dessinateur qui gagne des points à chaque bonne réponse).
    for (const p of game.players) {
      const gained = (game.scores[p.id] ?? 0) - (scores.current[p.id] ?? 0);
      if (gained > 0) newPops[p.id] = { id: idRef.current++, text: `+${gained}` };
    }

    // Nouveau devineur qui trouve → toast « 🟢 X a trouvé ! +N ».
    if (game.phase === "drawing" || game.phase === "reveal") {
      for (const id of game.foundOrder) {
        if (id === game.drawerId || announced.current.has(id)) continue;
        announced.current.add(id);
        const gained = (game.scores[id] ?? 0) - (scores.current[id] ?? 0);
        const mine = id === you;
        newToasts.push({
          id: idRef.current++,
          icon: "🟢",
          title: mine ? "Bien joué, trouvé !" : `${nameOf(id)} a trouvé !`,
          points: gained > 0 ? `+${gained}` : null,
          accent: LB.mint,
          mine,
        });
      }
    }

    // Le dessinateur annonce son dessin terminé.
    if (game.finished && !finishedRef.current) {
      finishedRef.current = true;
      if (game.drawerId) {
        newToasts.push({ id: idRef.current++, icon: "✏️", title: `${nameOf(game.drawerId)} a terminé son dessin`, points: null, accent: LB.gold, mine: game.drawerId === you });
      }
    }

    // Un joueur rejoint la partie.
    if (game.players.length > countRef.current) {
      const newcomer = game.players[game.players.length - 1];
      if (newcomer) newToasts.push({ id: idRef.current++, icon: "👋", title: `${newcomer.name} a rejoint`, points: null, accent: LB.violet, mine: newcomer.id === you });
    }

    // On enregistre la nouvelle référence de scores + effectif.
    scores.current = {};
    for (const p of game.players) scores.current[p.id] = game.scores[p.id] ?? 0;
    countRef.current = game.players.length;

    if (newToasts.length) {
      setToasts((ts) => [...ts, ...newToasts].slice(-4));
      for (const t of newToasts) {
        const tid = t.id;
        setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== tid)), 2800);
      }
    }
    if (Object.keys(newPops).length) {
      setPops((prev) => ({ ...prev, ...newPops }));
      for (const [pid, pop] of Object.entries(newPops)) {
        const popId = pop.id;
        setTimeout(
          () => setPops((prev) => (prev[pid]?.id === popId ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== pid)) : prev)),
          1300,
        );
      }
    }
  }, [game, nameOf, you]);

  return { toasts, pops };
}

/** Bandeau d'événements, en haut de la scène, non bloquant (pointer-events off). */
function EventToasts({ toasts }: { toasts: DrawToast[] }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: "absolute", top: 14, left: 0, right: 0, zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          data-lb-anim=""
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "9px 16px 9px 13px", borderRadius: 999,
            background: "rgba(20,16,42,.92)",
            boxShadow: `0 0 0 1px ${hexA(t.accent, 0.55)}, 0 10px 30px -12px ${hexA(t.accent, 0.9)}`,
            animation: "lbToastIn .22s ease-out",
            maxWidth: "90%",
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>{t.icon}</span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: t.mine ? t.accent : LB.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
          {t.points && (
            <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, color: t.accent, background: hexA(t.accent, 0.14), boxShadow: `inset 0 0 0 1px ${hexA(t.accent, 0.5)}`, borderRadius: 8, padding: "2px 9px", lineHeight: 1 }}>{t.points}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function DrawGameView({ room }: { room: UseRoom }) {
  const game = room.game as DrawPublic;
  const you = room.you;
  const isHost = room.state?.hostId === you;
  const byId = new Map(game.players.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const color = (id: string) => byId.get(id)?.color ?? "#888";
  const avatarOf = (id: string) => byId.get(id)?.avatar;
  const secs = useCountdown(game.deadline, room.serverNow);
  const drawerName = game.drawerId ? name(game.drawerId) : "";
  const turnKey = `${game.round}-${game.turnInRound}-${game.drawerId ?? ""}`;
  const { toasts, pops } = useDrawFeedback(game, name, you, turnKey);
  const isCoop = game.mode === "coop";
  const teamScore = Object.values(game.scores).reduce((a, b) => a + b, 0);
  const revealResult = game.result;
  const foundIdx = (id: string) => game.foundOrder.indexOf(id);

  // Fraction de temps restant (anneau + barre de tour).
  const totalMs = game.phase === "choosing" ? (game.config?.chooseMs ?? 0) : (game.config?.drawMs ?? 0);
  const remaining = game.deadline != null ? Math.max(0, game.deadline - room.serverNow()) : 0;
  const pRemain = totalMs > 0 ? Math.max(0, Math.min(1, remaining / totalMs)) : 0;

  // ══════════════════ FINAL — classement (7e) ══════════════════
  if (game.phase === "scoreboard") {
    const ranked = [...game.players].sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0));
    const winner = ranked[0];
    const finalRows: RailRow[] = ranked.map((p, i) => ({
      id: p.id, name: p.name, color: p.color, avatar: p.avatar, you: p.id === you,
      rank: i + 1, accent: i === 0 ? LB.gold : p.id === you ? LB.violet : undefined,
      score: (game.scores[p.id] ?? 0).toLocaleString("fr-FR"),
    }));
    return (
      <main style={lbShell} className="lb-scope">
        <style dangerouslySetInnerHTML={{ __html: LB_SCOPED_CSS }} />
        <div style={lbCard}>
          <Aurora tint="rgba(255,194,75,.14)" tint2="rgba(139,125,246,.10)" />
          <DrawRail kicker="Classement" heading={isCoop ? "Bravo l'équipe !" : "Partie terminée"} sub={`${game.totalRounds} manches`} rows={finalRows} />
          <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={topBar(LB.gold)} />
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 44, padding: 34, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: LB.faint }}>
                  <img src="/tools/palette.png" alt="" width={22} height={22} style={{ display: "block" }} />
                  {isCoop ? "Score collectif" : "Meilleur crayon"}
                </span>
                <span style={{ boxShadow: `0 0 60px -18px ${hexA(LB.gold, 1)}`, borderRadius: 22, width: 92, height: 92 }}>
                  <Avatar name={winner?.name ?? "?"} color={winner?.color ?? LB.violet} avatar={winner?.avatar} size={92} />
                </span>
                <span style={{ fontFamily: DISPLAY, fontSize: 54, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1 }}>{isCoop ? "" : winner?.name ?? "—"}</span>
                <span style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 800, color: LB.gold }}>{(isCoop ? teamScore : (game.scores[winner?.id ?? ""] ?? 0)).toLocaleString("fr-FR")} points</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "0 34px 30px" }}>
              {isHost ? (
                <>
                  <button onClick={() => room.returnLobby()} className="lb-ghost" style={lbGhostBtn}>Salon</button>
                  <button onClick={() => room.playAgain()} className="lb-gold" style={lbGoldBtn}>Rejouer</button>
                </>
              ) : (
                <span style={{ fontSize: 14, color: LB.muted }}>En attente de l'hôte…</span>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ══════════════════ Rail (joueurs, + chat en DRAWING/GUESSING) ══════════════
  const withChat = game.phase === "drawing";
  const railRows: RailRow[] = [...game.players]
    .sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0))
    .map((p) => {
      const isYou = p.id === you;
      const isDrawer = p.id === game.drawerId;
      const found = game.phase === "reveal" ? revealResult?.guesserIds.includes(p.id) : game.guessedIds.includes(p.id);
      const fi = foundIdx(p.id);
      const row: RailRow = {
        id: p.id, name: p.name, color: p.color, avatar: p.avatar, you: isYou,
        accent: isDrawer ? LB.gold : found ? LB.mint : isYou ? LB.violet : undefined,
        score: (game.scores[p.id] ?? 0).toLocaleString("fr-FR"),
      };
      if (game.phase === "reveal") {
        row.badge = isDrawer ? { text: "dessinateur", color: LB.gold } : found ? { text: fi >= 0 ? `${fi + 1}ᵉ` : "trouvé", color: LB.mint } : { text: "0", color: LB.pink };
      } else {
        row.badge = isDrawer ? { text: "dessine", color: LB.gold } : found ? { text: "a trouvé", color: LB.mint } : undefined;
      }
      return row;
    });
  const foundCount = game.foundOrder.length;
  const railHeading = game.phase === "choosing" ? `Manche ${game.round} / ${game.totalRounds}`
    : game.phase === "reveal" ? "Tour terminé"
    : game.youAreDrawer ? (game.word ?? "On dessine") : `${drawerName} dessine`;
  const railSub = game.phase === "choosing" ? `tour ${game.turnInRound + 1} sur ${game.players.length}`
    : game.phase === "reveal" ? "points du tour"
    : `${foundCount} sur ${Math.max(0, game.players.length - 1)} ont trouvé`;

  // Devineur ? (phase drawing mais pas le dessinateur = GUESSING, tout en mint)
  const guessing = game.phase === "drawing" && !game.youAreDrawer;
  const accent = guessing || game.phase === "reveal" ? LB.mint : LB.gold;
  const P = game.phase === "reveal" ? 95 : Math.max(5, Math.min(95, Math.round((1 - pRemain) * 100)));
  const letters = game.wordSegments.reduce((n, s) => n + s.length, 0);

  // Propositions récentes (bandeau GUESSING).
  const proposals = room.chat.filter((m) => m.kind === "guess" || m.kind === "correct").slice(-4);

  const rail = (
    <DrawRail kicker={`Boum Dessin · manche ${game.round}/${game.totalRounds}`} heading={railHeading} sub={railSub} rows={railRows}
      chat={withChat ? <ChatPanel room={room} /> : undefined} pops={pops} />
  );

  const soundBtn = <SoundToggle />;
  const skipBtn = isHost ? <SkipButton onSkip={room.skipPhase} /> : null;

  return (
    <main style={lbShell} className="lb-scope">
      <style dangerouslySetInnerHTML={{ __html: LB_SCOPED_CSS }} />
      <div style={lbCard}>
        <Aurora tint={accent === LB.mint ? "rgba(70,224,176,.12)" : "rgba(255,194,75,.10)"} tint2="rgba(139,125,246,.12)" />
        {rail}

        <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={topBar(accent, P)} />
          <EventToasts toasts={toasts} />

          {/* ═══ CHOOSING (7a) ═══ */}
          {game.phase === "choosing" && (
            <div className="dv-stage" style={{ padding: "16px 32px 28px" }}>
              <div className="dv-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  <AvatarRing name={drawerName} color={color(game.drawerId ?? "")} avatar={avatarOf(game.drawerId ?? "")} size={48} ring={LB.gold} p={pRemain} />
                  <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 700 }}>{game.youAreDrawer ? "À toi de dessiner" : `${drawerName} choisit un mot`}</span>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.gold }}>{secs != null ? `${secs}s pour choisir` : "choix du mot"}</span>
                  </span>
                </div>
                {soundBtn}
              </div>
              {game.youAreDrawer ? (
                <div className="dv-choicecards" style={{ flex: 1, display: "flex", alignItems: "center", gap: 18, padding: "20px 0" }}>
                  {(game.wordChoices ?? []).map((w) => (
                    <button key={w} onClick={() => room.chooseWord(w)} className="lb-card3d" style={{ flex: "1 1 0", minWidth: 0, textAlign: "left", border: "none", borderRadius: 20, padding: "34px 28px", background: LB.raised, cursor: "pointer", boxShadow: `0 0 0 1px ${LB.line}, 0 6px 0 ${LB.lineFaint}` }}>
                      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: w.length > 12 ? 26 : 34, lineHeight: 1, color: LB.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{w}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
                  <p style={{ color: LB.muted, fontSize: 16 }}><span style={{ fontWeight: 700, color: LB.text }}>{drawerName}</span> choisit un mot…</p>
                </div>
              )}
            </div>
          )}

          {/* ═══ DRAWING — dessinateur (7b) ═══ */}
          {game.phase === "drawing" && game.youAreDrawer && (
            <div className="dv-stage" style={{ padding: "14px 26px 16px" }}>
              <div className="dv-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  <AvatarRing name={name(you)} color={color(you)} avatar={avatarOf(you)} size={40} ring={LB.gold} p={pRemain} />
                  <span className="dv-word" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: ".02em" }}>{game.word}</span>
                  <CountdownPill secs={secs} accent={LB.gold} />
                  {game.constraint && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "5px 10px", background: hexA(LB.pink, 0.12), boxShadow: `inset 0 0 0 1px ${hexA(LB.pink, 0.4)}`, fontSize: 12, fontWeight: 600, color: LB.pink }}>{game.constraint}</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {!game.themeRevealed
                    ? <button onClick={() => room.revealTheme()} className="lb-ghost" style={{ border: `1px solid ${LB.line}`, background: "transparent", color: LB.muted, fontFamily: MONO, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", padding: "10px 16px", borderRadius: 10, cursor: "pointer" }}>Révéler le thème</button>
                    : <span style={{ fontSize: 12, color: LB.faint }}>Thème révélé ✓</span>}
                  {soundBtn}{skipBtn}
                </div>
              </div>
              <div className="dv-canvasfill">
                <DrawCanvas
                  room={room} drawable blind={game.mode === "blind"} constraintRule={game.constraintRule} turnKey={turnKey} fit
                  ctaSlot={game.finished
                    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 12, padding: "12px 18px", fontFamily: DISPLAY, fontWeight: 700, fontSize: 14, color: LB.mint, background: hexA(LB.mint, 0.12), boxShadow: `inset 0 0 0 1px ${hexA(LB.mint, 0.45)}`, flex: "none" }}>Dessin terminé ✓</span>
                    : <button onClick={() => room.endDrawing()} className="lb-gold" style={{ ...lbGoldBtn, flex: "none" }}>J'ai fini</button>}
                />
              </div>
              {game.mode === "blind" && <p style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: LB.muted }}>Mode aveugle : tu ne vois pas ton trait 👀</p>}
            </div>
          )}

          {/* ═══ GUESSING — je devine (7c) ═══ */}
          {game.phase === "drawing" && !game.youAreDrawer && (
            <div className="dv-stage" style={{ padding: "14px 26px 16px" }}>
              <div className="dv-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flexWrap: "wrap" }}>
                  <AvatarRing name={drawerName} color={color(game.drawerId ?? "")} avatar={avatarOf(game.drawerId ?? "")} size={40} ring={LB.mint} p={pRemain} />
                  <span className="dv-stencil"><WordStencil segments={game.wordSegments} separators={game.wordSeparators} color={LB.mint} /></span>
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>{letters} lettres</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {game.themeRevealed && game.theme && (
                    <span style={{ padding: "5px 10px", borderRadius: 8, background: hexA(LB.violet, 0.14), boxShadow: `inset 0 0 0 1px ${hexA(LB.violet, 0.45)}`, fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em", color: LB.violet }}>{game.theme}</span>
                  )}
                  <CountdownPill secs={secs} accent={LB.mint} />
                  {soundBtn}{skipBtn}
                </div>
              </div>

              {proposals.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {proposals.map((m) => (
                    <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 12, padding: "8px 12px", background: m.kind === "correct" ? hexA(LB.mint, 0.1) : LB.surface, boxShadow: m.kind === "correct" ? `0 0 0 1px ${hexA(LB.mint, 0.45)}` : `0 0 0 1px ${LB.line}` }}>
                      <Avatar name={m.name} color={color(m.from)} avatar={avatarOf(m.from)} size={22} />
                      <span style={{ fontSize: 13, color: m.kind === "correct" ? LB.mint : LB.muted, fontWeight: m.kind === "correct" ? 700 : 400, fontStyle: m.kind === "guess" ? "italic" : "normal" }}>{m.kind === "correct" ? "a trouvé" : m.text}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="dv-canvasfill" style={{ display: "flex", flexDirection: "column" }}>
                <DrawCanvas room={room} drawable={false} blind={false} turnKey={turnKey} fit />
              </div>

              <div style={{ marginTop: 12 }}>
                {game.youGuessed
                  ? <p style={{ textAlign: "center", fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: LB.mint }}>Bien joué, tu as trouvé ! 🎉</p>
                  : <GuessPlate room={room} />}
              </div>
            </div>
          )}

          {/* ═══ REVEAL — fin du tour (7d) ═══ */}
          {game.phase === "reveal" && (
            <div className="dv-stage" style={{ padding: "14px 32px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.mint }}>Le mot était</span>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em", color: LB.faint }}>Prochain tour dans un instant…</span>
              </div>
              <div className="dv-canvasfill" style={{ display: "flex", justifyContent: "center", minHeight: 0 }}>
                <div style={{ position: "relative", height: "100%", aspectRatio: "3 / 2", maxWidth: "100%", borderRadius: 20, overflow: "hidden", boxShadow: `0 0 0 1px ${hexA(LB.mint, 0.45)}` }}>
                  <TurnDrawing room={room} />
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "52px 26px 22px", background: "linear-gradient(180deg,transparent,rgba(14,11,26,.94))" }}>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, letterSpacing: "-.02em", lineHeight: 1, color: LB.mint }}>{revealResult?.word}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
                {game.foundOrder.map((id, i) => (
                  <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 10, borderRadius: 14, padding: "10px 14px", background: i === 0 ? hexA(LB.mint, 0.1) : "transparent", boxShadow: i === 0 ? `0 0 0 1px ${hexA(LB.mint, 0.5)}` : `0 0 0 1px ${LB.line}` }}>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: i === 0 ? LB.mint : LB.faint }}>{i + 1}{i === 0 ? "er" : "e"}</span>
                    <Avatar name={name(id)} color={color(id)} avatar={avatarOf(id)} size={26} />
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{name(id)}</span>
                  </span>
                ))}
                {game.drawerId && (
                  <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10, borderRadius: 14, padding: "10px 14px", boxShadow: `0 0 0 1px ${hexA(LB.gold, 0.5)}`, background: hexA(LB.gold, 0.08) }}>
                    <Avatar name={name(game.drawerId)} color={color(game.drawerId)} avatar={avatarOf(game.drawerId)} size={26} />
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: LB.gold }}>dessinateur</span>
                  </span>
                )}
              </div>
              {game.mode === "blind" && game.youAreDrawer && <BlindReveal room={room} />}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
