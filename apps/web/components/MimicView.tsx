"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { MimicPublic } from "@subtitles-party/shared";
import { mimicCategoryLabel } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { SoundToggle, playSound } from "@/lib/sound";
import { ChatPanel } from "@/components/DrawGameView";
import { LB, DISPLAY, MONO, hexA, Aurora, type RailRow, lbShell, lbCard, lbGoldBtn, lbGhostBtn, topBar, LB_SCOPED_CSS } from "@/components/leboum";

// ═══════════════ Micro : permission, VU-mètre, prise unique (MediaRecorder) ══
function useMic() {
  const [status, setStatus] = useState<"idle" | "asking" | "on" | "denied">("idle");
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const mutedRef = useRef(false);

  const request = useCallback(async () => {
    if (status === "on" || status === "asking") return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) { setStatus("denied"); return; }
    setStatus("asking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AC();
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
        setLevel(mutedRef.current ? 0 : Math.min(1, peak / 90));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setStatus("on");
    } catch { setStatus("denied"); }
  }, [status]);

  const startRecording = useCallback(() => {
    if (!streamRef.current || recRef.current) return;
    try {
      chunksRef.current = [];
      const rec = new MediaRecorder(streamRef.current);
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.start();
      recRef.current = rec;
    } catch { /* enregistrement non supporté */ }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> =>
    new Promise((resolve) => {
      const rec = recRef.current;
      if (!rec) return resolve(null);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        recRef.current = null;
        resolve(blob.size ? blob : null);
      };
      try { rec.stop(); } catch { resolve(null); }
    }), []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return { status, level, request, startRecording, stopRecording };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

// Secondes restantes (fraction) — 120ms tick pour une aiguille fluide.
function useCountdown(deadline: number | null, serverNow: () => number) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 120);
    return () => clearInterval(id);
  }, []);
  if (deadline == null) return null;
  return Math.max(0, (deadline - serverNow()) / 1000);
}

// ═══════════════ Forme d'onde (générateur du spec) ══════════════════════════
function genBars(n: number, played: number, seed = 1.4) {
  const head = Math.round(n * played);
  const bars: { h: number; on: boolean; near: boolean; near4: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const env = 0.34 + 0.66 * Math.sin(Math.PI * Math.min(1, t / 0.94));
    const v = Math.abs(Math.sin(i * 1.71 + seed) * 0.54 + Math.sin(i * 0.47 + seed * 2.3) * 0.34 + Math.sin(i * 3.1 + seed) * 0.12);
    const h = Math.max(7, Math.round((0.16 + 0.84 * v) * env * 100));
    bars.push({ h, on: i < head, near: i > head - 5, near4: i > head - 4 });
  }
  return bars;
}

function Waveform({ mode, played, n, height, seed = 1.4 }: { mode: "listen" | "record"; played: number; n: number; height: number; seed?: number }) {
  const bars = genBars(n, played, seed);
  return (
    <div style={{ position: "relative", height }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 3 }}>
        {bars.map((b, i) => {
          if (mode === "listen") {
            const col = b.on ? (b.near ? "#FFE0A0" : LB.gold) : "#2E2652";
            const glow = b.on && b.near4 ? "0 0 16px 1px rgba(255,194,75,.9)" : "none";
            return <span key={i} style={{ flex: 1, minWidth: 0, height: `${b.h}%`, borderRadius: 3, background: col, boxShadow: glow }} />;
          }
          // record : fantôme gris + voix mint plus courte par-dessus
          const voiceH = b.on ? Math.round(b.h * (0.62 + 0.3 * Math.abs(Math.sin(i * 0.9 + seed * 3)))) : 0;
          const vcol = b.near4 ? "#9BF3D8" : LB.mint;
          const vglow = b.on && b.near4 ? "0 0 16px 1px rgba(70,224,176,.9)" : "none";
          return (
            <span key={i} style={{ flex: 1, minWidth: 0, position: "relative", display: "grid", placeItems: "center", height: "100%" }}>
              <span style={{ position: "absolute", height: `${b.h}%`, width: "100%", borderRadius: 3, background: "#3A3266" }} />
              {voiceH > 0 && <span style={{ position: "absolute", height: `${voiceH}%`, width: "100%", borderRadius: 3, background: vcol, boxShadow: vglow }} />}
            </span>
          );
        })}
      </div>
      {/* Tête de lecture */}
      <div style={{ position: "absolute", left: `${Math.round(played * 100)}%`, top: -14, bottom: -14, width: 2, background: mode === "listen"
          ? "linear-gradient(180deg,rgba(255,224,160,0),#FFE0A0 18%,#FFE0A0 82%,rgba(255,224,160,0))"
          : "linear-gradient(180deg,rgba(155,243,216,0),#9BF3D8 18%,#9BF3D8 82%,rgba(155,243,216,0))",
        boxShadow: mode === "listen" ? "0 0 18px 2px rgba(255,194,75,.55)" : "0 0 18px 2px rgba(70,224,176,.55)" }}>
        <span style={{ position: "absolute", top: -6, left: -3, width: 8, height: 8, borderRadius: "50%", background: mode === "listen" ? "#FFE0A0" : "#9BF3D8", boxShadow: mode === "listen" ? "0 0 10px 1px rgba(255,194,75,.8)" : "0 0 10px 1px rgba(70,224,176,.8)" }} />
      </div>
    </div>
  );
}

// Carte-plaque qui entoure l'onde.
function WavePlate({ mode, children }: { mode: "listen" | "record"; children: ReactNode }) {
  const glow = mode === "listen" ? "rgba(255,194,75,.22)" : "rgba(70,224,176,.2)";
  return (
    <div style={{ position: "relative", width: "100%", padding: "40px 36px 30px", borderRadius: 26, overflow: "hidden",
      background: mode === "listen" ? "linear-gradient(180deg,#211A44,#171130)" : "linear-gradient(180deg,#1B2440,#141A30)",
      boxShadow: `0 0 0 1px ${mode === "listen" ? "#3A2F66" : "#2F4A5E"}, inset 0 1px 0 rgba(243,238,255,.07), 0 34px 70px -44px rgba(0,0,0,.95)` }}>
      <div aria-hidden style={{ position: "absolute", left: mode === "listen" ? "46%" : "44%", top: "50%", width: 620, height: 300, transform: "translate(-50%,-50%)", borderRadius: "50%", filter: "blur(72px)", background: `radial-gradient(ellipse, ${glow}, transparent 66%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

// ═══════════════ Rail joueurs + chat ════════════════════════════════════════
function MimicRail({ kicker, heading, sub, rows, chat }: { kicker: string; heading: string; sub: string; rows: RailRow[]; chat?: ReactNode }) {
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

// Icône Phosphor speaker/mic/play (léger, currentColor).
function Icon({ id, size = 20 }: { id: "mic" | "play" | "speaker"; size?: number }) {
  const p = { fill: "currentColor" } as const;
  if (id === "mic") return <svg width={size} height={size} viewBox="0 0 256 256" {...p}><path d="M128 176a48.05 48.05 0 0 0 48-48V64a48 48 0 0 0-96 0v64a48.05 48.05 0 0 0 48 48Zm-32-112a32 32 0 0 1 64 0v64a32 32 0 0 1-64 0Zm40 143.6V232a8 8 0 0 1-16 0v-24.4A80.11 80.11 0 0 1 48 128a8 8 0 0 1 16 0a64 64 0 0 0 128 0a8 8 0 0 1 16 0a80.11 80.11 0 0 1-72 79.6Z" /></svg>;
  if (id === "play") return <svg width={size} height={size} viewBox="0 0 256 256" {...p}><path d="M232.4 114.5 88.3 26.1a16 16 0 0 0-24.3 13.5v176.8a16 16 0 0 0 24.3 13.5l144.1-88.4a15.9 15.9 0 0 0 0-27ZM80 215.4V40.6L222.5 128Z" /></svg>;
  return <svg width={size} height={size} viewBox="0 0 256 256" {...p}><path d="M155.5 24.8a8 8 0 0 0-8.4.9L77.3 80H32a16 16 0 0 0-16 16v64a16 16 0 0 0 16 16h45.3l69.8 54.3a8 8 0 0 0 12.9-6.3V32a8 8 0 0 0-4.5-7.2ZM32 96h40v64H32Zm112 107.6-56-43.6V96l56-43.6ZM208 128a39.8 39.8 0 0 1-10.6 27.2a8 8 0 0 1-11.8-10.8a24 24 0 0 0 0-32.8a8 8 0 1 1 11.8-10.8A39.8 39.8 0 0 1 208 128Zm40 0a79.9 79.9 0 0 1-20.4 53.4a8 8 0 0 1-11.9-10.6a64 64 0 0 0 0-85.6a8 8 0 1 1 11.9-10.6A79.9 79.9 0 0 1 248 128Z" /></svg>;
}

// ══════════════════════════════════════════════════════════════════════════
export function MimicView({ room }: { room: UseRoom }) {
  const game = room.game as MimicPublic;
  const you = room.you;
  const isHost = room.state?.hostId === you;
  const mic = useMic();

  const looksLikeMimic = !!game && typeof game.phase === "string" && "ranking" in game;
  if (!looksLikeMimic) {
    return (
      <main style={lbShell} className="lb-scope">
        <style dangerouslySetInnerHTML={{ __html: LB_SCOPED_CSS }} />
        <div style={lbCard}>
          <Aurora tint="rgba(255,77,141,.12)" tint2="rgba(139,125,246,.10)" />
          <div style={{ position: "relative", flex: 1, display: "grid", placeItems: "center", padding: 28, textAlign: "center" }}>
            <div>
              <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.pink, marginBottom: 8 }}>Mimic indisponible</p>
              <p style={{ color: LB.muted }}>Le serveur de jeu doit être relancé (ou redéployé) pour activer ce mode.</p>
              <button onClick={() => room.returnLobby()} style={{ marginTop: 20, border: `1px solid ${LB.line}`, background: "transparent", color: LB.muted, fontSize: 14, padding: "10px 18px", borderRadius: 12, cursor: "pointer" }}>Retour au salon</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (game.phase === "gameover") return <Final room={room} game={game} you={you} isHost={isHost} />;
  if (game.phase === "prep") return <Prep room={room} game={game} mic={mic} you={you} isHost={isHost} />;

  // Couleur d'accent : doré (écoute) sauf recording (mint) et verdict/scoreboard (mint).
  const listening = game.phase === "countdown" || game.phase === "reference";
  const accent = listening ? LB.gold : LB.mint;

  // Rail
  const byId = new Map(game.players.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "?";
  const color = (id: string) => byId.get(id)?.color ?? "#888";
  const avatarOf = (id: string) => byId.get(id)?.avatar;

  const isResult = game.phase === "scoreboard";
  const scoreOf = (id: string) => game.ranking.find((r) => r.id === id)?.score ?? 0;
  const railHeading = isResult ? "Tour terminé" : "Mimic";
  const railSub = isResult ? "points du tour" : `son n° ${game.round}`;
  const ranked = isResult ? game.ranking.map((r) => ({ id: r.id, name: r.name, color: r.color, avatar: r.avatar })) : [...game.players].sort((a, b) => scoreOf(b.id) - scoreOf(a.id));
  const railRows: RailRow[] = ranked.map((p) => {
    const isYou = p.id === you;
    let badge: { text: string; color: string } | undefined;
    let meta: { text: string; color: string } | undefined;
    if (isResult) {
      const rr = game.ranking.find((r) => r.id === p.id);
      meta = { text: rr && rr.roundVotes > 0 ? `+${rr.roundVotes}` : "0", color: rr && rr.roundVotes > 0 ? LB.gold : LB.pink };
    } else if (game.phase === "recording") {
      badge = game.submittedIds.includes(p.id) ? { text: "a fini", color: LB.mint } : { text: "micro", color: LB.pink };
    } else {
      badge = { text: "écoute", color: LB.faint };
    }
    return {
      id: p.id, name: p.name, color: p.color, avatar: p.avatar, you: isYou,
      accent: isYou ? LB.violet : undefined,
      badge, meta,
      score: scoreOf(p.id).toLocaleString("fr-FR"),
    };
  });

  const rail = <MimicRail kicker="Mimic" heading={railHeading} sub={railSub} rows={railRows} chat={<ChatPanel room={room} />} />;

  return (
    <main style={lbShell} className="lb-scope">
      <style dangerouslySetInnerHTML={{ __html: LB_SCOPED_CSS }} />
      <div style={lbCard}>
        <Aurora tint={listening ? "rgba(255,194,75,.11)" : "rgba(70,224,176,.11)"} tint2="rgba(139,125,246,.10)" />
        {rail}
        <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={topBar(accent, game.phase === "scoreboard" ? 95 : game.phase === "recording" ? 42 : game.phase === "reference" ? 58 : 32)} />
          {game.phase === "countdown" && <Countdown room={room} game={game} isHost={isHost} />}
          {game.phase === "reference" && <Listening room={room} game={game} isHost={isHost} />}
          {game.phase === "recording" && <Recording room={room} game={game} mic={mic} isHost={isHost} />}
          {game.phase === "processing" && <Processing />}
          {game.phase === "playback" && <Playback room={room} game={game} you={you} name={name} color={color} avatarOf={avatarOf} isHost={isHost} />}
          {game.phase === "voting" && <Voting room={room} game={game} you={you} isHost={isHost} />}
          {game.phase === "scoreboard" && <Verdict room={room} game={game} you={you} isHost={isHost} />}
        </div>
      </div>
    </main>
  );
}

const skipBtn = (room: UseRoom, isHost: boolean, phase: string) => (isHost && phase !== "scoreboard"
  ? <button onClick={() => room.skipPhase()} title="Passer (hôte)" style={{ border: `1px solid ${LB.line}`, background: "transparent", color: LB.muted, fontSize: 12, padding: "5px 10px", borderRadius: 8, cursor: "pointer" }}>⏭ Passer</button>
  : null);

// ═══════ 10a · COUNTDOWN ═════════════════════════════════════════════════════
function Countdown({ room, game, isHost }: { room: UseRoom; game: MimicPublic; isHost: boolean }) {
  const secs = useCountdown(game.deadline, room.serverNow);
  const n = secs == null ? 0 : Math.max(1, Math.ceil(secs));
  const prev = useRef(-1);
  useEffect(() => { if (n !== prev.current && n >= 1 && n <= 3) { playSound("tick"); prev.current = n; } }, [n]);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "16px 34px 0" }}>{skipBtn(room, isHost, game.phase)}</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".2em", color: LB.gold }}>🎧 une seule écoute</span>
        <div style={{ position: "relative", width: 220, height: 220, borderRadius: "50%", display: "grid", placeItems: "center", boxShadow: "0 0 0 2px rgba(255,194,75,.55), 0 0 90px -30px rgba(255,194,75,.9)" }}>
          <span key={n} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 112, lineHeight: 1, color: LB.gold }}>{n}</span>
          <span aria-hidden data-lb-anim style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: "0 0 0 2px #FFC24B", animation: "lbRingPulse 1.6s ease-out infinite" }} />
        </div>
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, letterSpacing: "-.01em" }}>Le son démarre pour tout le monde</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", padding: "22px 34px 26px", gap: 12 }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>Casque conseillé</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>durée du son</span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, letterSpacing: ".06em", color: LB.gold }}>0:04</span>
          <SoundToggle />
        </span>
      </div>
    </>
  );
}

// ═══════ 10b · LISTENING ═════════════════════════════════════════════════════
function Listening({ room, game, isHost }: { room: UseRoom; game: MimicPublic; isHost: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  const totalRef = useRef<number>(0);
  const secs = useCountdown(game.deadline, room.serverNow);
  useEffect(() => {
    if (totalRef.current === 0 && secs != null) totalRef.current = Math.max(0.5, secs);
    const a = audioRef.current;
    if (a && game.sound?.src) { a.currentTime = 0; a.play().then(() => setBlocked(false)).catch(() => setBlocked(true)); }
  }, [game.sound?.src]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = totalRef.current || 4;
  const played = secs == null ? 0.46 : Math.max(0, Math.min(1, 1 - secs / total));
  const cur = Math.max(0, Math.round(total - (secs ?? 0)));
  return (
    <>
      <div className="dv-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 34px 12px", flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span data-lb-anim style={{ width: 9, height: 9, borderRadius: "50%", background: LB.gold, animation: "lbPulseSoft 1.2s ease-in-out infinite" }} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26 }}>Écoute bien</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, color: LB.gold }}>0:0{cur} / 0:0{Math.round(total)}</span>
          {skipBtn(room, isHost, game.phase)}
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 34px" }}>
        <WavePlate mode="listen">
          <Waveform mode="listen" played={played} n={72} height={224} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 28 }}>
            <span style={{ flex: 1, height: 4, borderRadius: 2, background: "#2A2350", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${Math.round(played * 100)}%`, borderRadius: 2, background: "linear-gradient(90deg,rgba(255,194,75,.3),#FFC24B)" }} />
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>🎧 aucune relecture</span>
          </div>
        </WavePlate>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 34px 24px", flexWrap: "wrap" }}>
        {game.players.slice(0, 2).map((p) => (
          <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 10, borderRadius: 14, padding: "11px 15px", boxShadow: `0 0 0 1px ${LB.line}` }}>
            <Avatar name={p.name} color={p.color} avatar={p.avatar} size={28} />
            <span style={{ fontSize: 14, color: LB.muted }}>écoute</span>
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>À toi juste après</span>
      </div>
      {blocked && <div style={{ textAlign: "center", paddingBottom: 16 }}><button onClick={() => audioRef.current?.play().then(() => setBlocked(false)).catch(() => {})} className="lb-gold" style={lbGoldBtn}>▶︎ Écouter le son</button></div>}
      <audio ref={audioRef} src={game.sound?.src ?? undefined} preload="auto" />
    </>
  );
}

// ═══════ 10c · RECORDING ═════════════════════════════════════════════════════
function Recording({ room, game, mic, isHost }: { room: UseRoom; game: MimicPublic; mic: ReturnType<typeof useMic>; isHost: boolean }) {
  const secs = useCountdown(game.deadline, room.serverNow);
  const remaining = secs == null ? 0 : secs;
  const total = game.recordMs / 1000;
  const played = Math.max(0, Math.min(1, 1 - remaining / total));
  const sentRef = useRef(false);
  const startedRef = useRef(false);

  // Modes Chaîne / Duel : seuls les joueurs « actifs » enregistrent. Les autres
  // regardent (le serveur ignore de toute façon leurs prises).
  const active = game.youActive;

  const finish = useCallback(async (empty = false) => {
    if (sentRef.current) return;
    sentRef.current = true;
    let hasAudio = false;
    try {
      const blob = await mic.stopRecording();
      if (blob && !empty) { const url = await blobToDataUrl(blob); if (url.length < 260_000) { room.sendVoiceTake(game.round, url); hasAudio = true; } }
    } catch { /* ignore */ }
    room.mimicAction({ kind: "take_done", empty: !hasAudio });
  }, [mic, room, game.round]);

  // `finish` change d'identité à chaque frame (le micro re-render via son niveau).
  // On garde une réf pour que l'envoi au démontage ne dépende PAS de `finish`
  // (sinon la prise partait dès la 1re frame → la manche se terminait aussitôt).
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (active) playSound("start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Démarre l'enregistrement dès que le micro est prêt (au montage ou juste après).
  useEffect(() => {
    if (active && !startedRef.current && mic.status === "on") { startedRef.current = true; mic.startRecording(); }
  }, [active, mic.status]);
  // Fin quand le chrono atteint 0 (garde-fou ; le serveur clôt aussi au deadline).
  useEffect(() => { if (active && secs != null && secs <= 0.05 && !sentRef.current) void finish(false); }, [active, secs, finish]);
  // Envoi de la prise UNIQUEMENT au vrai démontage (changement de phase), jamais
  // sur un simple re-render.
  useEffect(() => () => { if (!sentRef.current) void finishRef.current(false); }, []);

  const done = game.youSubmitted || sentRef.current;
  const mm = (s: number) => `0:${String(Math.max(0, Math.round(s))).padStart(2, "0")}`;

  // Libellés de contexte (mode).
  const nameOf = (id: string | null) => (id ? game.players.find((p) => p.id === id)?.name ?? "?" : "?");
  const chainHint = game.mode === "chain"
    ? (game.chainHearsId ? `imite l'imitation de ${nameOf(game.chainHearsId)}` : "imite le son d'origine")
    : null;

  // Spectateur (non actif) : panneau d'attente clair selon le mode.
  if (!active) {
    const recorders = game.activeIds.map(nameOf);
    const who = game.mode === "duel"
      ? `Duel : ${recorders.join(" vs ")}`
      : game.mode === "chain"
        ? `Au tour de ${nameOf(game.chainRecorderId)} — ${chainHint}`
        : "Enregistrement en cours…";
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 34, textAlign: "center" }}>
        <span style={{ fontSize: 40 }}>🎧</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, color: LB.text }}>{who}</span>
        <span style={{ fontSize: 14, color: LB.muted }}>
          {game.mode === "duel" ? "Écoute bien : c'est toi qui votes pour la meilleure imitation." : "Écoute : la chaîne se transmet une voix après l'autre."}
        </span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: LB.mint }}>{mm(total - remaining)} / {mm(total)}</span>
        {skipBtn(room, isHost, game.phase)}
      </div>
    );
  }

  return (
    <>
      <div className="dv-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 34px 12px", flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span data-lb-anim style={{ width: 9, height: 9, borderRadius: "50%", background: LB.pink, animation: "lbPulseSoft 1.4s ease-in-out infinite" }} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26 }}>{game.mode === "chain" ? (game.chainHearsId ? `Imite ${nameOf(game.chainHearsId)}` : "Imite le son") : "Reproduis le son"}</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, color: LB.mint }}>{mm(total - remaining)} / {mm(total)}</span>
          {skipBtn(room, isHost, game.phase)}
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: "0 34px" }}>
        <div style={{ width: "100%", position: "relative" }}>
          <WavePlate mode="record">
            <div style={{ position: "absolute", top: 0, right: 0, display: "flex", gap: 10, zIndex: 2 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: LB.faint }}><span style={{ width: 14, height: 8, borderRadius: 2, background: "#3A3266" }} />son d'origine</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: LB.mint }}><span style={{ width: 14, height: 8, borderRadius: 2, background: LB.mint }} />ta voix</span>
            </div>
            <Waveform mode="record" played={played} n={72} height={196} />
            <div style={{ marginTop: 24, height: 4, borderRadius: 2, background: "#232C46", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${Math.round(played * 100)}%`, borderRadius: 2, background: "linear-gradient(90deg,rgba(70,224,176,.3),#46E0B0)" }} />
            </div>
          </WavePlate>
        </div>
        {done ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, color: LB.mint }}>Prise enregistrée ✓</p>
            <p style={{ fontSize: 13, color: LB.muted, marginTop: 4 }}>Impossible de recommencer. On attend les autres…</p>
          </div>
        ) : (
          <button onClick={() => finish(false)} aria-label="Arrêter et valider ma prise" className="lb-mic" style={{ position: "relative", width: 96, height: 96, borderRadius: "50%", border: "none", background: LB.pink, color: LB.ink, cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "0 6px 0 #A32458" }}>
            <Icon id="mic" size={36} />
            <span aria-hidden data-lb-anim style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: "0 0 0 2px #FF4D8D", animation: "lbRingPulse 1.5s ease-out infinite" }} />
          </button>
        )}
        {mic.status !== "on" && !done && <p style={{ fontSize: 12, color: LB.faint }}>Micro non autorisé — ta prise sera vide. (Ouvre en https/localhost.)</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", padding: "0 34px 24px" }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>Micro ouvert</span>
        {!done && <button onClick={() => finish(false)} className="lb-gold" style={{ ...lbGoldBtn, marginLeft: "auto" }}>J'ai fini</button>}
      </div>
    </>
  );
}

function Processing() {
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 28, textAlign: "center" }}>
      <div>
        <div data-lb-anim style={{ margin: "0 auto 14px", width: 46, height: 46, borderRadius: "50%", border: `4px solid ${LB.line}`, borderTopColor: LB.gold, animation: "lbSpin 1s linear infinite" }} />
        <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, color: LB.muted }}>On rassemble les imitations…</p>
      </div>
    </div>
  );
}

// ═══════ PLAYBACK — lecture des prises une par une ═══════════════════════════
function Playback({ room, game, you, name, color, avatarOf, isHost }: { room: UseRoom; game: MimicPublic; you: string; name: (id: string) => string; color: (id: string) => string; avatarOf: (id: string) => string | null | undefined; isHost: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pid = game.currentTakeId;
  const take = pid ? room.voiceTakes.get(`${game.round}:${pid}`) : null;
  const idx = game.playbackIndex;
  const total = game.playbackOrder.length;
  useEffect(() => { const a = audioRef.current; if (a && take) { a.currentTime = 0; a.play().catch(() => {}); } }, [take, idx]);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 34px 8px" }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26 }}>Les imitations</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>{idx + 1} / {total}</span>
          {skipBtn(room, isHost, game.phase)}
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "0 34px" }}>
        {pid && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <span style={{ boxShadow: `0 0 40px -12px ${hexA(LB.mint, 0.9)}`, borderRadius: 22 }}><Avatar name={name(pid)} color={color(pid)} avatar={avatarOf(pid)} size={84} /></span>
            <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30 }}>{name(pid)}{pid === you && <span style={{ color: LB.faint, fontWeight: 600, fontSize: 18 }}> · toi</span>}</span>
            {take
              ? <audio ref={audioRef} src={take} controls style={{ width: 280 }} />
              : <span style={{ fontSize: 13, color: LB.faint }}>(pas de prise / son indisponible)</span>}
          </div>
        )}
        {game.sound && <span style={{ fontSize: 13, color: LB.faint }}>Son à imiter : <b style={{ color: LB.text }}>{game.sound.name}</b></span>}
      </div>
      <div style={{ textAlign: "center", padding: "0 34px 24px", fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>Silence, on écoute chaque imitation</div>
    </>
  );
}

// ═══════ VOTING — vote interactif ════════════════════════════════════════════
function Voting({ room, game, you, isHost }: { room: UseRoom; game: MimicPublic; you: string; isHost: boolean }) {
  const voted = !!game.yourVote;
  // Duel : seuls les 2 duellistes sont votables, et eux ne votent pas.
  const voteTargets = game.mode === "duel" ? game.players.filter((p) => game.activeIds.includes(p.id)) : game.players;
  const canIVote = game.mode === "duel" ? !game.youActive : true;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playSrc, setPlaySrc] = useState<string | null>(null);
  const playTake = (pid: string) => {
    const t = room.voiceTakes.get(`${game.round}:${pid}`);
    if (!t) return;
    setPlaySrc(t);
    setTimeout(() => { const a = audioRef.current; if (a) { a.currentTime = 0; a.play().catch(() => {}); } }, 30);
  };
  const cat = game.sound ? mimicCategoryLabel(game.sound.category) : null;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 34px 8px" }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26 }}>{game.mode === "chain" ? "Qui a gardé le son d'origine ?" : "Vote pour la meilleure imitation"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>{game.votedIds.length}/{game.mode === "duel" ? Math.max(0, game.players.length - 2) : game.players.length} ont voté</span>
          {skipBtn(room, isHost, game.phase)}
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, padding: "0 34px" }}>
        {game.sound && <p style={{ fontSize: 13, color: LB.faint, textAlign: "center", marginBottom: 4 }}>Son : <b style={{ color: LB.text }}>{cat?.emoji} {game.sound.name}</b>{game.mode === "duel" && game.youActive ? " · tu es en duel, le salon vote" : " · pas de vote pour toi-même"}</p>}
        {voteTargets.map((p) => {
          const isYou = p.id === you;
          const picked = game.yourVote === p.id;
          const hasTake = !!room.voiceTakes.get(`${game.round}:${p.id}`);
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", borderRadius: 18, background: picked ? hexA(LB.gold, 0.1) : "transparent", boxShadow: picked ? `0 0 0 2px ${hexA(LB.gold, 0.6)}` : `0 0 0 1px ${LB.line}`, opacity: isYou ? 0.55 : 1 }}>
              <button onClick={() => playTake(p.id)} disabled={!hasTake} aria-label={`Réécouter ${p.name}`} style={{ display: "grid", placeItems: "center", width: 44, height: 44, flex: "none", borderRadius: 14, border: "none", background: "transparent", color: hasTake ? LB.muted : LB.dim, boxShadow: `inset 0 0 0 1px ${LB.line}`, cursor: hasTake ? "pointer" : "default" }}><Icon id="play" size={18} /></button>
              <Avatar name={p.name} color={p.color} avatar={p.avatar} size={34} />
              <span style={{ flex: 1, minWidth: 0, fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{isYou && <span style={{ color: LB.faint, fontWeight: 600 }}> · toi</span>}</span>
              {picked
                ? <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: LB.gold }}>⭐ voté</span>
                : <button onClick={() => room.mimicAction({ kind: "vote", targetId: p.id })} disabled={isYou || voted || !canIVote} className={isYou || voted || !canIVote ? undefined : "lb-gold"} style={isYou || voted || !canIVote
                    ? { flex: "none", border: `1px solid ${LB.line}`, background: "transparent", color: LB.faint, fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, padding: "10px 16px", borderRadius: 12, cursor: "default" }
                    : { flex: "none", border: "none", borderRadius: 12, padding: "11px 18px", fontFamily: DISPLAY, fontWeight: 700, fontSize: 14, background: LB.gold, color: LB.ink, cursor: "pointer", boxShadow: `0 4px 0 ${LB.goldSh}` }}>{game.votedIds.includes(p.id) ? "a voté" : "Voter ⭐"}</button>}
            </div>
          );
        })}
      </div>
      <div style={{ height: 16 }} />
      <audio ref={audioRef} src={playSrc ?? undefined} preload="auto" />
    </>
  );
}

// ═══════ 10d · VERDICT (scoreboard, basé sur les votes) ══════════════════════
function Verdict({ room, game, you, isHost }: { room: UseRoom; game: MimicPublic; you: string; isHost: boolean }) {
  useEffect(() => { playSound("reveal"); }, []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playSrc, setPlaySrc] = useState<string | null>(null);
  const play = (src?: string | null) => { if (!src) return; setPlaySrc(src); setTimeout(() => audioRef.current?.play().catch(() => {}), 30); };
  const maxVotes = Math.max(1, ...game.ranking.map((r) => r.roundVotes));
  const winner = game.ranking.find((r) => r.isBest) ?? game.ranking[0];
  const barColor = (frac: number) => frac >= 0.8 ? LB.mint : frac >= 0.6 ? LB.gold : frac >= 0.4 ? LB.muted : LB.pink;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 34px 8px" }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26 }}>Mimic</span>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em", color: LB.faint }}>{game.round >= game.totalRounds ? "fin de partie" : `son n° ${game.round + 1} dans un instant`}</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, padding: "0 34px" }}>
        {game.ranking.map((r) => {
          const frac = r.roundVotes / maxVotes;
          const col = barColor(frac);
          const best = r.isBest;
          const take = room.voiceTakes.get(`${game.round}:${r.id}`);
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 18, background: best ? hexA(LB.mint, 0.09) : "transparent", boxShadow: best ? `0 0 0 2px ${hexA(LB.mint, 0.5)}` : `0 0 0 1px ${LB.line}` }}>
              <button onClick={() => play(take)} disabled={!take} aria-label={`Réécouter ${r.name}`} style={{ display: "grid", placeItems: "center", width: 44, height: 44, flex: "none", borderRadius: 14, border: "none", background: best ? LB.mint : "transparent", color: best ? LB.ink : (take ? LB.muted : LB.dim), boxShadow: best ? "none" : `inset 0 0 0 1px ${LB.line}`, cursor: take ? "pointer" : "default" }}><Icon id="play" size={18} /></button>
              <Avatar name={r.name} color={r.color} avatar={r.avatar} size={34} />
              <span style={{ width: 104, flex: "none", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}{r.id === you && <span style={{ color: LB.faint }}> · toi</span>}</span>
              <span style={{ flex: 1, height: 12, borderRadius: 6, background: LB.lineFaint, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${Math.round(frac * 100)}%`, borderRadius: 6, background: col, transition: "width .4s ease" }} />
              </span>
              <span style={{ width: 64, textAlign: "right", flex: "none", fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, color: col }}>{r.roundVotes}<span style={{ fontSize: 13 }}> ⭐</span></span>
              <span style={{ width: 46, textAlign: "right", flex: "none", fontFamily: DISPLAY, fontWeight: 800, fontSize: 18, color: r.roundVotes > 0 ? LB.gold : LB.faint }}>{r.roundVotes > 0 ? `+${r.roundVotes}` : "0"}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 34px 24px", flexWrap: "wrap" }}>
        {game.sound?.src && <button onClick={() => play(game.sound?.src)} className="lb-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 8, border: `1px solid ${LB.line}`, background: "transparent", color: LB.muted, fontSize: 14, padding: "13px 20px", borderRadius: 12, cursor: "pointer" }}><Icon id="play" size={17} />Réécouter l'original</button>}
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em", color: LB.mint }}>🏆 {winner?.name} remporte le tour</span>
        {isHost && <button onClick={() => room.mimicAction({ kind: "next" })} className="lb-gold" style={lbGoldBtn}>{game.round >= game.totalRounds ? "Podium 🏆" : "Suivant →"}</button>}
      </div>
      <audio ref={audioRef} src={playSrc ?? undefined} preload="auto" />
    </>
  );
}

// ═══════ 10e · FINAL ═════════════════════════════════════════════════════════
function Final({ room, game, you, isHost }: { room: UseRoom; game: MimicPublic; you: string; isHost: boolean }) {
  const ranked = [...game.ranking];
  const winner = ranked[0];
  const rows: RailRow[] = ranked.map((p, i) => ({
    id: p.id, name: p.name, color: p.color, avatar: p.avatar, you: p.id === you,
    rank: i + 1, accent: i === 0 ? LB.gold : p.id === you ? LB.violet : undefined,
    score: (p.score ?? 0).toLocaleString("fr-FR"),
  }));
  return (
    <main style={lbShell} className="lb-scope">
      <style dangerouslySetInnerHTML={{ __html: LB_SCOPED_CSS }} />
      <div style={lbCard}>
        <Aurora tint="rgba(255,194,75,.14)" tint2="rgba(139,125,246,.10)" />
        <MimicRail kicker="Classement" heading="Partie terminée" sub={`${game.totalRounds} sons`} rows={rows} />
        <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={topBar(LB.gold)} />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 34 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, textAlign: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: LB.faint }}>🎧 Meilleure oreille</span>
              <span style={{ boxShadow: `0 0 60px -18px ${hexA(LB.gold, 1)}`, borderRadius: 22 }}><Avatar name={winner?.name ?? "?"} color={winner?.color ?? LB.violet} avatar={winner?.avatar} size={92} /></span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 58, letterSpacing: "-.02em", lineHeight: 1 }}>{winner?.name ?? "—"}</span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, color: LB.gold }}>{(winner?.score ?? 0).toLocaleString("fr-FR")} points</span>
              <div style={{ display: "flex", alignItems: "stretch", marginTop: 4 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 26px" }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28 }}>{(winner?.score ?? 0)}</span>
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>votes cumulés</span>
                </div>
                <div style={{ width: 1, background: "linear-gradient(180deg,transparent,rgba(243,238,255,.16),transparent)" }} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 26px" }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28 }}>{game.totalRounds}</span>
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint }}>sons joués</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "0 34px 30px" }}>
            {isHost ? (
              <>
                <button onClick={() => room.returnLobby()} className="lb-ghost" style={lbGhostBtn}>Salon</button>
                <button onClick={() => room.playAgain()} className="lb-gold" style={lbGoldBtn}>Rejouer</button>
              </>
            ) : <span style={{ fontSize: 14, color: LB.muted }}>En attente de l'hôte…</span>}
          </div>
        </div>
      </div>
    </main>
  );
}

// ═══════ PREP — test micro + prêt (hors spec, gardé fonctionnel) ═════════════
function Prep({ room, game, mic, you, isHost }: { room: UseRoom; game: MimicPublic; mic: ReturnType<typeof useMic>; you: string; isHost: boolean }) {
  const ready = you ? !!game.ready[you] : false;
  return (
    <main style={lbShell} className="lb-scope">
      <style dangerouslySetInnerHTML={{ __html: LB_SCOPED_CSS }} />
      <div style={lbCard}>
        <Aurora tint="rgba(255,194,75,.11)" tint2="rgba(139,125,246,.10)" />
        <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={topBar(LB.gold, 20)} />
          <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 28 }}>
            <div style={{ width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26 }}>🎧 Prépare-toi à imiter</p>
                <p style={{ fontSize: 14, color: LB.muted, marginTop: 6 }}>Un son sera joué une seule fois pour tout le monde. Imite-le à la voix en une prise — les autres votent pour la meilleure.</p>
              </div>
              <div style={{ padding: 18, borderRadius: 18, background: LB.surface, boxShadow: `0 0 0 1px ${LB.line}` }}>
                <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.gold, marginBottom: 12 }}>Ton microphone</p>
                {mic.status === "on" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 14, color: LB.mint }}>Micro détecté ✓</span>
                    <span style={{ flex: 1, height: 10, borderRadius: 99, background: LB.ink, overflow: "hidden" }}><span style={{ display: "block", height: "100%", borderRadius: 99, background: LB.mint, width: `${Math.round(mic.level * 100)}%` }} /></span>
                  </div>
                ) : mic.status === "denied" ? (
                  <p style={{ fontSize: 13, color: LB.muted }}>Micro indisponible (souvent en http sur IP locale). Ouvre en https ou sur localhost pour enregistrer.</p>
                ) : (
                  <button onClick={mic.request} className="lb-gold" style={lbGoldBtn}>{mic.status === "asking" ? "Autorisation…" : "🎙️ Tester mon micro"}</button>
                )}
              </div>
              <div style={{ padding: 14, borderRadius: 18, background: LB.surface, boxShadow: `0 0 0 1px ${LB.line}` }}>
                <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: LB.faint, marginBottom: 10 }}>Joueurs</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {game.players.map((p) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                      <Avatar name={p.name} color={p.color} avatar={p.avatar} size={24} />
                      <span style={{ flex: 1 }}>{p.name}{p.id === you && <span style={{ color: LB.faint }}> · toi</span>}</span>
                      <span style={{ color: game.ready[p.id] ? LB.mint : LB.faint, fontSize: 13 }}>{game.ready[p.id] ? "prêt ✓" : "…"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => room.mimicAction({ kind: "ready", ready: !ready })} className={ready ? undefined : "lb-gold"} style={ready
                ? { border: `1px solid ${hexA(LB.mint, 0.5)}`, background: hexA(LB.mint, 0.1), color: LB.mint, fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, padding: "14px", borderRadius: 14, cursor: "pointer", width: "100%" }
                : { ...lbGoldBtn, width: "100%" }}>{ready ? "Prêt ✓" : "Je suis prêt"}</button>
              {isHost && <button onClick={() => room.mimicAction({ kind: "start" })} disabled={!game.allReady} className="lb-gold" style={{ ...lbGoldBtn, width: "100%", opacity: game.allReady ? 1 : 0.4 }}>Lancer la 1re manche</button>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
