"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { RecoPublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { BoumBackdrop } from "@/components/BoumBackdrop";
import { ResultsScreen } from "@/components/ResultsScreen";
import { SoundToggle, useGameSounds, playSound } from "@/lib/sound";

// ── Palette « LeBoum » (identité or / menthe / rose / violet) ───────────────
const C = {
  bg: "#14102A",
  surface: "#1C1636",
  aside: "rgba(28,22,54,.72)",
  ink: "#0E0B1A",
  line: "#332A5A",
  lineFaint: "#241D45",
  text: "#F3EEFF",
  muted: "#A79FC7",
  faint: "#6E6796",
  dim: "#4A4370",
  gold: "#FFC24B",
  goldSh: "#B47F16",
  mint: "#46E0B0",
  pink: "#FF4D8D",
  violet: "#8B7DF6",
  orange: "#FF8A3D",
};
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

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

// ── Cadre image partagé (mêmes rayons / ombres / overlay que les écrans) ────
function ImageFrame({
  accent, maxW, children, overlay, credit,
}: {
  accent: string; maxW: number; children: React.ReactNode; overlay?: string | null; credit?: string | null;
}) {
  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "relative", width: "100%", maxWidth: maxW, margin: "0 auto",
        borderRadius: 20, overflow: "hidden", userSelect: "none",
        boxShadow: `0 0 0 1px ${overlay ? hexA(C.mint, 0.45) : C.line}, 0 26px 50px -30px rgba(0,0,0,.9)`,
      }}
    >
      <div style={{ position: "relative", height: "clamp(230px, 44vh, 484px)", display: "flex", alignItems: "center", justifyContent: "center", background: C.ink }}>
        {children}
        {credit && !overlay && (
          <span style={{ position: "absolute", top: 8, right: 10, fontFamily: DISPLAY, fontWeight: 700, fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", color: hexA(C.text, 0.4) }}>{credit}</span>
        )}
        {overlay && (
          <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "48px 26px 22px", background: "linear-gradient(180deg,transparent,rgba(14,11,26,.92))", pointerEvents: "none" }}>
            <span style={{ fontFamily: DISPLAY, fontSize: "clamp(28px,4.4vw,44px)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1, color: C.mint }}>{overlay}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RecoImage({ wiki, wikiEn, localImg, accent, overlay, timeFrac, zoom }: {
  wiki: string; wikiEn?: string; localImg?: string; accent: string; overlay?: string | null; timeFrac?: number | null; zoom?: number | null;
}) {
  const wikiState = useWikiImage(wiki, wikiEn);
  // A local image (dropped in public/reco/…) wins and never needs Wikipedia.
  const loading = localImg ? false : wikiState.loading;
  const error = localImg ? false : wikiState.error;
  const retry = wikiState.retry;
  const url = localImg || wikiState.img?.url;
  return (
    <ImageFrame accent={accent} maxW={660} overlay={overlay} credit={url ? (localImg ? "Locale" : "Wikimedia") : null}>
      {loading && <span style={{ fontSize: 13, color: C.faint, animation: "pulseSoft 1.3s ease-in-out infinite" }}>Chargement de l'image…</span>}
      {error && (
        <div style={{ textAlign: "center" }}>
          <p style={{ padding: "0 16px", fontSize: 13, color: C.muted }}>Image indisponible — vérifie ta connexion.</p>
          <button onClick={retry} className="rc-ghost" style={{ marginTop: 8, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", padding: "6px 12px", fontSize: 12, color: C.muted, cursor: "pointer" }}>Réessayer</button>
        </div>
      )}
      {url && (
        <img
          src={url}
          alt="À reconnaître"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          style={{
            pointerEvents: "none", height: "100%", width: "100%", objectFit: "contain", userSelect: "none",
            // Mode Zoom : on part très zoomé (≈8×) et on dézoome jusqu'à 100 %
            // au fil du temps restant (zoom = 1 + 7 × fraction restante).
            ...(zoom != null ? { transform: `scale(${(1 + 7 * Math.max(0, Math.min(1, zoom))).toFixed(3)})`, transformOrigin: "center", transition: "transform .9s linear", willChange: "transform" } : {}),
          }}
        />
      )}
      {timeFrac != null && !overlay && url && (
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 5, background: C.lineFaint, pointerEvents: "none" }}>
          <span style={{ display: "block", width: `${Math.round(timeFrac * 100)}%`, height: "100%", background: `linear-gradient(90deg, ${C.orange}, ${C.gold})` }} />
        </div>
      )}
    </ImageFrame>
  );
}

/** Progressive "pixel by pixel" reveal of the reco image, synced on the timer. */
function PixelImage({
  wiki, wikiEn, localImg, deadline, totalMs, serverNow, revealed, overlay,
}: {
  wiki: string; wikiEn?: string; localImg?: string;
  deadline: number | null; totalMs: number; serverNow: () => number; revealed: boolean; overlay?: string | null;
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
          const blocks = revealed ? maxBlocks : Math.round(minBlocks + (maxBlocks - minBlocks) * Math.pow(progress, 2.3));
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
    <ImageFrame accent={C.mint} maxW={830} overlay={overlay} credit={url && !error ? (localImg ? "Locale" : "Wikimedia") : null}>
      {loading && <span style={{ fontSize: 13, color: C.faint, animation: "pulseSoft 1.3s ease-in-out infinite" }}>Chargement de l'image…</span>}
      {error && <p style={{ padding: "0 16px", fontSize: 13, color: C.muted }}>Image indisponible.</p>}
      {url && !error && (
        <canvas ref={canvasRef} style={{ pointerEvents: "none", display: "block", height: "100%", width: "100%", objectFit: "contain", userSelect: "none", imageRendering: "pixelated" }} />
      )}
    </ImageFrame>
  );
}

// ── Rangée du rail joueurs ──────────────────────────────────────────────────
type RailRow = {
  id: string; name: string; color: string; avatar?: string | null;
  you: boolean; accent?: string; badge?: { text: string; color: string };
  meta?: { text: string; color: string }; score?: string; rank?: number;
};

function Rail({ kicker, heading, sub, rows }: { kicker: string; heading: string; sub: string; rows: RailRow[] }) {
  return (
    <aside className="rc-rail" style={{ position: "relative", width: 296, flex: "none", zIndex: 1, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 18, padding: "24px 20px", background: C.aside, borderRight: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.faint }}>{kicker}</span>
        <span style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.1 }}>{heading}</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: C.faint }}>{sub}</span>
      </div>
      <div style={{ height: 1, flex: "none", background: "linear-gradient(90deg,transparent,rgba(243,238,255,.14) 18%,rgba(243,238,255,.14) 82%,transparent)" }} />
      <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => {
          const ac = r.accent;
          return (
            <div key={r.id} style={{
              position: "relative", display: "flex", alignItems: "center", gap: 12,
              padding: ac ? "12px 14px 12px 16px" : "12px 14px", borderRadius: 14,
              background: ac ? hexA(ac, 0.1) : "transparent",
              boxShadow: ac ? `0 0 0 1px ${hexA(ac, 0.55)}, 0 0 26px -12px ${hexA(ac, 0.9)}` : `0 0 0 1px ${C.line}`,
            }}>
              {ac && <span style={{ position: "absolute", left: 0, top: 13, bottom: 13, width: 3, borderRadius: 3, background: ac }} />}
              {r.rank != null && <span style={{ flex: "none", width: 14, fontFamily: DISPLAY, fontWeight: 700, fontSize: 12, color: r.rank === 1 ? C.gold : C.faint }}>{r.rank}</span>}
              <Avatar name={r.name} color={r.color} avatar={r.avatar} size={34} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.name}{r.you && <span style={{ color: C.faint, fontWeight: 400 }}> · toi</span>}
                </span>
                {r.meta && (
                  <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, color: r.meta.color }}>{r.meta.text}</span>
                )}
              </span>
              {r.badge && (
                <span style={{ flex: "none", marginLeft: 6, whiteSpace: "nowrap", fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: r.badge.color }}>{r.badge.text}</span>
              )}
              {r.score && (
                <span style={{ flex: "none", fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: r.rank === 1 ? C.gold : C.muted }}>{r.score}</span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

const goldBtn: CSSProperties = {
  flex: "none", border: "none", borderRadius: 14, padding: "18px 30px", fontFamily: DISPLAY, fontSize: 17, fontWeight: 700,
  lineHeight: 1, background: C.gold, color: C.ink, cursor: "pointer", boxShadow: `0 5px 0 ${C.goldSh}, 0 10px 18px -8px rgba(0,0,0,.6)`,
};

const SCOPED_CSS = `
.rc-scope button.rc-gold:hover{filter:brightness(1.04)}
.rc-scope button.rc-gold:active{transform:translateY(4px);box-shadow:0 1px 0 ${C.goldSh} !important}
.rc-scope button.rc-ghost:hover{border-color:${C.gold};color:${C.gold}}
.rc-scope input.rc-input::placeholder{color:${C.dim};opacity:1}
.rc-scope .rc-caret{display:inline-block;width:4px;height:.7em;margin-left:7px;vertical-align:-.08em;background:${C.gold};animation:caretBlink 1.05s step-end infinite}
@media (max-width:899px){
  .rc-scope .rc-rail{display:none}
  .rc-scope .rc-mobilehead{display:flex}
  .rc-scope .rc-pad{padding-left:18px !important;padding-right:18px !important}
}
@media (min-width:900px){ .rc-scope .rc-mobilehead{display:none} }
`;

// ══════════════════════════════════════════════════════════════════════════
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

  // ── Final : écran de résultats partagé (câblage inchangé) ─────────────────
  if (game.phase === "final") return <FinalScreen game={game} you={you} room={room} />;

  // ── Dérivés visuels ──────────────────────────────────────────────────────
  const isCoop = game.mode === "coop";
  const accent = pixel ? C.mint : C.violet;
  // Coop : la barre d'en-tête suit le chrono GLOBAL (manches × temps).
  const totalMs = (isCoop ? game.total : 1) * game.secondsPerQuestion * 1000;
  const remaining = game.deadline != null ? Math.max(0, game.deadline - room.serverNow()) : 0;
  const frac = game.phase !== "question" ? 1 : totalMs > 0 ? Math.min(1, Math.max(0, 1 - remaining / totalMs)) : 0;
  const chip = pixel ? C.mint : C.violet;

  // Barre de progression du tour (3px sous le bord du cadre).
  const barAccent = game.phase === "reveal" ? C.mint : accent;
  const P = game.phase === "reveal" ? 95 : Math.max(5, Math.min(95, Math.round(frac * 100)));
  const progressBar: CSSProperties = {
    height: 3, flex: "none",
    background: game.phase === "reveal"
      ? `linear-gradient(90deg,transparent,${barAccent} 5%,${barAccent} 95%,transparent)`
      : `linear-gradient(90deg,transparent,${barAccent} 5%,${barAccent} ${P}%,${hexA(barAccent, 0)} ${Math.min(96, P + 1)}%)`,
  };

  // Rail joueurs (ordre du classement).
  const railRows: RailRow[] = game.ranking.map((r) => {
    const isYou = r.id === you;
    if (game.phase === "reveal") {
      return {
        id: r.id, name: r.name, color: r.color, avatar: r.avatar, you: isYou,
        accent: isYou ? C.mint : undefined,
        meta: { text: r.gained > 0 ? `+${r.gained}` : "0", color: r.gained > 0 ? C.mint : C.pink },
        score: r.score.toLocaleString("fr-FR"),
      };
    }
    return {
      id: r.id, name: r.name, color: r.color, avatar: r.avatar, you: isYou,
      accent: isYou ? C.gold : undefined,
      badge: r.answered ? { text: "trouvé", color: C.mint } : undefined,
      score: r.score.toLocaleString("fr-FR"),
    };
  });
  const railKicker = pixel ? "Pixel incoming" : "Reconnaissance";
  const railHeading = isCoop ? `Score : ${game.coopScore ?? 0}` : `Image ${game.index + 1} / ${game.total}`;
  const railSub = isCoop
    ? "images trouvées ensemble · chrono commun"
    : game.phase === "reveal" ? "points de l'image" : `${game.answeredIds.length}/${game.players.length} ont trouvé`;

  // Ordre des trouvailles (révélation).
  const finders = game.ranking.filter((r) => r.correct).sort((a, b) => b.gained - a.gained);
  const others = game.ranking.filter((r) => !r.correct);

  const shell: CSSProperties = { minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: BODY, display: "flex", flexDirection: "column", position: "relative" };

  return (
    <main className="rc-scope" style={shell}>
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <BoumBackdrop />
      <div className="rc-card" style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
        <Rail kicker={railKicker} heading={railHeading} sub={railSub} rows={railRows} />


        <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={progressBar} />

          {/* En-tête de la zone de contenu */}
          <div className="rc-pad" style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 40px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span className="rc-mobilehead" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: game.phase === "reveal" ? C.mint : C.faint }}>
                {(pixel ? "Pixel" : "Reco") + ` · ${game.index + 1} / ${game.total}`}
              </span>
              {game.phase === "reveal" ? (
                <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.mint }}>C'était</span>
              ) : (
                <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.faint }}>Image {game.index + 1}</span>
              )}
              {game.phase !== "reveal" && item && (
                <span style={{ padding: "5px 10px", borderRadius: 8, background: hexA(chip, 0.14), boxShadow: `inset 0 0 0 1px ${hexA(chip, 0.45)}`, fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: chip }}>
                  {item.category}
                </span>
              )}
              {isCoop && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, background: hexA(C.mint, 0.14), boxShadow: `inset 0 0 0 1px ${hexA(C.mint, 0.5)}`, color: C.mint }}>
                  <span style={{ fontSize: 13 }}>🤝</span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 15 }}>{game.coopScore ?? 0}</span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: hexA(C.mint, 0.85) }}>trouvées</span>
                </span>
              )}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
              {game.phase === "question" && pixel && secs != null && (
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 800, color: C.mint }}>{secs}</span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.faint }}>restantes</span>
                </span>
              )}
              <SoundToggle />
            </span>
          </div>

          {/* Corps */}
          {!item && game.total === 0 ? (
            <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <div style={{ maxWidth: 480, borderRadius: 18, boxShadow: `0 0 0 1px ${hexA(C.gold, 0.4)}`, background: hexA(C.gold, 0.06), padding: 24, textAlign: "center" }}>
                <p style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 800, color: C.gold }}>Aucune image trouvée</p>
                <p style={{ marginTop: 8, fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
                  Dépose tes images dans <span style={{ fontFamily: DISPLAY }}>apps/web/public/reco/</span> et décris-les dans <span style={{ fontFamily: DISPLAY }}>images.txt</span>, puis relance le serveur.
                </p>
              </div>
            </div>
          ) : item ? (
            <>
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "0 clamp(16px,4vw,40px)" }}>
                {pixel ? (
                  <PixelImage
                    wiki={item.wiki}
                    wikiEn={item.wikiEn}
                    localImg={item.img}
                    deadline={game.revealDeadline}
                    totalMs={game.secondsPerQuestion * 1000}
                    serverNow={room.serverNow}
                    revealed={game.phase !== "question"}
                    overlay={game.phase === "reveal" ? game.correctText : null}
                  />
                ) : (
                  <RecoImage
                    wiki={item.wiki}
                    wikiEn={item.wikiEn}
                    localImg={item.img}
                    accent={accent}
                    overlay={game.phase === "reveal" ? game.correctText : null}
                    timeFrac={game.phase === "question" ? frac : null}
                    zoom={game.mode === "zoom" && game.phase === "question" ? frac : null}
                  />
                )}

                {game.phase === "question" && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 18, justifyContent: "center", flexWrap: "wrap", textAlign: "center" }}>
                    <span style={{ fontFamily: DISPLAY, fontSize: "clamp(22px,3.2vw,30px)", fontWeight: 800, letterSpacing: "-.01em" }}>{item.question}</span>
                    {!pixel && secs != null && (
                      <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, letterSpacing: ".06em", color: secs <= 5 ? C.pink : C.gold }}>{secs}s</span>
                    )}
                  </div>
                )}
              </div>

              {/* Pied : saisie (question) ou trouvailles (révélation) */}
              {game.phase === "question" ? (
                <div className="rc-pad" style={{ flex: "none", padding: "0 40px 34px", display: "flex", alignItems: "center", gap: 16 }}>
                  {answered ? (
                    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: "18px 24px", borderRadius: 16, background: hexA(C.mint, 0.06), boxShadow: `0 0 0 2px ${hexA(C.mint, 0.4)}` }}>
                      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18, color: C.mint }}>Réponse envoyée ✓</span>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15, color: C.muted }}>« {game.yourAnswer} »</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", padding: "18px 24px", borderRadius: 16, background: C.ink, boxShadow: `0 0 0 2px ${hexA(C.gold, 0.5)}, inset 0 1px 0 rgba(243,238,255,.04), 0 20px 44px -28px rgba(0,0,0,.9)` }}>
                        <input
                          className="rc-input"
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && submit()}
                          autoFocus
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="ta réponse…"
                          style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", fontFamily: DISPLAY, fontSize: "clamp(22px,3.2vw,30px)", fontWeight: 800, letterSpacing: "-.01em", color: C.text }}
                        />
                      </div>
                      <button className="rc-gold" onClick={submit} style={goldBtn}>Valider</button>
                    </>
                  )}
                </div>
              ) : (
                <div className="rc-pad" style={{ flex: "none", padding: "0 40px 34px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".16em", color: C.faint }}>Trouvé par</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {finders.length === 0 && (
                      <span style={{ fontSize: 14, color: C.muted }}>Personne n'a trouvé cette image.</span>
                    )}
                    {finders.map((r, i) => (
                      <span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 14, background: i === 0 ? hexA(C.mint, 0.1) : "transparent", boxShadow: i === 0 ? `0 0 0 1px ${hexA(C.mint, 0.5)}` : `0 0 0 1px ${C.line}` }}>
                        <Avatar name={r.name} color={r.color} avatar={r.avatar} size={26} />
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{r.name}{r.id === you && <span style={{ color: C.faint, fontWeight: 400 }}> · toi</span>}</span>
                        <span style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 800, color: C.gold }}>+{r.gained}</span>
                      </span>
                    ))}
                    {others.length > 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 14, boxShadow: `0 0 0 1px ${C.lineFaint}`, opacity: 0.5 }}>
                        {others.map((r) => <Avatar key={r.id} name={r.name} color={r.color} avatar={r.avatar} size={26} />)}
                        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 12, color: C.faint }}>—</span>
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 13, marginTop: 2 }}>
                    {game.yourCorrect ? (
                      <span style={{ fontFamily: DISPLAY, fontWeight: 700, color: C.mint }}>Bravo ! <span style={{ color: C.gold }}>+{game.yourGained}</span>{(game.yourGained ?? 0) >= 900 ? " ⚡" : ""}</span>
                    ) : (
                      <span style={{ color: C.muted }}>{answered ? `« ${game.yourAnswer} » — raté` : "Pas de réponse"} · +0</span>
                    )}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div style={{ flex: 1 }} />
          )}
        </div>
      </div>
    </main>
  );
}

function FinalScreen({ game, you, room }: { game: RecoPublic; you: string | null; room: UseRoom }) {
  const isHost = room.state?.hostId === you;
  // Coop : écran collectif « Score de la table » (pas de classement individuel).
  if (game.coopScore != null) {
    return (
      <main className="rc-scope" style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: BODY, display: "flex", flexDirection: "column", position: "relative" }}>
        <BoumBackdrop />
        <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24, textAlign: "center" }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".2em", color: C.faint }}>Score de la table</span>
          <span style={{ fontSize: 52 }}>🤝</span>
          <span style={{ fontFamily: DISPLAY, fontSize: 92, fontWeight: 800, lineHeight: 1, color: C.mint, textShadow: `0 0 44px ${hexA(C.mint, 0.5)}` }}>{game.coopScore}</span>
          <span style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700 }}>images trouvées ensemble avant la fin du chrono</span>
          <span style={{ fontSize: 13, color: C.faint }}>{game.players.length} joueur·euses · battez votre record du salon !</span>
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            {isHost && <button onClick={() => room.returnLobby()} className="rc-ghost" style={{ borderRadius: 12, border: `1px solid ${C.line}`, background: "transparent", padding: "12px 20px", fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: C.muted, cursor: "pointer" }}>Salon</button>}
            {isHost && <button onClick={() => room.playAgain()} className="rc-gold" style={{ borderRadius: 12, border: "none", background: `linear-gradient(180deg, ${C.mint}, #2FB48C)`, padding: "12px 24px", fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, color: "#06231a", cursor: "pointer" }}>Rejouer</button>}
            {!isHost && <span style={{ fontSize: 13, color: C.faint, alignSelf: "center" }}>L'hôte relance la partie…</span>}
          </div>
        </div>
      </main>
    );
  }
  return (
    <ResultsScreen
      ranking={game.ranking.map((r) => ({ id: r.id, name: r.name, color: r.color, avatar: r.avatar, score: r.score }))}
      you={you}
      stats={game.stats}
      isHost={isHost}
      onReturn={() => room.returnLobby()}
      onReplay={() => room.playAgain()}
    />
  );
}
