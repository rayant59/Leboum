"use client";

// Ardoise de dessin autonome (souris + tactile) : pinceau, gomme, tailles,
// couleurs, annuler, tout effacer. Le dessin reste local ; on l'exporte en
// image compressée (`exportImage`) quand le joueur valide. Réutilisable par
// tout jeu qui doit « rendre un dessin » (Téléphone cassé, futurs modes…).

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as RPointerEvent } from "react";

/** Taille logique du dessin (ratio 4:3). */
const W = 960;
const H = 720;
/** Taille d'export (plus petite = plus léger à transmettre). */
const EXPORT_W = 480;
const EXPORT_H = 360;
const MAX_EXPORT_CHARS = 190_000;

const COLORS = ["#111111", "#6B7280", "#FFFFFF", "#EF4444", "#F97316", "#FACC15", "#22C55E", "#0EA5E9", "#6366F1", "#A855F7", "#EC4899", "#92400E"];
const SIZES = [5, 12, 26];

interface Stroke {
  color: string;
  size: number;
  points: [number, number][];
}

export interface DrawPadHandle {
  /** Image compressée `data:image/...` (null si la feuille est vierge). */
  exportImage: () => string | null;
  isEmpty: () => boolean;
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const pts = s.points;
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], s.size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
}

export const DrawPad = forwardRef<DrawPadHandle, { accent?: string; disabled?: boolean; onInk?: (hasInk: boolean) => void }>(function DrawPad(
  { accent = "#46E0B0", disabled = false, onInk },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const [count, setCount] = useState(0); // force le rendu des boutons (annuler…)
  const [confirmClear, setConfirmClear] = useState(false);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    for (const s of strokes.current) drawStroke(ctx, s);
    if (current.current) drawStroke(ctx, current.current);
  }, []);

  useEffect(() => redraw(), [redraw]);

  const changed = () => {
    setCount(strokes.current.length);
    onInk?.(strokes.current.length > 0);
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => strokes.current.length === 0,
    exportImage: () => {
      if (!canvasRef.current || strokes.current.length === 0) return null;
      const out = document.createElement("canvas");
      out.width = EXPORT_W;
      out.height = EXPORT_H;
      const ctx = out.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(canvasRef.current, 0, 0, EXPORT_W, EXPORT_H);
      for (const q of [0.72, 0.55, 0.4, 0.28]) {
        let url = out.toDataURL("image/webp", q);
        if (!url.startsWith("data:image/webp")) url = out.toDataURL("image/jpeg", q); // Safari ancien
        if (url.length <= MAX_EXPORT_CHARS) return url;
      }
      return null;
    },
  }));

  const toLocal = (e: RPointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };

  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = { color: eraser ? "#FFFFFF" : color, size: eraser ? size * 1.8 : size, points: [toLocal(e)] };
    setConfirmClear(false);
    redraw();
  };
  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!current.current) return;
    const p = toLocal(e);
    const pts = current.current.points;
    const last = pts[pts.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 2) return;
    pts.push(p);
    redraw();
  };
  const onUp = () => {
    if (!current.current) return;
    strokes.current = [...strokes.current, current.current];
    current.current = null;
    redraw();
    changed();
  };

  const undo = () => {
    strokes.current = strokes.current.slice(0, -1);
    redraw();
    changed();
  };
  const clear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    strokes.current = [];
    setConfirmClear(false);
    redraw();
    changed();
  };

  const toolBtn = (active: boolean): React.CSSProperties => ({
    width: 44,
    height: 44,
    padding: 4,
    borderRadius: 12,
    border: "none",
    cursor: disabled ? "default" : "pointer",
    background: active ? "rgba(255,194,75,.14)" : "rgba(28,22,54,.7)",
    boxShadow: active ? "0 0 0 2px #FFC24B" : "inset 0 0 0 1px #332A5A",
    display: "grid",
    placeItems: "center",
    flex: "none",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        aria-label="Zone de dessin"
        style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: 18, background: "#fff", touchAction: "none", cursor: disabled ? "not-allowed" : "crosshair", boxShadow: `0 0 0 2px ${accent}55, 0 20px 40px -24px rgba(0,0,0,.9)`, opacity: disabled ? 0.85 : 1 }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "center" }}>
        <button type="button" title="Pinceau" aria-label="Pinceau" style={toolBtn(!eraser)} onClick={() => setEraser(false)} disabled={disabled}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tools/brush.png" alt="" width={32} height={32} draggable={false} />
        </button>
        <button type="button" title="Gomme" aria-label="Gomme" style={toolBtn(eraser)} onClick={() => setEraser(true)} disabled={disabled}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tools/eraser.png" alt="" width={32} height={32} draggable={false} />
        </button>
        <span style={{ width: 1, height: 28, background: "#332A5A" }} />
        {SIZES.map((sz) => (
          <button key={sz} type="button" title={`Épaisseur ${sz}`} aria-label={`Épaisseur ${sz}`} style={toolBtn(size === sz)} onClick={() => setSize(sz)} disabled={disabled}>
            <span style={{ width: Math.max(5, sz * 0.8), height: Math.max(5, sz * 0.8), borderRadius: 999, background: "#F3EEFF" }} />
          </button>
        ))}
        <span style={{ width: 1, height: 28, background: "#332A5A" }} />
        <button type="button" title="Annuler" aria-label="Annuler" style={{ ...toolBtn(false), opacity: count ? 1 : 0.4 }} onClick={undo} disabled={disabled || !count}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tools/undo.png" alt="" width={32} height={32} draggable={false} />
        </button>
        <button type="button" title={confirmClear ? "Clique encore pour tout effacer" : "Tout effacer"} aria-label="Tout effacer" style={{ ...toolBtn(confirmClear), boxShadow: confirmClear ? "0 0 0 2px #FF4D8D" : toolBtn(false).boxShadow, opacity: count ? 1 : 0.4 }} onClick={clear} disabled={disabled || !count}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tools/clear.png" alt="" width={32} height={32} draggable={false} />
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
        {COLORS.map((c) => {
          const on = !eraser && color === c;
          return (
            <button
              key={c}
              type="button"
              aria-label={`Couleur ${c}`}
              onClick={() => { setColor(c); setEraser(false); }}
              disabled={disabled}
              style={{ width: 30, height: 30, borderRadius: 999, border: "none", cursor: "pointer", background: c, boxShadow: on ? "0 0 0 3px #14102A, 0 0 0 5px #FFC24B" : "inset 0 0 0 1px rgba(255,255,255,.25)", transform: on ? "scale(1.08)" : "none", transition: "transform .1s" }}
            />
          );
        })}
      </div>
    </div>
  );
});
