"use client";

import { useRef, useState } from "react";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

/** Renders a player's custom avatar image if present, else a coloured monogram. */
export function Avatar({
  name,
  color,
  avatar,
  size = 40,
  className = "",
}: {
  name: string;
  color: string;
  avatar?: string | null;
  size?: number;
  className?: string;
}) {
  const px = `${size}px`;
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className={`shrink-0 rounded-lg border border-black/20 object-cover ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-lg font-display font-bold text-ink-deep ${className}`}
      style={{ width: px, height: px, backgroundColor: color, fontSize: Math.round(size * 0.34) }}
    >
      {initials(name)}
    </span>
  );
}

/** Center-crops + downscales a picked image to a small square data URL. */
function fileToSquareDataUrl(file: File, out = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("ctx"));
        ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function AvatarPicker({
  name,
  color,
  avatar,
  onChange,
}: {
  name: string;
  color: string;
  avatar?: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    setErr(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Choisis une image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErr("Image trop lourde (8 Mo max).");
      return;
    }
    setBusy(true);
    try {
      const url = await fileToSquareDataUrl(file);
      onChange(url);
    } catch {
      setErr("Impossible de lire cette image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} color={color} avatar={avatar} size={64} />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex gap-2.5">
          <button onClick={() => inputRef.current?.click()} disabled={busy} className="pl-obtn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
            {busy ? "…" : avatar ? "Remplacer l'avatar" : "Importer un avatar"}
          </button>
          {avatar && (
            <button onClick={() => onChange(null)} className="pl-obtn ghost">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></svg>
              Retirer
            </button>
          )}
        </div>
        {err ? <span className="text-xs text-magenta">{err}</span> : <span className="pl-hint">PNG/JPG · recadré en carré · sinon initiales colorées</span>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}
