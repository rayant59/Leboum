"use client";

import { useEffect, useRef, useState } from "react";
import { clipSlots, type CaptionSlot, type PublicGameState } from "@subtitles-party/shared";
import { FilmFrame } from "./FilmFrame";

// Session-wide sound preference (persists as players move between phases).
let preferSound = true;

// Small beat between each screening replay so nobody misses a funny one.
const SCREEN_GAP_MS = 1200;

interface Sync {
  deadline: number | null;
  windowMs: number;
  startSec: number;
  serverNow: () => number;
}

function targetSec(s: Sync): number {
  if (s.deadline == null) return s.startSec;
  const startedAt = s.deadline - s.windowMs;
  return s.startSec + Math.max(0, s.serverNow() - startedAt) / 1000;
}

/**
 * Plays the round's clip.
 *  - "sync" (watching / screening): synchronised to the server clock, no
 *    controls, subtitle overlaid during screening. Starts muted (guaranteed to
 *    appear for everyone) then enables sound.
 *  - "replay" (writing): a normal player with controls, looping, so each player
 *    can re-watch the scene as many times as they like while writing.
 */
export function VideoStage({
  game,
  serverNow,
  onEnded,
}: {
  game: PublicGameState;
  serverNow: () => number;
  /** Called when the clip reaches its end (used to leave the watch phase). */
  onEnded?: () => void;
}) {
  const clip = game.clip;
  const mode: "sync" | "replay" = game.phase === "writing" ? "replay" : "sync";
  const screening = game.phase === "screening";
  const startSec = clip?.startSec ?? 0;
  const captionLines = screening ? game.captions[game.screenIndex]?.lines ?? [] : null;
  const syncKey = screening ? `s${game.screenIndex}` : "watch";
  const slots = clipSlots(clip);

  // During screening each replay begins after a short pause, so people can
  // breathe/laugh between takes. The video's play window is shifted by the gap.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!screening) return;
    const id = setInterval(() => forceTick((n) => n + 1), 150);
    return () => clearInterval(id);
  }, [screening, syncKey]);

  // A short beat ONLY when switching from one person's caption to the next —
  // never before the first replay, never mid-replay.
  const gap = screening && game.screenIndex > 0 ? SCREEN_GAP_MS : 0;
  const playWindowMs = screening
    ? Math.max(1000, game.config.screeningMs - gap)
    : game.config.watchingMs;
  const playStart =
    screening && game.deadline != null ? game.deadline - playWindowMs : null;
  const inPause = screening && gap > 0 && playStart != null ? serverNow() < playStart : false;

  const sync: Sync = { deadline: game.deadline, windowMs: playWindowMs, startSec, serverNow };

  const [soundOn, setSoundOn] = useState(preferSound);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [clip?.id]);
  const toggleSound = () => {
    preferSound = !preferSound;
    setSoundOn(preferSound);
  };

  const isYouTube = clip?.kind === "youtube" && !!clip.youtubeId;
  const hasSource = clip && (isYouTube || !!clip.url);

  if (!hasSource || failed) {
    return (
      <div className="relative">
        <FilmFrame game={game} />
        {captionLines && <TimedCaption lines={captionLines} slots={slots} sync={sync} k={syncKey} />}
      </div>
    );
  }

  // --- writing: a simple, reliable re-watch player with controls ------------
  if (mode === "replay") {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-ink-border bg-black"
        style={{ aspectRatio: "16 / 10" }}
      >
        {isYouTube ? (
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${clip!.youtubeId}?start=${Math.floor(
              startSec,
            )}&controls=1&rel=0&modestbranding=1&mute=1&autoplay=1&loop=1&playlist=${clip!.youtubeId}`}
            title="Revoir l'extrait"
            allow="autoplay; encrypted-media; picture-in-picture"
          />
        ) : (
          <video
            src={clip!.url}
            controls
            loop
            muted
            autoPlay
            playsInline
            preload="auto"
            className="h-full w-full bg-black object-contain"
            onLoadedMetadata={(e) => {
              try {
                e.currentTarget.currentTime = startSec;
              } catch {
                /* ignore */
              }
            }}
          />
        )}
        <span className="pointer-events-none absolute left-3 top-3 rounded-md border border-ink-border bg-black/60 px-2 py-1 font-mono text-[11px] tracking-widest text-text-muted">
          🔁 revois l'extrait autant que tu veux
        </span>
      </div>
    );
  }

  // --- watching / screening: synchronised playback --------------------------
  const media = isYouTube ? (
    <YouTubeStage
      key={clip!.youtubeId}
      videoId={clip!.youtubeId!}
      sync={sync}
      syncKey={syncKey}
      soundOn={soundOn}
      paused={inPause}
      onEnded={onEnded}
      onFail={() => setFailed(true)}
    />
  ) : (
    <FileStage
      key={clip!.url}
      url={clip!.url!}
      sync={sync}
      syncKey={syncKey}
      soundOn={soundOn}
      paused={inPause}
      onEnded={onEnded}
      onFail={() => setFailed(true)}
    />
  );

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-ink-border bg-black"
      style={{ aspectRatio: "16 / 10" }}
    >
      {media}
      {inPause && (
        <div className="absolute inset-0 grid place-items-center bg-ink-deep/70">
          <span className="animate-pop text-3xl">👀</span>
        </div>
      )}
      <span className="pointer-events-none absolute left-3 top-3 rounded-md border border-ink-border bg-black/55 px-2 py-1 font-mono text-[11px] tracking-widest text-text-muted">
        {clip?.lang ? `♪ ${clip.lang.toUpperCase()}` : "▶ EXTRAIT"}
      </span>
      <button
        onClick={toggleSound}
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md border border-ink-border bg-black/55 text-sm transition-colors hover:border-gold"
        title={soundOn ? "Couper le son" : "Activer le son"}
        aria-label={soundOn ? "Couper le son" : "Activer le son"}
      >
        {soundOn ? "🔊" : "🔇"}
      </button>
      {clip?.attribution && (
        <span className="pointer-events-none absolute bottom-2 right-3 max-w-[55%] truncate text-right font-mono text-[10px] text-white/40">
          {clip.attribution}
        </span>
      )}
      {captionLines && <TimedCaption lines={captionLines} slots={slots} sync={sync} k={syncKey} />}
    </div>
  );
}

// --- file playback (synced) -------------------------------------------------

function FileStage({
  url,
  sync,
  syncKey,
  soundOn,
  paused,
  onEnded,
  onFail,
}: {
  url: string;
  sync: Sync;
  syncKey: string;
  soundOn: boolean;
  paused: boolean;
  onEnded?: () => void;
  onFail: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const readyRef = useRef(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    readyRef.current = false;
    setLoading(true);
    let drift: ReturnType<typeof setInterval> | null = null;

    const seekPlay = () => {
      try {
        v.currentTime = targetSec(syncRef.current);
      } catch {
        /* metadata not ready */
      }
      v.muted = true; // muted autoplay always allowed -> video shows for everyone
      v.play()
        .then(() => {
          if (preferSound) v.muted = false;
        })
        .catch(() => {});
    };

    const start = () => {
      if (readyRef.current) return;
      readyRef.current = true;
      setLoading(false);
      if (pausedRef.current) {
        try {
          v.currentTime = targetSec(syncRef.current);
        } catch {
          /* ignore */
        }
        v.pause();
      } else {
        seekPlay();
      }
      drift = setInterval(() => {
        if (pausedRef.current || v.seeking || v.readyState < 3) return;
        const want = targetSec(syncRef.current);
        if (Math.abs(v.currentTime - want) > 1.5) v.currentTime = want;
      }, 2000);
    };

    const onError = () => onFail();
    const onPlaying = () => {
      if (preferSound) v.muted = false;
    };
    const onEnd = () => onEnded?.();

    if (v.readyState >= 2) start();
    v.addEventListener("loadeddata", start);
    v.addEventListener("canplay", start);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("ended", onEnd);
    v.addEventListener("error", onError);
    v.load();

    return () => {
      if (drift) clearInterval(drift);
      v.removeEventListener("loadeddata", start);
      v.removeEventListener("canplay", start);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("ended", onEnd);
      v.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Pause / resume for the gap between replays.
  useEffect(() => {
    const v = ref.current;
    if (!v || !readyRef.current) return;
    if (paused) {
      v.pause();
    } else {
      try {
        v.currentTime = targetSec(syncRef.current);
      } catch {
        /* ignore */
      }
      v.play().catch(() => {});
    }
  }, [paused]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !readyRef.current) return;
    v.muted = !soundOn;
    if (soundOn && !pausedRef.current) v.play().catch(() => {});
  }, [soundOn]);

  // Restart at the sync point when the caption (sub-step) changes.
  useEffect(() => {
    const v = ref.current;
    if (!v || !readyRef.current) return;
    try {
      v.currentTime = targetSec(syncRef.current);
    } catch {
      /* ignore */
    }
    if (!pausedRef.current) v.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  return (
    <>
      <video
        ref={ref}
        src={url}
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
        style={{ filter: "contrast(1.03) saturate(0.98)" }}
      />
      {loading && <LoadingOverlay />}
    </>
  );
}

// --- YouTube playback (synced) ----------------------------------------------

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => unknown };
    onYouTubeIframeAPIReady?: () => void;
    __ytPromise?: Promise<Window["YT"]>;
  }
}

function loadYT(): Promise<Window["YT"]> {
  const w = window;
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT);
  if (w.__ytPromise) return w.__ytPromise;
  w.__ytPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return w.__ytPromise;
}

function YouTubeStage({
  videoId,
  sync,
  syncKey,
  soundOn,
  paused,
  onEnded,
  onFail,
}: {
  videoId: string;
  sync: Sync;
  syncKey: string;
  soundOn: boolean;
  paused: boolean;
  onEnded?: () => void;
  onFail: () => void;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const readyRef = useRef(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let drift: ReturnType<typeof setInterval> | null = null;

    loadYT()
      .then((YT) => {
        if (cancelled || !holderRef.current || !YT) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        playerRef.current = new (YT as any).Player(holderRef.current, {
          videoId,
          playerVars: {
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            fs: 0,
            iv_load_policy: 3,
            start: Math.floor(sync.startSec),
          },
          events: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onReady: (e: any) => {
              readyRef.current = true;
              setLoading(false);
              const p = e.target;
              try {
                p.mute();
                p.seekTo(targetSec(syncRef.current), true);
                if (pausedRef.current) p.pauseVideo();
                else p.playVideo();
              } catch {
                /* ignore */
              }
              if (preferSound) {
                setTimeout(() => {
                  try {
                    p.unMute();
                    p.setVolume(100);
                  } catch {
                    /* ignore */
                  }
                }, 400);
              }
              drift = setInterval(() => {
                if (pausedRef.current) return;
                try {
                  const want = targetSec(syncRef.current);
                  const cur = p.getCurrentTime?.() ?? 0;
                  if (Math.abs(cur - want) > 1.5) p.seekTo(want, true);
                } catch {
                  /* ignore */
                }
              }, 2000);
            },
            onError: () => onFail(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onStateChange: (e: any) => {
              if (e?.data === 0) onEnded?.(); // 0 === ENDED
            },
          },
        });
      })
      .catch(() => onFail());

    return () => {
      cancelled = true;
      if (drift) clearInterval(drift);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try {
      if (paused) {
        p.pauseVideo();
      } else {
        p.seekTo(targetSec(syncRef.current), true);
        p.playVideo();
      }
    } catch {
      /* ignore */
    }
  }, [paused]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try {
      if (soundOn) {
        p.unMute();
        p.setVolume(100);
      } else {
        p.mute();
      }
    } catch {
      /* ignore */
    }
  }, [soundOn]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try {
      p.seekTo(targetSec(syncRef.current), true);
      p.playVideo();
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  return (
    <>
      <div
        ref={holderRef}
        className="pointer-events-none h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
      />
      {loading && <LoadingOverlay />}
    </>
  );
}

// --- shared bits ------------------------------------------------------------

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-ink-deep/80">
      <span className="font-mono text-sm text-text-muted">chargement de la scène…</span>
    </div>
  );
}

/** Film-style subtitle: the right line at the right moment for dialogue scenes. */
function TimedCaption({
  lines,
  slots,
  sync,
  k,
}: {
  lines: string[];
  slots: CaptionSlot[];
  sync: Sync;
  k: string;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [k]);

  const elapsed =
    sync.deadline == null ? 0 : Math.max(0, sync.serverNow() - (sync.deadline - sync.windowMs));
  const idx = slots.findIndex((sl) => elapsed >= sl.fromMs && elapsed < sl.toMs);
  const text = idx >= 0 ? lines[idx] ?? "" : "";
  if (!text) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
      <span
        key={idx}
        className="max-w-[96%] text-center text-2xl font-medium leading-tight"
        style={{
          color: "#F2C21E",
          textShadow:
            "0 0 2px #000, 0 0 4px #000, 1px 1px 2px #000, -1px 1px 2px #000, 1px -1px 2px #000, -1px -1px 2px #000",
        }}
      >
        {text}
      </span>
    </div>
  );
}
