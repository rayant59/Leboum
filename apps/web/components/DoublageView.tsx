"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DoublagePublic, DoublageVideo } from "@subtitles-party/shared";
import { DOUBLAGE_VIDEOS } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { BoumBackdrop } from "@/components/BoumBackdrop";
import { Avatar } from "@/components/Avatar";
import { SoundToggle } from "@/lib/sound";

// --- Microphone: permission, live level meter, mute, timestamped recording ---
function useMicrophone() {
  const [status, setStatus] = useState<"idle" | "asking" | "on" | "denied">("idle");
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);

  const request = async () => {
    if (status === "on") return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      // http on a LAN IP is not a secure context → mic API unavailable.
      setStatus("denied");
      return;
    }
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
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
        setLevel(muted ? 0 : Math.min(1, peak / 90));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setStatus("on");
    } catch {
      setStatus("denied");
    }
  };

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  };

  const startRecording = () => {
    if (!streamRef.current || recRef.current) return;
    try {
      chunksRef.current = [];
      const rec = new MediaRecorder(streamRef.current);
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.start();
      recRef.current = rec;
    } catch {
      /* recording unsupported */
    }
  };
  const stopRecording = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const rec = recRef.current;
      if (!rec) return resolve(null);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        recRef.current = null;
        resolve(blob.size ? blob : null);
      };
      rec.stop();
    });

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { status, muted, level, request, toggleMute, startRecording, stopRecording };
}

/** Shared "who is talking" bar for every player (driven by broadcast signals). */
function SpeakingBar({ room, you, localSpeaking }: { room: UseRoom; you: string | null; localSpeaking: boolean }) {
  const game = room.game as DoublagePublic;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {game.players.map((p) => {
        const cid = Object.entries(game.assignments).find(([, pid]) => pid === p.id)?.[0];
        const cname = game.characters.find((c) => c.id === cid)?.name;
        const active = room.speakingIds.has(p.id) || (p.id === you && localSpeaking);
        return (
          <span
            key={p.id}
            className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm transition-all ${active ? "border-mint bg-mint/15 shadow-[0_0_0_2px_rgba(70,224,176,0.4)]" : "border-ink-border"}`}
          >
            <span className={`rounded-lg ${active ? "ring-2 ring-mint" : ""}`}>
              <Avatar name={p.name} color={p.color} avatar={p.avatar} size={26} />
            </span>
            <span className="font-medium">{p.name}{p.id === you && " (toi)"}</span>
            {cname && <span className="text-text-faint">· {cname}</span>}
            {active && <span className="text-mint">🔊</span>}
          </span>
        );
      })}
    </div>
  );
}

/** Host: use any video by path/URL (e.g. /le-nom.mp4) with N voices. */
function CustomVideoField({ room }: { room: UseRoom }) {
  const [src, setSrc] = useState("");
  const [count, setCount] = useState(2);
  const use = () => {
    const s = src.trim();
    if (!s) return;
    room.doublageAction({ kind: "custom_video", src: s, title: "Ma vidéo", characterCount: count });
  };
  return (
    <div className="mt-3 rounded-xl border border-ink-border bg-ink-deep p-3">
      <p className="mb-1.5 text-xs text-text-muted">Ou utilise ta propre vidéo (chemin ou URL) :</p>
      <div className="flex flex-wrap gap-2">
        <input
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && use()}
          placeholder="/le-nom.mp4  ou  https://…/video.mp4"
          className="min-w-0 flex-1 rounded-lg border border-ink-border bg-ink-surface px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <label className="flex items-center gap-1 text-xs text-text-faint">
          voix
          <input type="number" min={1} max={8} value={count} onChange={(e) => setCount(Math.max(1, Math.min(8, Number(e.target.value) || 2)))} className="w-14 rounded-lg border border-ink-border bg-ink-surface px-2 py-2 text-sm" />
        </label>
        <button onClick={use} className="rounded-lg bg-gold px-3 py-2 text-sm font-bold text-ink-deep">Utiliser</button>
      </div>
      <p className="mt-1 text-[11px] text-text-faint">Astuce : place ton fichier dans <code className="rounded bg-ink-surface px-1">apps/web/public/</code> et mets <code className="rounded bg-ink-surface px-1">/mon-fichier.mp4</code>.</p>
    </div>
  );
}

/** Video preview with a clear error if the file can't be loaded. */
function ScenePreview({ src }: { src: string | null }) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [src]);
  if (!src) return <p className="mt-3 text-sm text-text-faint">Aucune scène sélectionnée.</p>;
  if (err)
    return (
      <div className="mt-3 grid aspect-video place-items-center rounded-xl border border-magenta/40 bg-ink-surface p-4 text-center text-sm text-magenta">
        Vidéo introuvable ({src}). Choisis « Scène test (intégrée) » ou vérifie le fichier.
      </div>
    );
  return (
    <video
      key={src}
      src={src}
      className="mt-3 aspect-video w-full rounded-xl border border-ink-border bg-black"
      controls
      muted
      playsInline
      preload="metadata"
      onError={() => setErr(true)}
    />
  );
}

function LevelMeter({ level }: { level: number }) {
  return (
    <div className="h-2 w-28 overflow-hidden rounded-full bg-ink-deep">
      <div className="h-full rounded-full bg-mint transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
    </div>
  );
}

function MicControls({ mic }: { mic: ReturnType<typeof useMicrophone> }) {
  if (mic.status === "idle" || mic.status === "asking")
    return (
      <button onClick={mic.request} className="rounded-xl bg-gold px-4 py-2 font-display font-bold text-ink-deep">
        {mic.status === "asking" ? "Autorisation…" : "🎙️ Autoriser le micro"}
      </button>
    );
  if (mic.status === "denied")
    return (
      <p className="text-sm text-text-muted">
        Micro indisponible (souvent parce que l'adresse est en <b>http://IP</b> sur le réseau local). <b>Pas grave : tu peux jouer sans micro</b> — parlez à voix haute. Pour l'activer, ouvre le jeu sur <b>http://localhost:3000</b> ou en HTTPS.
      </p>
    );
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={mic.toggleMute}
        className={`rounded-xl border px-4 py-2 font-medium transition-colors ${mic.muted ? "border-magenta text-magenta" : "border-mint text-mint"}`}
      >
        {mic.muted ? "🔇 Micro coupé" : "🎙️ Micro actif"}
      </button>
      <LevelMeter level={mic.level} />
    </div>
  );
}

export function DoublageView({ room }: { room: UseRoom }) {
  const game = room.game as DoublagePublic;
  const you = room.you;
  const isHost = room.state?.hostId === you;
  const mic = useMicrophone();
  // Broadcast a lightweight "I'm talking" signal (with hysteresis) so everyone
  // sees who is speaking — no audio is shared.
  const spokenRef = useRef(false);
  useEffect(() => {
    const talking = mic.status === "on" && !mic.muted && mic.level > 0.14;
    const silent = mic.muted || mic.status !== "on" || mic.level < 0.08;
    if (talking && !spokenRef.current) {
      spokenRef.current = true;
      room.sendSpeaking(true);
    } else if (spokenRef.current && silent) {
      spokenRef.current = false;
      room.sendSpeaking(false);
    }
  }, [mic.level, mic.muted, mic.status, room]);
  useEffect(() => () => room.sendSpeaking(false), [room]);
  const video = useMemo<DoublageVideo | undefined>(() => DOUBLAGE_VIDEOS.find((v) => v.id === game?.videoId), [game]);

  // If the game-server wasn't restarted after adding this module, the room falls
  // back to another game and this view receives the wrong data. Guide the user
  // instead of crashing on a blank screen.
  const looksLikeDoublage = !!game && Array.isArray(game.characters) && ["prep", "dubbing", "result"].includes(game.phase);
  if (!looksLikeDoublage) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="eyebrow mb-2 text-magenta">Doublage indisponible</p>
        <p className="text-text-muted">Le serveur de jeu doit être relancé pour activer ce mode.</p>
        <p className="mt-3 text-sm text-text-faint">
          Dans le terminal du serveur : arrête-le (Ctrl+C) puis relance{" "}
          <code className="rounded bg-ink-surface px-1.5 py-0.5">npm run dev:server</code>, et relance la partie.
        </p>
        <button onClick={() => room.returnLobby()} className="mt-5 rounded-xl border border-ink-border px-4 py-2 text-sm text-text-muted hover:border-gold hover:text-text">
          Retour au salon
        </button>
      </main>
    );
  }

  const byId = new Map(game.players.map((p) => [p.id, p]));
  const character = game.characters.find((c) => c.id === game.yourCharacterId) ?? null;

  return (
    <>
      <BoumBackdrop />
      <main className="relative z-[1] mx-auto max-w-5xl px-4 py-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="mb-4 flex items-center justify-between">
        <span className="eyebrow">🎙️ Doublage · {game.phase === "prep" ? "préparation" : game.phase === "dubbing" ? "en scène" : "résultat"}</span>
        <div className="flex items-center gap-2">
          {mic.status === "on" && (
            <button
              onClick={mic.toggleMute}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${mic.muted ? "border-magenta text-magenta" : "border-mint text-mint"}`}
              title={mic.muted ? "Réactiver ton micro" : "Couper ton micro"}
            >
              {mic.muted ? "🔇 Micro coupé" : "🎙️ Micro"}
            </button>
          )}
          <SoundToggle />
        </div>
      </div>

      {game.phase === "prep" && <PrepRoom room={room} game={game} mic={mic} isHost={isHost} you={you} byId={byId} video={video} />}
      {(game.phase === "dubbing" || game.phase === "result") && (
        <DubStage room={room} game={game} mic={mic} isHost={isHost} you={you} byId={byId} character={character?.name ?? null} />
      )}
      </main>
    </>
  );
}

function PrepRoom({
  room,
  game,
  mic,
  isHost,
  you,
  byId,
  video,
}: {
  room: UseRoom;
  game: DoublagePublic;
  mic: ReturnType<typeof useMicrophone>;
  isHost: boolean;
  you: string | null;
  byId: Map<string, { name: string; color: string; avatar?: string | null }>;
  video?: DoublageVideo;
}) {
  const ready = you ? !!game.ready[you] : false;
  return (
    <div className="animate-pop grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="panel p-4">
          <p className="eyebrow mb-2 text-gold">Scène</p>
          {isHost ? (
            <div className="flex flex-wrap gap-2">
              {DOUBLAGE_VIDEOS.filter((v) => v.id === "scene-test" || v.src.startsWith("http")).map((v) => (
                <button
                  key={v.id}
                  onClick={() => room.doublageAction({ kind: "pick_video", videoId: v.id })}
                  className={`rounded-xl border px-4 py-2 text-sm transition-colors ${game.videoId === v.id ? "border-gold bg-gold/[0.08] text-gold" : "border-ink-border bg-ink-surface hover:border-gold/50"}`}
                >
                  {v.title} <span className="text-text-faint">· {v.characters.length} perso.</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="font-semibold">{game.videoTitle ?? "En attente du choix de l'hôte…"}</p>
          )}
          {isHost && <CustomVideoField room={room} />}
          <ScenePreview src={game.videoSrc} />
        </div>

        <div className="panel p-4">
          <p className="eyebrow mb-3 text-gold">Personnages</p>
          <div className="space-y-2">
            {game.characters.map((c) => {
              const pid = game.assignments[c.id];
              const p = pid ? byId.get(pid) : null;
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-ink-border bg-ink-surface p-2.5">
                  <span className="w-28 font-display font-bold">{c.name}</span>
                  {p ? (
                    <span className="flex flex-1 items-center gap-2">
                      <Avatar name={p.name} color={p.color} avatar={p.avatar} size={28} />
                      <span className="font-medium">{p.name}{pid === you && " (toi)"}</span>
                    </span>
                  ) : (
                    <span className="flex-1 text-sm text-text-faint">Non attribué</span>
                  )}
                  {isHost && (
                    <select
                      value={pid ?? ""}
                      onChange={(e) => room.doublageAction({ kind: "assign", characterId: c.id, playerId: e.target.value || null })}
                      className="rounded-lg border border-ink-border bg-ink-deep px-2 py-1 text-sm"
                    >
                      <option value="">—</option>
                      {game.players.map((pl) => (
                        <option key={pl.id} value={pl.id}>{pl.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="panel p-4">
          <p className="eyebrow mb-3 text-gold">Ton micro <span className="text-text-faint">· facultatif</span></p>
          <MicControls mic={mic} />
          <p className="mt-2 text-xs text-text-faint">Le micro sert juste à l'indicateur « qui parle ». Tu peux très bien jouer <b>sans</b> : parlez à voix haute (même pièce ou appel vocal).</p>
          <p className="mt-1 text-xs text-gold/80">💡 À 2 sur le même PC : coupe le micro d'un des deux onglets (bouton 🎙️) pour éviter l'écho.</p>
          <div className="mt-3">
            <SpeakingBar room={room} you={you} localSpeaking={mic.level > 0.14 && !mic.muted} />
          </div>
        </div>
        <button
          onClick={() => room.doublageAction({ kind: "ready", ready: !ready })}
          className={`arc arc-block ${ready ? "arc-ready" : "arc-sec"}`}
        >
          {ready ? "Prêt ✓" : "Je suis prêt"}
        </button>
        {isHost && (
          <button
            onClick={() => room.doublageAction({ kind: "start" })}
            disabled={!game.allReady || !game.videoId}
            className="arc arc-p arc-block disabled:opacity-40"
          >
            Lancer la scène
          </button>
        )}
        <div className="panel p-3 text-sm">
          <p className="eyebrow mb-2">Participants</p>
          <div className="space-y-1.5">
            {game.players.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <Avatar name={p.name} color={p.color} avatar={p.avatar} size={24} />
                <span className="flex-1">{p.name}</span>
                <span className={game.ready[p.id] ? "text-mint" : "text-text-faint"}>{game.ready[p.id] ? "prêt" : "…"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DubStage({
  room,
  game,
  mic,
  isHost,
  you,
  byId,
  character,
}: {
  room: UseRoom;
  game: DoublagePublic;
  mic: ReturnType<typeof useMicrophone>;
  isHost: boolean;
  you: string | null;
  byId: Map<string, { name: string; color: string; avatar?: string | null }>;
  character: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true); // muted by default so autoplay works for everyone
  const [origVolume, setOrigVolume] = useState(0.4);
  const [videoErr, setVideoErr] = useState(false);
  const [blocked, setBlocked] = useState(false); // autoplay was blocked → needs a tap
  const myTrackUrl = useRef<string | null>(null);
  const [hasTrack, setHasTrack] = useState(false);

  // Keep the local <video> in sync with the server-authoritative playback state.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const target = (game.playback.playing ? game.playback.positionMs + (room.serverNow() - game.playback.anchor) : game.playback.positionMs) / 1000;
    if (Math.abs(v.currentTime - target) > 0.35) v.currentTime = Math.max(0, target);
    if (game.playback.playing) {
      v.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    } else v.pause();
  }, [game.playback, room]);

  // Apply mute / volume to the element.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    v.volume = origVolume;
  }, [muted, origVolume]);

  const tapToPlay = () => {
    const v = videoRef.current;
    if (v) v.play().then(() => setBlocked(false)).catch(() => {});
  };

  // Record my voice while the scene plays; save a local track for the result.
  useEffect(() => {
    if (game.phase === "dubbing" && game.playback.playing && mic.status === "on") mic.startRecording();
    if (game.phase === "result") {
      void mic.stopRecording().then((blob) => {
        if (blob) {
          myTrackUrl.current = URL.createObjectURL(blob);
          setHasTrack(true);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase, game.playback.playing, mic.status]);

  const speaking = mic.level > 0.12 && !mic.muted;

  return (
    <div className="animate-pop space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-ink-border bg-black">
        {game.videoSrc ? (
          <video ref={videoRef} src={game.videoSrc} className="aspect-video w-full" playsInline muted={muted} controls onError={() => setVideoErr(true)} />
        ) : (
          <div className="grid aspect-video place-items-center text-text-faint">Aucune vidéo</div>
        )}
        {blocked && game.playback.playing && (
          <button onClick={tapToPlay} className="absolute inset-0 grid place-items-center bg-black/55 text-center">
            <span className="rounded-xl bg-gold px-5 py-3 font-display font-bold text-ink-deep">▶︎ Appuie pour lancer la vidéo</span>
          </button>
        )}
        {videoErr && <p className="p-2 text-center text-sm text-magenta">Vidéo introuvable ({game.videoSrc}). Reviens au salon et choisis « Scène test (intégrée) ».</p>}
      </div>

      {character && (
        <div className="text-center">
          <span className="eyebrow text-magenta">Ton personnage</span>{" "}
          <span className="font-display text-lg font-bold">{character}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <MicControls mic={mic} />
        <button
          onClick={() => setMuted((m) => !m)}
          className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${muted ? "border-ink-border text-text-muted hover:border-gold" : "border-gold text-gold"}`}
        >
          {muted ? "🔊 Activer le son original" : "🔇 Couper le son original"}
        </button>
        {!muted && (
          <label className="flex items-center gap-2 text-sm text-text-muted">
            Volume
            <input type="range" min={0} max={1} step={0.05} value={origVolume} onChange={(e) => setOrigVolume(Number(e.target.value))} />
          </label>
        )}
      </div>

      {/* who's speaking — all players */}
      <div>
        <p className="eyebrow mb-2 text-center text-text-faint">Qui parle</p>
        <SpeakingBar room={room} you={you} localSpeaking={speaking} />
      </div>

      {isHost && game.phase === "dubbing" && (
        <div className="flex justify-center gap-2">
          {game.playback.playing ? (
            <button onClick={() => room.doublageAction({ kind: "control", op: "pause" })} className="rounded-lg border border-ink-border px-4 py-2 text-sm hover:border-gold">Pause</button>
          ) : (
            <button onClick={() => room.doublageAction({ kind: "control", op: "play" })} className="rounded-lg border border-ink-border px-4 py-2 text-sm hover:border-gold">Reprendre</button>
          )}
          <button onClick={() => room.doublageAction({ kind: "control", op: "restart" })} className="rounded-lg border border-ink-border px-4 py-2 text-sm hover:border-gold">Recommencer</button>
          <button onClick={() => room.doublageAction({ kind: "to_result" })} className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-ink-deep">Terminer la scène</button>
        </div>
      )}

      {game.phase === "result" && (
        <div className="space-y-3 text-center">
          <p className="eyebrow text-gold">Résultat</p>
          <p className="text-sm text-text-muted">Regardez votre doublage ! (relecture synchronisée)</p>
          {hasTrack && myTrackUrl.current && (
            <div>
              <p className="mb-1 text-xs text-text-faint">Ta piste enregistrée :</p>
              <audio src={myTrackUrl.current} controls className="mx-auto" />
            </div>
          )}
          {isHost && (
            <div className="flex justify-center gap-2">
              <button onClick={() => room.doublageAction({ kind: "control", op: "restart" })} className="rounded-lg border border-ink-border px-4 py-2 text-sm hover:border-gold">Rejouer la vidéo</button>
              <button onClick={() => room.doublageAction({ kind: "to_prep" })} className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-ink-deep">Nouvelle scène</button>
            </div>
          )}
        </div>
      )}
      {void byId}
    </div>
  );
}
