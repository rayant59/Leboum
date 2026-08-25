"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { canStart, sanitizeName, DRAW_THEMES } from "@subtitles-party/shared";
import { getPlayerName, setPlayerName } from "@/lib/identity";
import { useRoom } from "@/lib/useRoom";
import { BoumBackdrop } from "@/components/BoumBackdrop";
import { useGameSounds } from "@/lib/sound";
import { GameView } from "@/components/GameView";
import { DrawGameView } from "@/components/DrawGameView";
import { FakeArtistView } from "@/components/FakeArtistView";
import { RelayView } from "@/components/RelayView";
import { DoublageView } from "@/components/DoublageView";
import { QuizView } from "@/components/QuizView";
import { RecoView } from "@/components/RecoView";
import { GameSettingsPanel } from "@/components/GameSettingsPanel";
import { Avatar } from "@/components/Avatar";
import { ProfileModal } from "@/components/ProfileModal";
import { SubtitleStrip } from "@/components/SubtitleStrip";

function PresetStepper({
  label,
  sub,
  value,
  values,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  sub?: string;
  value: number;
  values: number[];
  unit: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const idx = Math.max(0, values.indexOf(value));
  const go = (d: number) => {
    const ni = Math.max(0, Math.min(values.length - 1, idx + d));
    if (values[ni] !== value) onChange(values[ni]);
  };
  return (
    <div className="cfg-rounds">
      <div className="cfg-rlab"><b>{label}</b>{sub}</div>
      <div className="cfg-stepper">
        <button className="cfg-sbtn" onClick={() => go(-1)} disabled={disabled || idx <= 0} aria-label="Moins"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12h14" /></svg></button>
        <div className="cfg-sval"><div className="cfg-svaln">{value}</div><div className="cfg-svalu">{unit}</div></div>
        <button className="cfg-sbtn" onClick={() => go(1)} disabled={disabled || idx >= values.length - 1} aria-label="Plus"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
      </div>
    </div>
  );
}

const GAME_META: Record<string, { label: string; img: string; tint: string }> = {
  subtitles: { label: "Sous-titres", img: "/games/subtitles.png", tint: "#FFC24B" },
  draw: { label: "Dessin & Devinette", img: "/games/draw.png", tint: "#FF4D8D" },
  doublage: { label: "Doublage", img: "/games/doublage.png", tint: "#46E0B0" },
  quiz: { label: "Quiz", img: "/games/quiz.png", tint: "#8B7DF6" },
  reco: { label: "Reconnaissance", img: "/games/reco.png", tint: "#4CC9F0" },
  pixel: { label: "Pixel incoming", img: "/games/pixel.png", tint: "#46E0B0" },
};

export default function LobbyPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();

  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<"subtitles" | "draw" | "fakeartist" | "relay" | "doublage" | "quiz" | "reco" | "pixel">("draw");
  const [drawMode, setDrawMode] = useState("classic");
  const [drawRounds, setDrawRounds] = useState(3);
  const [drawThemes, setDrawThemes] = useState<string[]>([]);
  const [quizCount, setQuizCount] = useState(10);
  const [quizSecs, setQuizSecs] = useState(15);
  const [quizType, setQuizType] = useState<"all" | "mcq" | "truefalse" | "free">("all");
  const [recoCount, setRecoCount] = useState(10);
  const [recoSecs, setRecoSecs] = useState(15);
  const [recoCat, setRecoCat] = useState("all");
  useEffect(() => setName(getPlayerName()), []);

  // `?create=1` (set by the home page) authorises room creation server-side.
  // Read straight off the URL: avoids useSearchParams' Suspense requirement.
  const wantsCreate = useMemo(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("create") === "1",
    [],
  );
  const room = useRoom(code, wantsCreate);
  useGameSounds(room);
  // Show a networking hint if the socket doesn't connect (LAN firewall, etc.).
  const [connSlow, setConnSlow] = useState(false);
  useEffect(() => {
    if (room.status === "open") {
      setConnSlow(false);
      return;
    }
    const id = window.setTimeout(() => setConnSlow(true), 6000);
    return () => window.clearTimeout(id);
  }, [room.status]);

  // Join as soon as we're connected and have a name. Idempotent server-side:
  // a repeat join with the same id is treated as a reconnect.
  const prevStatus = useRef<string>("");
  useEffect(() => {
    if (room.status === "open" && name && prevStatus.current !== "open") {
      room.join(name);
    }
    prevStatus.current = room.status;
  }, [room.status, name, room]);

  // Host broadcasts the currently-selected game so guests see what's coming.
  // Kept above any early return so hook order stays stable every render.
  useEffect(() => {
    const st = room.state;
    const meNow = st && room.you ? st.players[room.you] : undefined;
    if (meNow?.isHost) room.selectGame(selectedGame);
  }, [room, room.state, room.you, selectedGame]);

  // --- name gate (direct link without a stored pseudo) ----------------------
  if (!name) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
        <div className="panel animate-pop p-6">
          <div className="mb-5 flex justify-center">
            <SubtitleStrip>Boum</SubtitleStrip>
          </div>
          <p className="eyebrow mb-2 text-center">Salle {code}</p>
          <h1 className="mb-1 text-center font-display text-2xl font-bold">Rejoins la partie</h1>
          <p className="mb-5 text-center text-sm text-text-muted">Choisis un pseudo pour entrer.</p>
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") enter();
            }}
            maxLength={20}
            placeholder="Ton pseudo"
            className="mb-3 w-full rounded-xl border border-ink-border bg-ink-deep px-4 py-3 text-center text-lg focus:border-gold"
          />
          <button
            onClick={enter}
            className="w-full rounded-xl bg-gold px-4 py-3 font-display font-bold text-ink-deep transition-transform hover:-translate-y-0.5"
          >
            Entrer
          </button>
        </div>
      </main>
    );
  }

  function enter() {
    const clean = sanitizeName(nameDraft);
    if (!clean) return;
    setPlayerName(clean);
    setName(clean);
  }

  const state = room.state;
  const me = state && room.you ? state.players[room.you] : undefined;
  const isHost = me?.isHost ?? false;

  const players = state ? state.playerOrder.map((id) => state.players[id]).filter(Boolean) : [];
  const readyCount = players.filter((p) => p.isConnected && p.isReady).length;
  const maxPlayers = state?.config.maxPlayers ?? 8;
  const startable = !!state && canStart(state);

  async function copyLink() {
    const url = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // http on a LAN IP is not a secure context → Clipboard API is missing.
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Couldn't copy automatically — the link stays visible for a manual copy.
    }
  }

  // --- game hand-off: render the game module once the room is in_game -------
  if (state?.phase === "in_game") {
    if (!room.game) {
      return (
        <main className="grid min-h-dvh place-items-center px-5 text-center">
          <div className="animate-pop">
            <div className="mb-4 flex justify-center">
              <SubtitleStrip>silence, ça tourne…</SubtitleStrip>
            </div>
            <p className="text-text-muted">La partie démarre…</p>
          </div>
        </main>
      );
    }
    if (room.gameId === "fakeartist") return <FakeArtistView room={room} />;
    if (room.gameId === "relay") return <RelayView room={room} />;
    if (room.gameId === "doublage") return <DoublageView room={room} />;
    if (room.gameId === "quiz") return <QuizView room={room} />;
    if (room.gameId === "reco") return <RecoView room={room} />;
    if (room.gameId === "pixel") return <RecoView room={room} pixel />;
    return room.gameId === "draw" ? <DrawGameView room={room} /> : <GameView room={room} />;
  }

  const online = room.status === "open";

  return (
    <>
      <BoumBackdrop />
      <main className="relative z-[1] mx-auto max-w-2xl px-5 py-7" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* brand + connection */}
      <header className="mb-6 flex items-center justify-between">
        <SubtitleStrip caret={false}>Boum</SubtitleStrip>
        <span className="flex items-center gap-2 text-xs text-text-muted">
          <span className={`h-2 w-2 rounded-full ${online ? "bg-mint" : "bg-gold animate-bulb"}`} />
          {online ? "Connecté" : "Connexion…"}
        </span>
      </header>

      {!online && connSlow && (
        <div className="mb-6 rounded-xl border border-magenta/40 bg-magenta/[0.06] p-4 text-sm">
          <p className="mb-1 font-semibold text-magenta">Connexion au serveur impossible</p>
          <p className="text-text-muted">
            Vérifie que le téléphone est sur le <b>même WiFi</b> que le PC, et que le <b>pare-feu Windows</b> autorise Node.js
            (ports <b>3000</b> et <b>1999</b>) sur les réseaux privés. Le PC doit avoir lancé <code className="rounded bg-ink-surface px-1">dev:server</code> et <code className="rounded bg-ink-surface px-1">dev:web</code>.
          </p>
        </div>
      )}

      {/* hero: the room code + invite — the waiting room's real job */}
      <section className="panel mb-8 p-6 text-center">
        <p className="eyebrow mb-3">Code de la salle</p>
        <div className="mb-5 flex items-center justify-center gap-4">
          <svg className="hidden shrink-0 text-magenta/70 sm:block" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="2.5" y="5" width="14" height="10" rx="2" /><path d="M3 6l6.5 5L16 6" />
            <path d="M15 16.5a3 3 0 0 0 4.2 0l1.3-1.3a3 3 0 0 0-4.2-4.2l-.6.6" style={{ color: "#8B7DF6" }} stroke="#8B7DF6" />
          </svg>
          <div className="inset-well inline-flex gap-1.5 p-2.5">
            {[...code].map((c, i) => (
              <span
                key={i}
                className="grid h-14 w-11 place-items-center rounded-lg border border-gold/40 bg-ink-deep font-mono text-2xl font-bold text-gold"
                style={{ boxShadow: "0 0 20px rgba(255,194,75,0.18), inset 0 1px 0 rgba(255,255,255,0.06)", animation: `tilePop 0.5s cubic-bezier(0.34,1.56,0.64,1) ${(0.12 + i * 0.09).toFixed(2)}s both` }}
              >
                {c}
              </span>
            ))}
          </div>
          <svg className="hidden shrink-0 text-magenta/70 sm:block" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="16.5" cy="9" r="2.2" /><path d="M15 19a5 5 0 0 1 6.5-4.8" />
          </svg>
        </div>
        <p className="mx-auto mb-4 max-w-xs text-sm text-text-muted">
          Partage ce code — ou le lien — pour que tes amis rejoignent la salle.
        </p>
        <button
          onClick={copyLink}
          className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 font-display text-sm font-bold transition-colors ${
            copied
              ? "border-mint/50 bg-mint/10 text-mint"
              : "border-gold/50 text-gold hover:bg-gold/10"
          }`}
        >
          {copied ? "Lien copié ✓" : "Copier le lien d'invitation"}
        </button>
      </section>

      {/* players */}
      <section className="mb-8">
        <div className="cfg-head">
          <span className="cfg-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="16.8" cy="9" r="2.3" /><path d="M15.2 19a5 5 0 0 1 6.3-4.9" /></svg></span>
          <div>
            <h2 className="cfg-tt">Joueurs <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, color: "#6E6796" }}>{players.length}/{maxPlayers}</span></h2>
            <span className="cfg-sub">En attente dans le salon</span>
          </div>
          <span className={`pl-readypill${readyCount > 0 ? " some" : ""}`}><span className="d" />{readyCount} prêt{readyCount > 1 ? "s" : ""}</span>
        </div>

        <div className="pl-list">
          {players.map((p) => {
            const isYou = p.id === room.you;
            return (
              <div key={p.id} className={`pl-card${isYou ? " you" : ""}${p.isConnected ? "" : " off"}`}>
                {isYou ? (
                  <button
                    onClick={() => setProfileOpen(true)}
                    className="group relative rounded-[15px]"
                    title="Modifier ton profil"
                    aria-label="Modifier ton profil"
                  >
                    <Avatar name={p.name} color={p.color} avatar={p.avatar} size={48} />
                    <span className={`pl-dot${p.isConnected ? "" : " off"}`} />
                    <span className="absolute inset-0 grid place-items-center rounded-[15px] bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </span>
                  </button>
                ) : (
                  <div className="relative">
                    <Avatar name={p.name} color={p.color} avatar={p.avatar} size={48} />
                    <span className={`pl-dot${p.isConnected ? "" : " off"}`} title={p.isConnected ? "En ligne" : "Hors ligne"} />
                  </div>
                )}
                <div className="pl-info">
                  <div className="pl-name">
                    <span className="nm">{p.name}</span>
                    {isYou && <span className="pl-youtag">(toi)</span>}
                    {p.isHost && (
                      <span className="pl-host"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7l4.2 3L12 4l4.8 6L21 7l-1.6 11H4.6L3 7z" /></svg>Hôte</span>
                    )}
                  </div>
                  <span className="pl-pstatus">
                    <svg className="s-ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    {p.isConnected ? (p.isReady ? "Prêt" : "En attente") : "Déconnecté"}
                  </span>
                </div>
                <span className={`pl-badge ${p.isReady && p.isConnected ? "ok" : "wait"}`}>
                  {p.isReady && p.isConnected ? "Prêt" : "Pas prêt"}
                </span>
              </div>
            );
          })}
        </div>

        {maxPlayers - players.length > 0 && (
          <div className="pl-slots">
            {Array.from({ length: Math.min(maxPlayers - players.length, 8) }).map((_, i) => (
              <div key={i} className="pl-slot">
                <span className="pl-ring"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span>
                <span>Place libre</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* guests: read-only preview of the game the host will launch */}
      {!isHost && (
        <section className="mb-8">
          <p className="eyebrow mb-2 px-1">Jeu choisi par l'hôte</p>
          {room.pendingGame && GAME_META[room.pendingGame] ? (
            <div className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: `${GAME_META[room.pendingGame].tint}55`, background: `${GAME_META[room.pendingGame].tint}0f` }}>
              <img src={GAME_META[room.pendingGame].img} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" draggable={false} />
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">{GAME_META[room.pendingGame].label}</p>
                <p className="text-xs text-text-faint">L'hôte lancera cette partie. Prépare-toi et mets-toi « prêt » !</p>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-ink-border p-3 text-sm text-text-faint">L'hôte n'a pas encore choisi de jeu…</p>
          )}
        </section>
      )}

      {/* game picker (host) */}
      {isHost && (
        <section className="mb-8">
          <p className="eyebrow mb-2 px-1">Jeu</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                { id: "draw", img: "/games/draw.png", label: "Dessin & Devinette", players: "2–8", desc: "Dessine le mot secret, les autres devinent — avec ses variantes.", tint: "#FF4D8D", tintBg: "rgba(255,77,141,0.12)", tintBorder: "rgba(255,77,141,0.32)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 5.6l3.9 3.9" /><path d="M4 20l1.3-4.4L15.7 5.2a1.9 1.9 0 0 1 2.7 0l.4.4a1.9 1.9 0 0 1 0 2.7L8.4 18.7 4 20Z" /></svg> },
                { id: "doublage", img: "/games/doublage.png", label: "Doublage", players: "2–10", desc: "Doublez une vidéo à votre sauce et improvisez les voix.", tint: "#46E0B0", tintBg: "rgba(70,224,176,0.12)", tintBorder: "rgba(70,224,176,0.32)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0" /><path d="M12 17v3.2" /><path d="M9 20.2h6" /></svg> },
                { id: "quiz", img: "/games/quiz.png", label: "Quiz", players: "2–8", desc: "Répondez à des questions et montrez votre culture !", tint: "#8B7DF6", tintBg: "rgba(139,125,246,0.14)", tintBorder: "rgba(139,125,246,0.4)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4" /><circle cx="12" cy="17.5" r="0.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="9" /></svg> },
                { id: "reco", img: "/games/reco.png", label: "Reconnaissance", players: "2–8", desc: "Devinez le personnage, le film, le lieu et bien plus.", tint: "#4CC9F0", tintBg: "rgba(76,201,240,0.14)", tintBorder: "rgba(76,201,240,0.4)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="M4 17l4.5-4 3 2.5L15 12l5 4.5" /></svg> },
                { id: "pixel", img: "/games/pixel.png", label: "Pixel incoming", players: "1–12", desc: "Une image se dévoile pixel par pixel — devine le plus vite possible !", tint: "#46E0B0", tintBg: "rgba(70,224,176,0.12)", tintBorder: "rgba(70,224,176,0.32)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><rect x="15" y="15" width="6" height="6"/></svg> },
              ] as const
            ).map((c) => {
              const sel = selectedGame === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedGame(c.id); if (c.id === "pixel" && recoSecs < 45) setRecoSecs(60); }}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    borderColor: sel ? c.tint : "#332A5A",
                    background: sel ? `linear-gradient(160deg, ${c.tintBg}, rgba(28,22,54,0.6) 60%)` : "rgba(28,22,54,0.55)",
                    boxShadow: sel ? `0 0 0 1px ${c.tint}66, 0 14px 34px -18px ${c.tint}aa` : "none",
                  }}
                >
                  {/* decorative sparkles */}
                  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" className="pointer-events-none absolute" style={{ top: "26%", left: "58%", color: sel ? c.tint : "#6E6796", opacity: sel ? 0.55 : 0.3 }}><path fill="currentColor" d="M12 2l1.5 8.5L22 12l-8.5 1.5L12 22l-1.5-8.5L2 12l8.5-1.5z" /></svg>
                  <svg aria-hidden width="9" height="9" viewBox="0 0 24 24" className="pointer-events-none absolute" style={{ top: "62%", left: "84%", color: sel ? c.tint : "#6E6796", opacity: sel ? 0.5 : 0.25 }}><path fill="currentColor" d="M12 2l1.5 8.5L22 12l-8.5 1.5L12 22l-1.5-8.5L2 12l8.5-1.5z" /></svg>
                  <div className="mb-2.5 flex items-start justify-between">
                    <span
                      className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl transition-transform group-hover:scale-105"
                      style={{ border: `1px solid ${sel ? c.tintBorder : "#332A5A"}`, boxShadow: sel ? `0 0 16px -4px ${c.tint}` : "none" }}
                    >
                      <img src={c.img} alt="" className="h-full w-full object-cover" draggable={false} />
                    </span>
                    <span className="rounded-full border px-2.5 py-0.5 text-[11px] tabular-nums" style={{ borderColor: sel ? `${c.tint}66` : "#332A5A", color: sel ? c.tint : "#8078a8" }}>
                      {c.players}
                    </span>
                  </div>
                  <div className="font-display text-base font-bold text-text">{c.label}</div>
                  <p className="mt-1 text-sm leading-snug text-text-muted">{c.desc}</p>
                  {c.id === "draw" && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {([
                        { id: "classic", label: "Classique" },
                        { id: "fakeartist", label: "Faux-artiste" },
                        { id: "relay", label: "Relais" },
                      ] as const).map((v) => {
                        const active = sel && drawMode === v.id;
                        return (
                          <span
                            key={v.id}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setSelectedGame("draw"); setDrawMode(v.id); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setSelectedGame("draw"); setDrawMode(v.id); } }}
                            className="cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] transition-colors"
                            style={{ borderColor: active ? c.tint : "#332A5A", background: active ? c.tintBg : "#0E0B1A", color: active ? c.tint : "#A79FC7" }}
                          >
                            {v.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* settings */}
      <section className="mb-8">
        <p className="eyebrow mb-2 px-1">Réglages</p>
        {selectedGame === "subtitles" ? (
          <GameSettingsPanel settings={room.settings} isHost={isHost} onChange={room.setSettings} />
        ) : selectedGame === "doublage" ? (
          <div className="panel space-y-2 p-4 text-sm">
            <p className="text-text-muted">
              🎙️ Doublez une vidéo à plusieurs voix ! Vous choisirez la scène et vos personnages, testerez votre micro,
              puis parlerez par-dessus la vidéo synchronisée. <span className="text-text-faint">(2 joueurs minimum · micro requis)</span>
            </p>
            <p className="text-text-faint">Prototype « Doublage libre » — improvisation totale, aucun mot imposé.</p>
          </div>
        ) : selectedGame === "quiz" ? (
          <div className="cfg-grp">
            <div className="cfg-head">
              <span className="cfg-ic" style={{ background: "rgba(139,125,246,0.14)", color: "#8B7DF6", borderColor: "rgba(139,125,246,0.4)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4" /><circle cx="12" cy="17.5" r="0.7" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="9" /></svg></span>
              <div><h2 className="cfg-tt">Réglages du Quiz</h2><span className="cfg-sub">Questions mélangées · vitesse récompensée</span></div>
            </div>
            <div className="panel space-y-3 p-4">
            <p className="text-sm text-text-muted">
              🧠 Questions rapides mélangées (jeux vidéo, films, anime, sport, insolite…). Réponds vite : la vitesse rapporte plus de points !
            </p>
            <PresetStepper label="Nombre de questions" sub="Longueur de la partie" value={quizCount} values={[5, 10, 15, 20]} unit="questions" onChange={setQuizCount} disabled={!isHost} />
            <PresetStepper label="Temps par question" sub="Compte à rebours" value={quizSecs} values={[10, 15, 20, 30]} unit="secondes" onChange={setQuizSecs} disabled={!isHost} />
            <div>
              <p className="mb-2 text-sm font-medium">Type de questions</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  { id: "all", label: "Toutes" },
                  { id: "mcq", label: "QCM" },
                  { id: "truefalse", label: "Vrai / Faux" },
                  { id: "free", label: "Réponses libres" },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setQuizType(t.id)}
                    disabled={!isHost}
                    className={`rounded-lg border py-2 text-sm font-medium transition-colors ${quizType === t.id ? "border-gold bg-gold/[0.08] text-gold" : "border-ink-border bg-ink-surface"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          </div>
        ) : (selectedGame === "reco" || selectedGame === "pixel") ? (
          <div className="cfg-grp">
            <div className="cfg-head">
              <span className="cfg-ic" style={{ background: "rgba(76,201,240,0.14)", color: "#4CC9F0", borderColor: "rgba(76,201,240,0.4)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="M4 17l4.5-4 3 2.5L15 12l5 4.5" /></svg></span>
              <div><h2 className="cfg-tt">Réglages de la Reconnaissance</h2><span className="cfg-sub">Vraies images · réponse libre</span></div>
            </div>
          <div className="panel space-y-3 p-4">
            <p className="text-sm text-text-muted">
              🖼️ Une image apparaît, écris ce que c'est le plus vite possible ! (pays, animaux, objets… les petites fautes sont tolérées.)
            </p>
            <PresetStepper label="Nombre d'images" sub="Longueur de la partie" value={recoCount} values={[5, 10, 15, 20]} unit="images" onChange={setRecoCount} disabled={!isHost} />
            <PresetStepper label="Temps par image" sub={selectedGame === "pixel" ? "Vitesse de révélation" : "Compte à rebours"} value={recoSecs} values={selectedGame === "pixel" ? [45, 60, 75, 90] : [10, 15, 20, 30]} unit="secondes" onChange={setRecoSecs} disabled={!isHost} />
            <div>
              <p className="mb-2 text-sm font-medium">Catégorie</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { id: "all", label: "Toutes" },
                  { id: "Disney", label: "Disney" },
                  { id: "Animation", label: "Animation" },
                  { id: "Anime", label: "Anime" },
                  { id: "Films", label: "Films" },
                  { id: "Jeux vidéo", label: "Jeux vidéo" },
                ].map((c) => (
                  <button key={c.id} onClick={() => setRecoCat(c.id)} disabled={!isHost} className={`rounded-lg border py-2 text-sm font-medium transition-colors ${recoCat === c.id ? "border-gold bg-gold/[0.08] text-gold" : "border-ink-border bg-ink-surface"}`}>{c.label}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-text-faint">Les images viennent de ton dossier <span className="font-mono">public/reco/</span>. Une catégorie vide bascule sur « Toutes ».</p>
            </div>
          </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* MODE */}
            <div className="cfg-grp">
              <div className="cfg-head">
                <span className="cfg-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" /><path d="M18 15a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" /><rect x="2.5" y="3" width="19" height="18" rx="4" /><path d="M8 8h9" /><path d="M7 16h9" /></svg></span>
                <div><h2 className="cfg-tt">Mode de jeu</h2><span className="cfg-sub">Choisis comment vous jouez</span></div>
              </div>
              <div className="cfg-modes">
                {([
                  { id: "classic", c: "#FFC24B", nm: "Classique", ds: "Un dessine, les autres devinent. Le plus rapide marque le plus.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 5.6l3.9 3.9" /><path d="M4 20l1.3-4.4L15.7 5.2a1.9 1.9 0 0 1 2.7 0l.4.4a1.9 1.9 0 0 1 0 2.7L8.4 18.7 4 20Z" /></svg> },
                  { id: "blind", c: "#4CC9F0", nm: "Aveugle", ds: "Tu dessines sans voir ton trait 😅. Plus de temps pour compenser.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18" /><path d="M10.6 10.7a2 2 0 0 0 2.8 2.8" /><path d="M9.4 5.2A9.5 9.5 0 0 1 12 5c5 0 9 5 9 7a12 12 0 0 1-2 2.6" /><path d="M6.2 6.7C3.9 8.1 2 10.7 2 12c0 2 4 7 10 7a9 9 0 0 0 3-.5" /></svg> },
                  { id: "constraints", c: "#8B7DF6", nm: "Contraintes", ds: "Chaque dessin impose une règle absurde (une couleur, sans lever le crayon...).", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v2.5" /></svg> },
                  { id: "coop", c: "#46E0B0", nm: "Coopératif", ds: "En équipe : tous vos points sont mis en commun pour un score collectif.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 13.5 8.5 11a2 2 0 0 0-3 2.6L9 18" /><path d="m13 13.5 2.5-2.5a2 2 0 0 1 3 2.6L15 18" /><path d="M12 5.5 9.5 8 12 10.5 14.5 8Z" /></svg> },
                  { id: "fakeartist", c: "#FF6B6B", nm: "Faux-artiste", ds: "Un imposteur ignore le mot ; démasquez-le au vote.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8c3-1.5 15-1.5 18 0" /><path d="M4 8c0 5 2 7 4.5 7 1.8 0 2.6-1.2 3.5-2.5.9 1.3 1.7 2.5 3.5 2.5C18 15 20 13 20 8" /><path d="M12 15v3" /><path d="M9 20h6" /></svg> },
                  { id: "relay", c: "#4CC9F0", nm: "Relais", ds: "Deux joueurs se relaient au crayon, rotation auto.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h11a4 4 0 0 1 0 8H7" /><path d="M7 4 4 7l3 3" /><path d="M17 13l3 3-3 3" /></svg> },
                ] as const).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setDrawMode(m.id)}
                    disabled={!isHost}
                    className={`cfg-mode${drawMode === m.id ? " on" : ""}`}
                    style={{ ["--c" as any]: m.c }}
                  >
                    <span className="cfg-check"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg></span>
                    <span className="cfg-mic">{m.icon}</span>
                    <span><span className="cfg-mnm">{m.nm}</span><p className="cfg-mds">{m.ds}</p></span>
                  </button>
                ))}
              </div>
            </div>

            {/* MANCHES */}
            <div className="cfg-grp">
              <div className="cfg-head">
                <span className="cfg-ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 1 0 9 9" /><path d="M21 3v5h-5" /></svg></span>
                <div><h2 className="cfg-tt">Manches</h2><span className="cfg-sub">Réglage de la partie</span></div>
              </div>
              <div className="cfg-rounds">
                <div className="cfg-rlab"><b>Nombre de manches</b>La partie s'arrête au bout du compte</div>
                <div className="cfg-stepper">
                  <button className="cfg-sbtn" onClick={() => setDrawRounds((r) => Math.max(2, r - 1))} disabled={!isHost} aria-label="Moins"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 12h14" /></svg></button>
                  <div className="cfg-sval"><div className="cfg-svaln">{drawRounds}</div><div className="cfg-svalu">manches</div></div>
                  <button className="cfg-sbtn" onClick={() => setDrawRounds((r) => Math.min(8, r + 1))} disabled={!isHost} aria-label="Plus"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
                </div>
              </div>
            </div>

            {/* THÈMES (repliable) */}
            {drawMode !== "fakeartist" && drawMode !== "relay" && (() => {
              const selCount = drawThemes.length === 0 ? DRAW_THEMES.length : drawThemes.length;
              const allOn = drawThemes.length === 0;
              return (
                <div className="cfg-grp">
                  <button
                    onClick={() => setThemesOpen((o) => !o)}
                    className="cfg-collapse"
                    aria-expanded={themesOpen}
                  >
                    <span className="cfg-ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5V5a2 2 0 0 1 2-2h6.5a2 2 0 0 1 1.4.6l7.5 7.5a2 2 0 0 1 0 2.8l-6.6 6.6a2 2 0 0 1-2.8 0L3.6 12.9A2 2 0 0 1 3 11.5Z" /><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" /></svg></span>
                    <div className="min-w-0 flex-1"><h2 className="cfg-tt">Thèmes</h2><span className="cfg-sub">{themesOpen ? "Ce qui peut tomber" : `${selCount} sur ${DRAW_THEMES.length} sélectionnés`}</span></div>
                    <span className={`cfg-choose${themesOpen ? "" : " pulse"}`}>
                      {themesOpen ? "Fermer" : "Choisir"}
                      <svg className="chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: themesOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
                    </span>
                  </button>
                  {themesOpen && (
                    <div className="mt-3">
                      <div className="cfg-themesbar">
                        <button className="cfg-toggleall" onClick={() => setDrawThemes([])} disabled={!isHost}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>
                          Tout sélectionner
                        </button>
                        <span className="cfg-selnote"><b>{selCount}</b> thèmes sur {DRAW_THEMES.length}</span>
                      </div>
                      <div className="cfg-tags">
                        {DRAW_THEMES.map((t) => {
                          const on = allOn || drawThemes.includes(t);
                          return (
                            <button
                              key={t}
                              disabled={!isHost}
                              onClick={() =>
                                setDrawThemes((prev) => {
                                  const base = prev.length === 0 ? [...DRAW_THEMES] : prev;
                                  const next = base.includes(t) ? base.filter((x) => x !== t) : [...base, t];
                                  return next.length === DRAW_THEMES.length ? [] : next;
                                })
                              }
                              className={`cfg-tag${on ? " on" : ""}`}
                            >
                              {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>}
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {/* rules */}
      <details className="panel group mb-6 px-4 py-3">
        <summary className="flex cursor-pointer select-none items-center justify-between text-sm font-medium text-text">
          Comment jouer ?
          <span className="text-text-faint transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <ol className="mt-3 space-y-2.5 text-sm text-text-muted">
          {(selectedGame === "quiz"
            ? [
                "Une question s'affiche pour tout le monde en même temps.",
                "Réponds le plus vite possible : plus tu es rapide, plus tu marques.",
                "La bonne réponse est révélée, puis on enchaîne — le classement se met à jour à chaque manche.",
                "Le meilleur score à la fin gagne la partie !",
              ]
            : selectedGame === "reco"
              ? [
                  "Une vraie image s'affiche avec une question (« Quel est cet animal ? », etc.).",
                  "Écris ta réponse et valide (Entrée) : les petites fautes de frappe sont tolérées.",
                  "Le plus rapide à trouver marque le plus de points.",
                  "On révèle la réponse, le classement se met à jour, puis image suivante !",
                ]
              : selectedGame === "doublage"
                ? [
                    "Choisissez une scène et répartissez les personnages.",
                    "Testez votre micro, puis doublez la vidéo en direct par-dessus le son.",
                    "Improvisez les voix — aucun mot imposé, juste du fun.",
                  ]
                : selectedGame === "draw"
                  ? drawMode === "fakeartist"
                    ? [
                        "Tout le monde reçoit le même mot… sauf l'imposteur, qui l'ignore.",
                        "Chacun dessine sur SA toile ; observez les autres en direct.",
                        "À la fin, votez pour démasquer le faux-artiste.",
                      ]
                    : drawMode === "relay"
                      ? [
                          "Deux joueurs se relaient au crayon sur le même mot (rotation auto).",
                          "Les autres devinent au chat le plus vite possible.",
                          "Bonnes réponses = points, on tourne à chaque manche.",
                        ]
                      : [
                          "Un joueur dessine le mot secret ; les autres devinent au chat.",
                          "Plus on devine vite, plus on marque — le dessinateur aussi.",
                          "On tourne à chaque manche selon le mode choisi.",
                        ]
                  : [
                      "Regardez l'extrait — une scène en langue étrangère (vous ne comprenez pas : c'est fait exprès !).",
                      "Chacun invente le sous-titre le plus drôle (ou tout un dialogue selon la scène).",
                      "On revoit la scène « jouée » par chaque proposition, en anonyme.",
                      "On vote pour sa préférée (pas la sienne !). Plus on récolte de votes, plus on marque de points.",
                    ]
          ).map((t, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="font-display font-bold text-gold">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </details>

      {room.error && (
        <p className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {room.error.message}
        </p>
      )}

      {/* action dock */}
      <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] flex gap-3 rounded-2xl border border-ink-border/80 bg-[rgba(20,16,42,0.85)] p-3 backdrop-blur-md">
        <button
          onClick={() => me && room.setReady(!me.isReady)}
          disabled={!me}
          className={`arc arc-block ${me?.isReady ? "arc-sec" : "arc-ready"} disabled:opacity-40`}
        >
          {me?.isReady ? (
            "Pas prêt"
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 11-13h-8l1-7z" /></svg>
              Je suis prêt
            </>
          )}
        </button>
        {isHost &&
          (startable ? (
            <button
              onClick={() =>
                selectedGame === "subtitles"
                  ? room.startGame("subtitles")
                  : selectedGame === "doublage"
                    ? room.startGame("doublage")
                    : selectedGame === "quiz"
                      ? room.startGame("quiz", { totalQuestions: quizCount, secondsPerQuestion: quizSecs, types: quizType })
                      : selectedGame === "reco"
                        ? room.startGame("reco", { totalQuestions: recoCount, secondsPerQuestion: recoSecs, category: recoCat })
                        : selectedGame === "pixel"
                          ? room.startGame("pixel", { totalQuestions: recoCount, secondsPerQuestion: recoSecs, category: recoCat })
                          : drawMode === "fakeartist"
                            ? room.startGame("fakeartist", { totalRounds: drawRounds })
                            : drawMode === "relay"
                              ? room.startGame("relay", { totalRounds: drawRounds })
                              : room.startGame("draw", { totalRounds: drawRounds, mode: drawMode, themes: drawThemes })
              }
              className="arc arc-p arc-block"
            >
              Lancer la partie
            </button>
          ) : (
            <button disabled className="arc arc-dis arc-block">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              En attente des joueurs
            </button>
          ))}
      </div>

      {isHost && !startable && (
        <p className="mt-3 text-center text-xs text-text-faint">
          Il faut {state?.config.minReadyToStart ?? 2} joueurs prêts pour lancer.
        </p>
      )}
      {profileOpen && me && (
        <ProfileModal
          name={me.name}
          color={me.color}
          avatar={me.avatar}
          onSetName={(n) => room.setName(n)}
          onSetAvatar={(a) => room.setAvatar(a)}
          onClose={() => setProfileOpen(false)}
        />
      )}
      </main>
    </>
  );
}
