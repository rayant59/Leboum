"use client";

import { useEffect, useRef, useState } from "react";
import type { DrawPublic, DrawStroke } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { BoumBackdrop } from "@/components/BoumBackdrop";
import { ResultsScreen } from "@/components/ResultsScreen";
import { SoundToggle } from "@/lib/sound";
import { Avatar } from "@/components/Avatar";

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
function ToolSvg({ id }: { id: Tool | "clear" }) {
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
    case "clear":
      return <svg viewBox="0 0 24 24" className="h-5 w-5"><path {...p} d="M5 7h14M10 7V5h4v2M6 7l1 12h10l1-12" /></svg>;
  }
}

/** Tool glyph: uses the player's custom image at /tools/<id>.png when present,
 *  otherwise falls back to the clean SVG (never an emoji). */
function ToolGlyph({ id }: { id: Tool | "clear" }) {
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
  return imgOk ? <img src={src} alt="" className="h-9 w-9 object-contain" /> : <ToolSvg id={id} />;
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

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

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
}: {
  room: UseRoom;
  drawable: boolean;
  blind: boolean;
  constraintRule?: string | null;
  turnKey?: string;
  authorFilter?: string | null; // impostor mode: show only this author's strokes
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

  // Turn clock driving the timed drawer-only effects (reset each turn).
  const turnStartRef = useRef(Date.now());
  const [, setFxTick] = useState(0);
  const hasTimedFx = sizeShift || colorShift || fog || shrink || ghostCursor;
  useEffect(() => {
    turnStartRef.current = Date.now();
    setFxTick(0);
    if (!hasTimedFx) return;
    const iv = setInterval(() => setFxTick((t) => t + 1), 200);
    return () => clearInterval(iv);
  }, [turnKey, hasTimedFx]);
  const fxElapsed = hasTimedFx ? Date.now() - turnStartRef.current : 0;
  const sizeFactor = sizeShift ? [0.4, 1, 2.2][Math.floor(fxElapsed / 5000) % 3] : 1;
  const shiftColor = colorShift ? SHIFT_COLORS[Math.floor(fxElapsed / 5000) % SHIFT_COLORS.length] : null;
  const fogOpacity = fog ? Math.min(0.6, (fxElapsed / 70000) * 0.6) : 0;
  const shrinkScale = shrink ? Math.max(0.5, 1 - (fxElapsed / 80000) * 0.5) : 1;
  const cursorVisible = !ghostCursor || Math.floor(fxElapsed / 3000) % 2 === 0;
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
    <div>
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
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* §6 — vertical toolbar on the left (wraps to a row on mobile) */}
        {drawable && (
          <div className="order-2 flex shrink-0 flex-wrap gap-1.5 sm:order-1 sm:flex-col sm:flex-nowrap">
            {TOOLS.filter((t) => toolAllowed(t.id)).map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={t.label}
                aria-label={t.label}
                className={`grid h-11 w-11 place-items-center rounded-xl border transition-colors ${tool === t.id ? "border-gold bg-gold/10 text-gold" : "border-ink-border bg-ink-surface text-text-muted hover:text-text"}`}
              >
                <ToolGlyph id={t.id} />
              </button>
            ))}
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Annuler le dernier trait"
              aria-label="Annuler le dernier trait"
              className="grid h-11 w-11 place-items-center rounded-xl border border-ink-border text-text-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-30 disabled:hover:border-ink-border disabled:hover:text-text-muted sm:mt-1"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14L4 9l5-5" />
                <path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H8" />
              </svg>
            </button>
            <button
              onClick={() => { historyRef.current = []; curTraitRef.current = []; setCanUndo(false); setColorLocked(false); setTraits(0); room.clearCanvas(); }}
              title="Tout effacer"
              aria-label="Tout effacer"
              className="grid h-11 w-11 place-items-center rounded-xl border border-ink-border text-text-faint transition-colors hover:border-magenta hover:text-magenta"
            >
              <ToolGlyph id="clear" />
            </button>
          </div>
        )}

        {/* §7 — the canvas is the main element and takes the remaining width */}
        <div className="order-1 min-w-0 flex-1 sm:order-2">
          <div className={`relative w-full select-none overflow-hidden rounded-2xl border border-ink-border${shake && shaking ? " animate-canvasshake" : ""}`} style={{ aspectRatio: "3 / 2", transform: shrink ? `scale(${shrinkScale})` : undefined, transformOrigin: "center", transition: "transform .2s linear" }}>
            <canvas ref={mainRef} {...handlers} className="absolute inset-0 h-full w-full touch-none bg-white" style={{ cursor: drawable ? "none" : "default" }} />
            <canvas ref={overRef} className="pointer-events-none absolute inset-0 h-full w-full" />
            {fog && <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at 50% 45%, rgba(226,232,240,0.15), rgba(203,213,225,0.9))", opacity: fogOpacity, transition: "opacity .3s linear" }} />}
            {drawable && cursorVisible && cursorPos && <CustomCursor tool={tool} pos={cursorPos} size={width * scaleRef.current} color={color} />}
          </div>

          {drawable && (
            <div className="mt-3 space-y-2.5">
              <ColorPalette color={color} setColor={setColor} locked={paletteLocked} noVariants={oneColor} />
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-faint">Taille</span>
                {[4, 8, 16, 28].map((w) => (
                  <button
                    key={w}
                    onClick={() => setWidth(w)}
                    className={`grid h-8 w-8 place-items-center rounded-lg border transition-colors ${width === w ? "border-gold bg-gold/10" : "border-ink-border bg-ink-surface"}`}
                    aria-label={`Épaisseur ${w}`}
                  >
                    <span className="rounded-full bg-text" style={{ width: w / 2 + 2, height: w / 2 + 2 }} />
                  </button>
                ))}
              </div>
              {capped && <p className="text-xs text-magenta">Limite de traits atteinte — « Tout effacer » pour recommencer.</p>}
            </div>
          )}
        </div>
      </div>
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        className="mb-2 min-h-[12rem] flex-1 space-y-1.5 overflow-y-auto rounded-xl border border-ink-border bg-ink-surface p-3.5 text-sm leading-relaxed"
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
      <div className="flex gap-2">
        <input
          value={talkText}
          onChange={(e) => setTalkText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitTalk()}
          placeholder="💬 Discuter…"
          maxLength={140}
          className="flex-1 rounded-xl border border-ink-border bg-ink-deep px-4 py-2.5 text-sm text-text-muted outline-none transition-colors focus:border-text-faint"
        />
        <button onClick={submitTalk} className="rounded-xl border border-ink-border px-3.5 text-sm text-text-muted transition-colors hover:text-text">
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
  const isCoop = game.mode === "coop";
  const teamScore = Object.values(game.scores).reduce((a, b) => a + b, 0);

  const FoundList = () =>
    game.foundOrder.length > 0 ? (
      <div className="rounded-xl border border-ink-border bg-ink-surface p-3">
        <p className="eyebrow mb-2 text-gold">🏆 Ont trouvé</p>
        <ol className="space-y-1 text-sm">
          {game.foundOrder.map((id, i) => (
            <li key={id} className="flex items-center gap-2">
              <span className="w-4 font-mono text-text-faint">{i + 1}.</span>
              <span className="grid h-5 w-5 place-items-center rounded font-display text-[9px] font-bold text-ink-deep" style={{ backgroundColor: color(id) }}>{initials(name(id))}</span>
              <span className="font-medium">{name(id)}{id === you && " (toi)"}</span>
            </li>
          ))}
        </ol>
      </div>
    ) : null;

  return (
    <>
      <BoumBackdrop />
      <main className="relative z-[1] mx-auto max-w-7xl px-4 py-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">Manche {game.round}/{game.totalRounds}</span>
        <div className="flex items-center gap-2">
          {isCoop && (
            <span className="rounded-full border border-mint/40 bg-mint/[0.08] px-2.5 py-0.5 text-xs font-semibold text-mint">
              🤝 Équipe : {teamScore}
            </span>
          )}
          <SoundToggle />
          {secs != null && <span className={`font-mono text-sm tabular-nums ${secs <= 5 ? "text-magenta" : "text-text-muted"}`}>{secs}s</span>}
          {isHost && game.phase !== "scoreboard" && (
            <SkipButton onSkip={room.skipPhase} />
          )}
        </div>
      </div>

      {(game.phase === "drawing" || game.phase === "reveal") && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {game.players.map((p) => {
            const done = game.guessedIds.includes(p.id) || p.id === game.drawerId;
            const isDrawer = p.id === game.drawerId;
            return (
              <span key={p.id} title={p.name} className={`relative grid h-8 w-8 place-items-center rounded-lg font-display text-[11px] font-bold text-ink-deep ${done ? "" : "opacity-25"}`} style={{ backgroundColor: p.color }}>
                {initials(p.name)}
                {isDrawer ? <span className="absolute -bottom-1 -right-1 text-[11px]">✏️</span> : done && <span className="absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-mint text-[8px] font-bold text-ink-deep">✓</span>}
              </span>
            );
          })}
        </div>
      )}

      {game.phase === "choosing" && (
        <div className="animate-pop grid min-h-[40vh] place-items-center text-center">
          {game.youAreDrawer ? (
            <div>
              <p className="eyebrow mb-4">Choisis ton mot</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                {(game.wordChoices ?? []).map((w) => (
                  <button key={w} onClick={() => room.chooseWord(w)} className="rounded-xl border border-ink-border bg-ink-surface px-6 py-4 font-display text-lg font-bold transition-colors hover:border-gold hover:text-gold">{w}</button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-text-muted"><span className="font-semibold text-text">{drawerName}</span> choisit un mot…</p>
          )}
        </div>
      )}

      {game.phase === "drawing" && (
        <div className="animate-pop">
          <div className="mb-6 text-center sm:mb-8">
            {game.youAreDrawer ? (
              <div className="flex flex-col items-center gap-2">
                <p className="font-display text-xl font-bold">Dessine : <span className="text-gold">{game.word}</span></p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {!game.themeRevealed ? (
                    <button onClick={() => room.revealTheme()} className="rounded-lg border border-magenta/50 px-3 py-1.5 text-xs font-medium text-magenta transition-colors hover:bg-magenta/10">Révéler le thème (indice)</button>
                  ) : (
                    <p className="text-xs text-text-faint">Thème révélé aux joueurs ✓</p>
                  )}
                  <button
                    onClick={() => room.endDrawing()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-mint/50 bg-mint/[0.08] px-3 py-1.5 text-xs font-bold text-mint transition-colors hover:bg-mint/20"
                    title="Terminer ta manche maintenant (passe à la révélation)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>
                    J'ai terminé
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <MaskedWord segments={game.wordSegments} separators={game.wordSeparators} />
                <p className="text-xs text-text-faint">
                  <span className="text-text-muted">{name(game.drawerId ?? "")}</span> dessine · {game.foundOrder.length}/{Math.max(0, game.players.length - 1)} ont trouvé
                </p>
                {game.themeRevealed && game.theme && <p className="animate-pop text-sm"><span className="eyebrow text-magenta">Thème</span> <span className="ml-1 font-semibold">{game.theme}</span></p>}
              </div>
            )}
          </div>

          {game.constraint && (
            <div className="mx-auto mb-3 flex max-w-md items-center justify-center gap-2.5 rounded-xl border border-magenta/40 bg-magenta/[0.08] px-4 py-2 text-center">
              <span className="eyebrow text-magenta">Contrainte</span>
              <span className="text-sm font-medium">{game.constraint}</span>
            </div>
          )}
          {game.mode === "blind" && game.youAreDrawer && <p className="mb-3 text-center text-sm text-text-muted">Mode aveugle : tu ne vois pas ton trait. Bonne chance !</p>}

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <DrawCanvas room={room} drawable={game.youAreDrawer} blind={game.mode === "blind" && game.youAreDrawer} constraintRule={game.youAreDrawer ? game.constraintRule : null} turnKey={turnKey} />
              {!game.youAreDrawer && !game.youGuessed && <GuessBar room={room} />}
              {game.youGuessed && <p className="mt-3 text-center text-sm text-mint">Bien joué, tu as trouvé ! 🎉</p>}
            </div>
            <div className="flex min-h-0 flex-col gap-4">
              <FoundList />
              <ChatPanel room={room} />
            </div>
          </div>
        </div>
      )}

      {game.phase === "reveal" && (
        <div className="text-center">
          <p className="eyebrow mb-2">Le mot était</p>
          <h2 className="animate-reveal mb-1 font-display text-5xl font-extrabold text-gold drop-shadow-[0_0_18px_rgba(255,194,75,0.35)]">{game.result?.word}</h2>
          <p className="mb-5 text-sm text-text-muted">{game.result && game.result.guesserIds.length > 0 ? `Trouvé par ${game.result.guesserIds.map(name).join(", ")}` : "Personne n'a trouvé cette fois"}</p>
          <div className="mx-auto max-w-sm space-y-2 text-left">
            {[...game.players].sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0)).map((p) => {
              const found = game.result?.guesserIds.includes(p.id);
              const drew = p.id === game.drawerId;
              return (
                <div key={p.id} className={`flex items-center gap-3 rounded-xl border p-2.5 ${found || drew ? "border-mint/40 bg-mint/[0.06]" : "border-ink-border bg-ink-surface"}`}>
                  <Avatar name={p.name} color={color(p.id)} avatar={avatarOf(p.id)} size={32} />
                  <span className="flex-1 font-semibold">
                    {p.name}
                    {drew && <span className="ml-2 text-xs text-text-faint">a dessiné</span>}
                    {found && <span className="ml-2 text-xs text-mint">a trouvé</span>}
                  </span>
                  <span className="font-display font-bold tabular-nums text-gold">{game.scores[p.id] ?? 0}</span>
                </div>
              );
            })}
          </div>
          {game.mode === "blind" && game.youAreDrawer && <BlindReveal room={room} />}
        </div>
      )}

      {game.phase === "scoreboard" && (
        isCoop ? (
          <div className="animate-pop grid min-h-[60vh] place-items-center text-center">
            <div className="w-full max-w-sm">
              <div className="mb-4 text-4xl">🤝</div>
              <h1 className="mb-1 font-display text-3xl font-extrabold">Bravo l'équipe !</h1>
              <p className="mb-5 text-text-muted">
                Score collectif : <span className="font-display text-2xl font-extrabold text-mint">{teamScore}</span>
              </p>
              <div className="space-y-2 text-left">
                {[...game.players].sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0)).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-ink-border bg-ink-surface p-2.5">
                    <Avatar name={p.name} color={color(p.id)} avatar={avatarOf(p.id)} size={36} />
                    <span className="flex-1 font-semibold">{p.name}{p.id === you && " (toi)"}</span>
                    <span className="text-sm text-text-muted">+{game.scores[p.id] ?? 0}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-2.5">
                {isHost ? (
                  <>
                    <button onClick={() => room.playAgain()} className="arc arc-p arc-block">Rejouer une partie</button>
                    <button onClick={() => room.returnLobby()} className="arc arc-sec arc-block">Retour au salon</button>
                  </>
                ) : (
                  <p className="text-sm text-text-muted">En attente de l'hôte…</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-pop">
            <ResultsScreen
              ranking={[...game.players]
                .sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0))
                .map((p) => ({ id: p.id, name: p.name, color: color(p.id), avatar: avatarOf(p.id), score: game.scores[p.id] ?? 0 }))}
              you={you}
              stats={null}
              isHost={isHost}
              onReturn={() => room.returnLobby()}
              onReplay={() => room.playAgain()}
            />
            {!isHost && <p className="mt-4 text-center text-sm text-text-muted">En attente de l'hôte…</p>}
          </div>
        )
      )}
      </main>
    </>
  );
}
