"use client";

import { useEffect, useState } from "react";
import { sanitizeName } from "@subtitles-party/shared";
import { Avatar, AvatarPicker } from "@/components/Avatar";

export function ProfileModal({
  name,
  color,
  avatar,
  onSetName,
  onSetAvatar,
  onClose,
}: {
  name: string;
  color: string;
  avatar?: string | null;
  onSetName: (name: string) => void;
  onSetAvatar: (dataUrl: string | null) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveName = () => {
    const clean = sanitizeName(draft);
    if (clean && clean !== name) onSetName(clean);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl border border-ink-border p-6"
        style={{ backgroundImage: "linear-gradient(165deg, rgba(37,28,69,.96), rgba(18,14,36,.98))", boxShadow: "0 30px 80px -30px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.05)" }}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-3.5 top-3.5 grid h-9 w-9 place-items-center rounded-lg border border-ink-border text-text-muted transition-colors hover:border-gold hover:text-gold"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        <div className="mb-5 flex items-center gap-3">
          <span className="cfg-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg></span>
          <div>
            <h2 className="cfg-tt">Ton profil</h2>
            <span className="cfg-sub">Personnalise ton avatar et ton nom</span>
          </div>
        </div>

        {/* avatar */}
        <div className="mb-5 flex justify-center">
          <AvatarPicker name={name} color={color} avatar={avatar} onChange={onSetAvatar} />
        </div>

        {/* name */}
        <label className="mb-1.5 block text-sm font-medium text-text-muted">Ton nom</label>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-ink-border bg-ink-deep px-3">
            <Avatar name={draft || name} color={color} avatar={avatar} size={26} />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              maxLength={20}
              placeholder="Ton pseudo"
              className="flex-1 bg-transparent py-2.5 text-text outline-none"
            />
          </div>
          <button onClick={saveName} className="arc arc-p" style={{ padding: "0 18px" }}>Enregistrer</button>
        </div>

        <p className="mt-4 text-center text-sm text-text-muted">Ton avatar et ton nom sont visibles par tous les joueurs.</p>

        <button onClick={onClose} className="arc arc-sec arc-block mt-5">Terminé</button>
      </div>
    </div>
  );
}
