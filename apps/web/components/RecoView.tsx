"use client";

import { useEffect, useRef, useState } from "react";
import type { RecoPublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { BoumBackdrop } from "@/components/BoumBackdrop";
import { ResultsScreen } from "@/components/ResultsScreen";
import { SoundToggle, useGameSounds, playSound } from "@/lib/sound";

function useCountdown(deadline: number | null, now: () => number) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);
  if (deadline == null) return null;
  return Math.max(0, Math.ceil((deadline - now()) / 1000));
}

// --- real image resolver (Wikimedia REST) ----------------------------------
type WikiImg = { url: string; page: string };
const wikiCache = new Map<string, WikiImg | null>();

async function fetchWiki(title: string, lang: string): Promise<WikiImg | null> {
  const key = lang + ":" + title;
  if (wikiCache.has(key)) return wikiCache.get(key)!;
  const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) { wikiCache.set(key, null); return null; }
  const j = await res.json();
  const url: string | undefined = j.originalimage?.source || j.thumbnail?.source;
  const page: string | undefined = j.content_urls?.desktop?.page;
  const val = url ? { url, page: page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}` } : null;
  wikiCache.set(key, val);
  return val;
}

/** Resolve the real lead photo for an item (fr, falling back to en). */
function useWikiImage(wiki: string, wikiEn?: string) {
  const [state, setState] = useState<{ loading: boolean; img?: WikiImg; error?: boolean }>({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    (async () => {
      try {
        let img = await fetchWiki(wiki, "fr");
        if (!img && wikiEn) img = await fetchWiki(wikiEn, "en");
        if (!alive) return;
        setState(img ? { loading: false, img } : { loading: false, error: true });
      } catch {
        if (alive) setState({ loading: false, error: true });
      }
    })();
    return () => { alive = false; };
  }, [wiki, wikiEn, attempt]);
  const retry = () => { wikiCache.delete("fr:" + wiki); if (wikiEn) wikiCache.delete("en:" + wikiEn); setAttempt((a) => a + 1); };
  return { ...state, retry };
}

function RecoImage({ wiki, wikiEn, localImg }: { wiki: string; wikiEn?: string; localImg?: string }) {
  const wikiState = useWikiImage(wiki, wikiEn);
  // A local image (dropped in public/reco/…) wins and never needs Wikipedia.
  const loading = localImg ? false : wikiState.loading;
  const error = localImg ? false : wikiState.error;
  const retry = wikiState.retry;
  const url = localImg || wikiState.img?.url;
  return (
    <div
      className="mx-auto mb-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-ink-border bg-ink-deep"
      onContextMenu={(e) => e.preventDefault()}
      style={{ userSelect: "none" }}
    >
      <div className="relative flex h-[300px] items-center justify-center sm:h-[440px] lg:h-[520px]">
        {loading && <span className="animate-pulse text-sm text-text-faint">Chargement de l'image…</span>}
        {error && (
          <div className="text-center">
            <p className="px-4 text-sm text-text-muted">Image indisponible — vérifie ta connexion.</p>
            <button onClick={retry} className="mt-2 rounded-lg border border-ink-border px-3 py-1 text-xs text-text-muted hover:border-gold hover:text-gold">Réessayer</button>
          </div>
        )}
        {url && (
          <img src={url} alt="À reconnaître" className="pointer-events-none h-full w-full select-none object-contain" draggable={false} onDragStart={(e) => e.preventDefault()} />
        )}
      </div>
      {url && (
        <span className="block bg-ink-surface px-3 py-1 text-right text-[10px] text-text-faint">
          {localImg ? "Image : locale" : "Image : Wikimedia Commons"}
        </span>
      )}
    </div>
  );
}

/** Progressive "pixel by pixel" reveal of the reco image, synced on the timer. */
function PixelImage({
  wiki, wikiEn, localImg, deadline, totalMs, serverNow, revealed,
}: {
  wiki: string; wikiEn?: string; localImg?: string;
  deadline: number | null; totalMs: number; serverNow: () => number; revealed: boolean;
}) {
  const wikiState = useWikiImage(wiki, wikiEn);
  const url = localImg || wikiState.img?.url;
  const loading = localImg ? false : wikiState.loading;
  const error = localImg ? false : wikiState.error;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!url) return;
    setReady(false);
    const im = new Image();
    im.onload = () => { imgRef.current = im; setReady(true); };
    im.onerror = () => { imgRef.current = null; setReady(false); };
    im.src = url; // no crossOrigin: drawImage works even cross-origin (no pixel readback)
    return () => { im.onload = null; im.onerror = null; };
  }, [url]);

  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    const draw = () => {
      const cv = canvasRef.current, im = imgRef.current;
      if (cv && im && im.width > 0) {
        const ctx = cv.getContext("2d");
        if (ctx) {
          const cw = 640;
          const ch = Math.max(1, Math.round((cw * im.height) / im.width));
          if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
          let progress = 1;
          if (!revealed && deadline != null && totalMs > 0) {
            const remaining = Math.max(0, deadline - serverNow());
            progress = Math.min(1, Math.max(0, 1 - remaining / totalMs));
          }
          // Blocks across: from very few (heavy pixels) to full resolution.
          const minBlocks = 6;
          const maxBlocks = cw;
          const blocks = revealed ? maxBlocks : Math.round(minBlocks + (maxBlocks - minBlocks) * Math.pow(progress, 1.8));
          const sw = Math.max(2, Math.min(cw, blocks));
          const sh = Math.max(2, Math.round((sw * im.height) / im.width));
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, cw, ch);
          ctx.drawImage(im, 0, 0, sw, sh);           // shrink the whole image
          ctx.drawImage(cv, 0, 0, sw, sh, 0, 0, cw, ch); // blow it back up → pixelated
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready, revealed, deadline, totalMs, serverNow]);

  return (
    <div
      className="mx-auto mb-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-ink-border bg-ink-deep"
      onContextMenu={(e) => e.preventDefault()}
      style={{ userSelect: "none" }}
    >
      <div className="relative flex min-h-[300px] items-center justify-center sm:min-h-[440px]">
        {loading && <span className="animate-pulse text-sm text-text-faint">Chargement de l'image…</span>}
        {error && <p className="px-4 text-sm text-text-muted">Image indisponible.</p>}
        {url && !error && (
          <canvas ref={canvasRef} className="pointer-events-none block h-full w-full select-none" style={{ imageRendering: "pixelated" }} />
        )}
      </div>
      {url && !error && (
        <span className="block bg-ink-surface px-3 py-1 text-right text-[10px] text-text-faint">
          {localImg ? "Image : locale" : "Image : Wikimedia Commons"}
        </span>
      )}
    </div>
  );
}

export function RecoView({ room, pixel = false }: { room: UseRoom; pixel?: boolean }) {
  useGameSounds(room);
  const game = room.game as RecoPublic;
  const you = room.you;
  const secs = useCountdown(game.phase === "reveal" ? null : game.deadline, room.serverNow);
  const [text, setText] = useState("");
  const answered = you ? game.answeredIds.includes(you) : false;
  const item = game.item;

  const idxRef = useRef(game.index);
  useEffect(() => {
    if (idxRef.current !== game.index) { idxRef.current = game.index; setText(""); }
  }, [game.index]);

  // Preload the next image during the reveal so the next question is instant.
  useEffect(() => {
    if (game.phase === "reveal" && game.nextWiki) {
      fetchWiki(game.nextWiki, "fr")
        .then((img) => (!img && game.nextWikiEn ? fetchWiki(game.nextWikiEn, "en") : img))
        .catch(() => {});
    }
  }, [game.phase, game.nextWiki, game.nextWikiEn]);

  // Sound feedback: correct/wrong on reveal, win on final, tick in the last seconds.
  const prevPhase = useRef(game.phase);
  useEffect(() => {
    if (prevPhase.current !== game.phase) {
      if (game.phase === "reveal") playSound(game.yourCorrect ? "correct" : "wrong");
      else if (game.phase === "final") playSound("win");
      prevPhase.current = game.phase;
    }
  }, [game.phase, game.yourCorrect]);
  const prevSec = useRef<number | null>(null);
  useEffect(() => {
    if (secs != null && secs !== prevSec.current && game.phase === "question" && secs <= 3 && secs > 0) playSound("tick");
    prevSec.current = secs;
  }, [secs, game.phase]);

  const submit = () => { if (text.trim()) room.quizAnswer(text.trim()); };

  return (
    <>
      <BoumBackdrop />
      <main className="relative z-[1] mx-auto max-w-3xl px-5 py-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-widest text-text-faint">
            {game.phase === "final" ? "Résultats" : `${pixel ? "Pixel" : "Image"} ${game.index + 1} / ${game.total}`}
          </span>
          <div className="flex items-center gap-2">
            {game.phase !== "final" && secs != null && (
              <span
                className="grid h-9 min-w-9 place-items-center rounded-full px-2 font-display text-lg font-extrabold tabular-nums"
                style={{
                  color: secs <= 5 ? "#FF4D8D" : "#FFC24B",
                  border: `2px solid ${secs <= 5 ? "rgba(255,77,141,0.5)" : "rgba(255,194,75,0.4)"}`,
                  animation: secs <= 5 ? "wiggle 0.6s ease-in-out infinite" : undefined,
                }}
              >
                {secs}
              </span>
            )}
            <SoundToggle />
          </div>
        </div>

        {(game.phase === "question" || game.phase === "reveal") && item && (
          <div className="animate-pop">
            {/* IMAGE réelle — élément principal (pixelisée si mode Pixel incoming) */}
            {pixel ? (
              <PixelImage
                wiki={item.wiki}
                wikiEn={item.wikiEn}
                localImg={item.img}
                deadline={game.deadline}
                totalMs={game.secondsPerQuestion * 1000}
                serverNow={room.serverNow}
                revealed={game.phase !== "question"}
              />
            ) : (
              <RecoImage wiki={item.wiki} wikiEn={item.wikiEn} localImg={item.img} />
            )}

            <h2 className="mx-auto mb-4 max-w-xl text-center font-display text-2xl font-extrabold leading-tight sm:text-3xl">{item.question}</h2>

            {/* Réponse libre */}
            <div className="mx-auto max-w-md">
              {game.phase === "question" ? (
                answered ? (
                  <p className="rounded-2xl border-2 border-mint/40 bg-mint/[0.06] p-4 text-center font-display text-lg font-bold text-mint">
                    Réponse envoyée ✓ <span className="text-text-muted">« {game.yourAnswer} »</span>
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submit()}
                      autoFocus
                      placeholder="Écris ta réponse…"
                      className="flex-1 rounded-2xl border-2 border-gold/40 bg-ink-deep px-4 py-3.5 text-lg outline-none focus:border-gold"
                    />
                    <button onClick={submit} className="arc arc-p" style={{ padding: "0 20px" }}>Valider</button>
                  </div>
                )
              ) : (
                <div className="text-center">
                  <p className="mb-1 text-sm text-text-muted">Réponse :</p>
                  <p className="font-display text-2xl font-extrabold text-mint">{game.correctText}</p>
                  {game.yourCorrect ? (
                    <p className="mt-2 animate-pop font-display text-xl font-extrabold text-mint">Bravo ! <span className="text-gold">+{game.yourGained}</span> {(game.yourGained ?? 0) >= 900 ? "⚡" : ""}</p>
                  ) : (
                    <p className="mt-2 font-display text-lg font-bold text-text-muted">{answered ? `« ${game.yourAnswer} » — raté` : "Pas de réponse"} · +0</p>
                  )}
                </div>
              )}
            </div>

            {/* qui a répondu / classement */}
            <div className="mt-6">
              {game.phase === "question" ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {game.players.map((p) => {
                    const done = game.answeredIds.includes(p.id);
                    return (
                      <span key={p.id} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${done ? "border-mint/40 bg-mint/[0.06] text-mint" : "border-ink-border text-text-faint"}`}>
                        {done ? "✓" : "○"} {p.name}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <Ranking game={game} you={you} />
              )}
            </div>

            {game.phase === "reveal" && (() => {
              const fastest = [...game.ranking].filter((r) => r.gained > 0).sort((a, b) => b.gained - a.gained)[0];
              return fastest ? (
                <p className="mt-3 text-center text-sm text-text-muted">⚡ Le plus rapide : <b className="text-gold">{fastest.name}</b> <span className="text-mint">+{fastest.gained}</span></p>
              ) : null;
            })()}
          </div>
        )}

        {game.phase === "final" && <FinalScreen game={game} you={you} room={room} />}
      </main>
    </>
  );
}

function Ranking({ game, you }: { game: RecoPublic; you: string | null }) {
  return (
    <div className="mx-auto max-w-md space-y-1.5">
      {game.ranking.map((r, i) => (
        <div key={r.id} className="flex items-center gap-3 rounded-xl border p-2.5" style={{ borderColor: i === 0 ? "rgba(255,194,75,0.5)" : "#332A5A", background: i === 0 ? "rgba(255,194,75,0.06)" : "rgba(28,22,54,0.5)" }}>
          <span className="w-5 text-center font-display font-bold" style={{ color: i === 0 ? "#FFC24B" : "#6E6796" }}>{i + 1}</span>
          <Avatar name={r.name} color={r.color} avatar={r.avatar} size={26} />
          <span className="flex-1 truncate font-medium">{r.name}{r.id === you && " (toi)"}</span>
          {r.gained > 0 && <span className="font-mono text-xs text-mint">+{r.gained}</span>}
          <span className="font-display font-bold tabular-nums text-gold">{r.score.toLocaleString("fr-FR")}</span>
        </div>
      ))}
    </div>
  );
}

function FinalScreen({ game, you, room }: { game: RecoPublic; you: string | null; room: UseRoom }) {
  return (
    <ResultsScreen
      ranking={game.ranking.map((r) => ({ id: r.id, name: r.name, color: r.color, avatar: r.avatar, score: r.score }))}
      you={you}
      stats={game.stats}
      isHost={room.state?.hostId === you}
      onReturn={() => room.returnLobby()}
      onReplay={() => room.playAgain()}
    />
  );
}
