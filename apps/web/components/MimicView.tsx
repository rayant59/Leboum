"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MimicPublic } from "@subtitles-party/shared";
import { mimicCategoryLabel } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { BoumBackdrop } from "@/components/BoumBackdrop";
import { ResultsScreen } from "@/components/ResultsScreen";
import { SoundToggle, playSound } from "@/lib/sound";

// --- Micro : permission, VU-mètre, enregistrement d'une prise (MediaRecorder) ---
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
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
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
    } catch {
      setStatus("denied");
    }
  }, [status]);

  const startRecording = useCallback(() => {
    if (!streamRef.current || recRef.current) return;
    try {
      chunksRef.current = [];
      const rec = new MediaRecorder(streamRef.current);
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.start();
      recRef.current = rec;
    } catch {
      /* enregistrement non supporté */
    }
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

function useCountdown(deadline: number | null, serverNow: () => number) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 120);
    return () => clearInterval(id);
  }, []);
  if (deadline == null) return null;
  return Math.max(0, (deadline - serverNow()) / 1000);
}

export function MimicView({ room }: { room: UseRoom }) {
  const game = room.game as MimicPublic;
  const you = room.you;
  const isHost = room.state?.hostId === you;
  const mic = useMic();

  const looksLikeMimic = !!game && typeof game.phase === "string" && "ranking" in game;
  if (!looksLikeMimic) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="eyebrow mb-2 text-magenta">Mimic Boum indisponible</p>
        <p className="text-text-muted">Le serveur de jeu doit être relancé (ou redéployé) pour activer ce mode.</p>
        <button onClick={() => room.returnLobby()} className="mt-5 rounded-xl border border-ink-border px-4 py-2 text-sm text-text-muted hover:border-gold hover:text-text">Retour au salon</button>
      </main>
    );
  }

  if (game.phase === "gameover") return <GameOver room={room} game={game} you={you} isHost={isHost} />;

  return (
    <>
      <BoumBackdrop />
      <main className="relative z-[1] mx-auto max-w-2xl px-4 py-5" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow">🎤 Mimic Boum · {game.phase === "prep" ? "préparation" : `manche ${game.round}/${game.totalRounds}`}</span>
          <div className="flex items-center gap-2">
            {isHost && game.phase !== "prep" && game.phase !== "scoreboard" && (
              <button onClick={() => room.skipPhase()} className="rounded-md border border-ink-border px-2 py-1 text-xs text-text-muted hover:border-magenta hover:text-magenta" title="Passer (hôte)">⏭ Passer</button>
            )}
            <SoundToggle />
          </div>
        </div>

        {game.phase === "prep" && <Prep room={room} game={game} mic={mic} you={you} isHost={isHost} />}
        {game.phase === "reference" && <Reference game={game} />}
        {game.phase === "countdown" && <Countdown room={room} game={game} />}
        {game.phase === "recording" && <Recording room={room} game={game} mic={mic} />}
        {game.phase === "processing" && <Processing />}
        {game.phase === "playback" && <Playback room={room} game={game} you={you} />}
        {game.phase === "voting" && <Voting room={room} game={game} you={you} />}
        {game.phase === "scoreboard" && <Scoreboard room={room} game={game} you={you} isHost={isHost} />}
      </main>
    </>
  );
}

// --- PREP : test micro + prêt --------------------------------------------------
function Prep({ room, game, mic, you, isHost }: { room: UseRoom; game: MimicPublic; mic: ReturnType<typeof useMic>; you: string; isHost: boolean }) {
  const ready = you ? !!game.ready[you] : false;
  return (
    <div className="animate-pop space-y-4">
      <div className="panel p-5 text-center">
        <p className="font-display text-2xl font-extrabold">🎧 Prépare-toi à imiter !</p>
        <p className="mt-1 text-sm text-text-muted">Un son va être joué. Ta mission : l'imiter avec ta voix, en une seule prise. Les autres voteront pour la meilleure imitation.</p>
      </div>

      <div className="panel p-4">
        <p className="eyebrow mb-3 text-gold">🎤 Ton microphone</p>
        {mic.status === "on" ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-mint">Micro détecté ✓</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-deep">
              <div className="h-full rounded-full bg-mint transition-[width] duration-75" style={{ width: `${Math.round(mic.level * 100)}%` }} />
            </div>
            <span className="text-xs text-text-faint">parle pour tester</span>
          </div>
        ) : mic.status === "denied" ? (
          <p className="text-sm text-text-muted">Micro indisponible (souvent en <b>http://IP</b> sur le réseau local). Ouvre le jeu en <b>https</b> ou sur <b>localhost</b> pour enregistrer.</p>
        ) : (
          <button onClick={mic.request} className="rounded-xl bg-gold px-4 py-2 font-display font-bold text-ink-deep">
            {mic.status === "asking" ? "Autorisation…" : "🎙️ Tester mon micro"}
          </button>
        )}
      </div>

      <div className="panel p-3">
        <p className="eyebrow mb-2">Joueurs</p>
        <div className="space-y-1.5">
          {game.players.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <Avatar name={p.name} color={p.color} avatar={p.avatar} size={24} />
              <span className="flex-1">{p.name}{p.id === you && " (toi)"}</span>
              <span className={game.ready[p.id] ? "text-mint" : "text-text-faint"}>{game.ready[p.id] ? "prêt ✓" : "…"}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => room.mimicAction({ kind: "ready", ready: !ready })} className={`arc arc-block ${ready ? "arc-ready" : "arc-sec"}`}>
        {ready ? "Prêt ✓" : "Je suis prêt"}
      </button>
      {isHost && (
        <button onClick={() => room.mimicAction({ kind: "start" })} disabled={!game.allReady} className="arc arc-p arc-block disabled:opacity-40">
          Lancer la 1re manche
        </button>
      )}
    </div>
  );
}

// --- REFERENCE : on écoute le son ---------------------------------------------
function Reference({ game }: { game: MimicPublic }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const a = audioRef.current;
    if (a && game.sound?.src) {
      a.currentTime = 0;
      a.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    }
  }, [game.sound?.src]);
  const cat = game.sound ? mimicCategoryLabel(game.sound.category) : null;
  return (
    <div className="animate-pop grid min-h-[52vh] place-items-center text-center">
      <div>
        <p className="eyebrow mb-2 text-gold">🎧 Écoutez bien…</p>
        <div className="mx-auto my-4 grid h-40 w-40 place-items-center rounded-full border-2 border-mint/50" style={{ background: "radial-gradient(circle at 40% 35%, rgba(70,224,176,0.25), rgba(20,16,42,0.6))", animation: "wiggle 1.4s ease-in-out infinite" }}>
          <span className="text-6xl">🔊</span>
        </div>
        {game.sound ? (
          <>
            <p className="font-display text-2xl font-extrabold">{cat?.emoji} {game.sound.name}</p>
            <p className="mt-1 text-sm text-text-muted">À vous de l'imiter ! 🎤</p>
          </>
        ) : (
          <p className="text-text-muted">Aucun son disponible — ajoute des sons dans <span className="font-mono">public/sounds/</span>.</p>
        )}
        {blocked && (
          <button onClick={() => audioRef.current?.play().then(() => setBlocked(false)).catch(() => {})} className="mt-3 rounded-xl bg-gold px-4 py-2 font-bold text-ink-deep">▶︎ Écouter le son</button>
        )}
        <audio ref={audioRef} src={game.sound?.src ?? undefined} preload="auto" />
      </div>
    </div>
  );
}

// --- COUNTDOWN 3·2·1 -----------------------------------------------------------
function Countdown({ room, game }: { room: UseRoom; game: MimicPublic }) {
  const secs = useCountdown(game.deadline, room.serverNow);
  const n = secs == null ? 0 : Math.max(1, Math.ceil(secs));
  const prev = useRef(-1);
  useEffect(() => { if (n !== prev.current && n >= 1 && n <= 3) { playSound("tick"); prev.current = n; } }, [n]);
  return (
    <div className="animate-pop grid min-h-[52vh] place-items-center text-center">
      <div>
        <p className="eyebrow mb-4 text-magenta">Prépare ta voix…</p>
        <div key={n} className="font-display text-[120px] font-black leading-none text-gold" style={{ animation: "bombPop 0.5s ease-out" }}>{n}</div>
      </div>
    </div>
  );
}

// --- RECORDING : 🔴 une seule prise -------------------------------------------
function Recording({ room, game, mic }: { room: UseRoom; game: MimicPublic; mic: ReturnType<typeof useMic> }) {
  const secs = useCountdown(game.deadline, room.serverNow);
  const remaining = secs == null ? 0 : secs;
  const total = game.recordMs / 1000;
  const progress = Math.max(0, Math.min(1, 1 - remaining / total));
  const sentRef = useRef(false);
  const startedRef = useRef(false);

  const finish = useCallback(async (empty = false) => {
    if (sentRef.current) return;
    sentRef.current = true;
    let hasAudio = false;
    try {
      const blob = await mic.stopRecording();
      if (blob && !empty) {
        const url = await blobToDataUrl(blob);
        if (url.length < 260_000) { room.sendVoiceTake(game.round, url); hasAudio = true; }
      }
    } catch { /* ignore */ }
    room.mimicAction({ kind: "take_done", empty: !hasAudio });
  }, [mic, room, game.round]);

  // Démarre l'enregistrement à l'entrée de la phase.
  useEffect(() => {
    if (!startedRef.current && mic.status === "on") { startedRef.current = true; mic.startRecording(); }
    playSound("start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fin auto quand le temps est écoulé (sécurité, même si l'hôte n'avance pas).
  useEffect(() => {
    if (remaining <= 0.05 && !sentRef.current) void finish(false);
  }, [remaining, finish]);

  // Filet : si la phase change (tout le monde a rendu), on envoie quand même.
  useEffect(() => () => { if (!sentRef.current) void finish(false); }, [finish]);

  const done = game.youSubmitted || sentRef.current;

  return (
    <div className="animate-pop grid min-h-[52vh] place-items-center text-center">
      <div className="w-full max-w-sm">
        {done ? (
          <>
            <div className="mx-auto mb-3 grid h-32 w-32 place-items-center rounded-full border-2 border-mint/60 bg-mint/10"><span className="text-5xl">✅</span></div>
            <p className="font-display text-2xl font-extrabold text-mint">🎤 Prise enregistrée !</p>
            <p className="mt-1 text-sm text-text-muted">Impossible de recommencer. On attend les autres…</p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {game.players.map((p) => (
                <span key={p.id} className={`rounded-full border px-2 py-0.5 text-xs ${game.submittedIds.includes(p.id) ? "border-mint/50 text-mint" : "border-ink-border text-text-faint"}`}>{game.submittedIds.includes(p.id) ? "✓ " : "○ "}{p.name}</span>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow mb-2 text-magenta">🔴 Enregistrement — à toi !</p>
            <div className="mx-auto mb-3 grid h-32 w-32 place-items-center rounded-full" style={{ background: "radial-gradient(circle, rgba(255,77,141,0.35), rgba(20,16,42,0.6))", boxShadow: `0 0 ${20 + progress * 40}px rgba(255,77,141,0.6)`, animation: "wiggle 0.5s ease-in-out infinite" }}>
              <span className="text-5xl">🎤</span>
            </div>
            <div className="font-display text-4xl font-black tabular-nums text-gold">{remaining.toFixed(1)}s</div>
            <div className="mx-auto mt-3 h-3 w-full overflow-hidden rounded-full bg-ink-deep">
              <div className="h-full rounded-full bg-magenta transition-[width] duration-100" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            {/* VU-mètre live */}
            <div className="mx-auto mt-2 h-1.5 w-2/3 overflow-hidden rounded-full bg-ink-deep">
              <div className="h-full rounded-full bg-mint transition-[width] duration-75" style={{ width: `${Math.round(mic.level * 100)}%` }} />
            </div>
            {mic.status !== "on" && <p className="mt-3 text-xs text-text-faint">Micro non autorisé — ta prise sera vide. (Ouvre en https/localhost pour enregistrer.)</p>}
            <button onClick={() => finish(false)} className="arc arc-p mt-5" style={{ padding: "0 26px" }}>⏹️ Valider ma prise</button>
          </>
        )}
      </div>
    </div>
  );
}

function Processing() {
  return (
    <div className="animate-pop grid min-h-[52vh] place-items-center text-center">
      <div>
        <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-4 border-ink-border border-t-gold" />
        <p className="font-display text-lg font-bold text-text-muted">On rassemble les imitations…</p>
      </div>
    </div>
  );
}

// --- PLAYBACK : lecture des prises une par une --------------------------------
function Playback({ room, game, you }: { room: UseRoom; game: MimicPublic; you: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pid = game.currentTakeId;
  const take = pid ? room.voiceTakes.get(`${game.round}:${pid}`) : null;
  const player = game.players.find((p) => p.id === pid);
  const idx = game.playbackIndex;
  const total = game.playbackOrder.length;

  useEffect(() => {
    const a = audioRef.current;
    if (a && take) { a.currentTime = 0; a.play().catch(() => {}); }
  }, [take, idx]);

  return (
    <div className="animate-pop grid min-h-[52vh] place-items-center text-center">
      <div className="w-full max-w-sm">
        <p className="eyebrow mb-2 text-gold">🎧 Les imitations · {idx + 1}/{total}</p>
        {game.sound && <p className="mb-4 text-sm text-text-faint">Son à imiter : <b className="text-text">{game.sound.name}</b></p>}
        {player && (
          <div className="rounded-2xl border border-mint/40 bg-mint/[0.06] p-5">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Avatar name={player.name} color={player.color} avatar={player.avatar} size={34} />
              <span className="font-display text-xl font-bold">🎤 {player.name}{player.id === you && " (toi)"}</span>
            </div>
            {take ? (
              <>
                <div className="my-2 text-3xl" style={{ animation: "wiggle 0.6s ease-in-out infinite" }}>🔊 〰️ 〰️ 〰️</div>
                <audio ref={audioRef} src={take} controls className="mx-auto w-full" />
              </>
            ) : (
              <p className="text-sm text-text-faint">(pas de prise / son indisponible)</p>
            )}
          </div>
        )}
        <p className="mt-4 text-xs text-text-faint">🔇 Silence, on écoute chaque imitation jusqu'au bout !</p>
      </div>
    </div>
  );
}

// --- VOTING : ⭐ meilleure imitation ------------------------------------------
function Voting({ room, game, you }: { room: UseRoom; game: MimicPublic; you: string }) {
  const voted = !!game.yourVote;
  return (
    <div className="animate-pop">
      <p className="eyebrow mb-1 text-center text-gold">⭐ Vote pour la meilleure imitation</p>
      <p className="mb-4 text-center text-sm text-text-muted">{game.sound ? <>Son : <b className="text-text">{game.sound.name}</b> · </> : null}pas de vote pour toi-même !</p>
      <div className="mx-auto grid max-w-md gap-2">
        {game.players.map((p) => {
          const isYou = p.id === you;
          const picked = game.yourVote === p.id;
          const hasVoted = game.votedIds.includes(p.id);
          return (
            <button
              key={p.id}
              disabled={isYou || voted}
              onClick={() => room.mimicAction({ kind: "vote", targetId: p.id })}
              className="flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all disabled:cursor-default hover:enabled:-translate-y-0.5"
              style={{ borderColor: picked ? "#FFC24B" : "#332A5A", background: picked ? "rgba(255,194,75,0.1)" : "rgba(28,22,54,0.6)", opacity: isYou ? 0.5 : 1 }}
            >
              <Avatar name={p.name} color={p.color} avatar={p.avatar} size={34} />
              <span className="flex-1 font-display text-lg font-bold">{p.name}{isYou && " (toi)"}</span>
              {picked ? <span className="text-gold">⭐ voté</span> : hasVoted ? <span className="text-xs text-mint">a voté</span> : isYou ? <span className="text-xs text-text-faint">—</span> : <span className="text-text-faint">⭐</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-center text-sm text-text-faint">{game.votedIds.length}/{game.players.length} ont voté</p>
    </div>
  );
}

// --- SCOREBOARD ----------------------------------------------------------------
function Scoreboard({ room, game, you, isHost }: { room: UseRoom; game: MimicPublic; you: string; isHost: boolean }) {
  useEffect(() => { playSound("reveal"); }, []);
  return (
    <div className="animate-pop">
      <p className="eyebrow mb-1 text-center text-gold">Résultats · manche {game.round}/{game.totalRounds}</p>
      <div className="mx-auto mt-3 max-w-md space-y-2">
        {game.ranking.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border p-2.5" style={{ borderColor: r.isBest ? "rgba(255,194,75,0.55)" : "#332A5A", background: r.isBest ? "rgba(255,194,75,0.07)" : "rgba(28,22,54,0.5)" }}>
            <span className="w-5 text-center font-display font-bold" style={{ color: i === 0 ? "#FFC24B" : "#6E6796" }}>{i + 1}</span>
            <Avatar name={r.name} color={r.color} avatar={r.avatar} size={30} />
            <span className="flex-1 truncate font-medium">{r.name}{r.id === you && " (toi)"}{r.isBest && <span className="ml-2 text-xs text-gold">🏆 meilleure imit.</span>}</span>
            {r.roundVotes > 0 && <span className="font-mono text-xs text-mint">{"⭐".repeat(Math.min(5, r.roundVotes))} +{r.roundVotes}</span>}
            <span className="font-display font-bold tabular-nums text-gold">{r.score.toLocaleString("fr-FR")}</span>
          </div>
        ))}
      </div>
      {isHost ? (
        <div className="mt-5 flex justify-center">
          <button onClick={() => room.mimicAction({ kind: "next" })} className="arc arc-p" style={{ padding: "0 26px" }}>
            {game.round >= game.totalRounds ? "Voir le podium 🏆" : "Manche suivante →"}
          </button>
        </div>
      ) : (
        <p className="mt-5 text-center text-sm text-text-muted">En attente de l'hôte…</p>
      )}
    </div>
  );
}

// --- GAMEOVER ------------------------------------------------------------------
function GameOver({ room, game, you, isHost }: { room: UseRoom; game: MimicPublic; you: string; isHost: boolean }) {
  return (
    <>
      <BoumBackdrop />
      <main className="relative z-[1] mx-auto max-w-2xl px-5 py-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <ResultsScreen
          ranking={game.ranking.map((r) => ({ id: r.id, name: r.name, color: r.color, avatar: r.avatar, score: r.score }))}
          you={you}
          stats={{ fastest: null, brain: game.stats?.bestImitator ?? null, streak: game.stats?.topVotes ?? null }}
          isHost={isHost}
          onReturn={() => room.returnLobby()}
          onReplay={() => room.playAgain()}
        />
        <p className="mt-4 text-center text-xs text-text-faint">🏆 = plus de « meilleures imitations » · ⭐ = plus de votes reçus</p>
      </main>
    </>
  );
}
