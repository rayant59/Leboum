"use client";

import { useEffect, useMemo, useState } from "react";

const SCENES = [
  { key: "intro", dur: 2600, accent: "#FFC24B", eyebrow: "BOUM" },
  { key: "draw", dur: 2800, accent: "#FF4D8D", eyebrow: "DESSIN & DEVINETTE" },
  { key: "dub", dur: 2400, accent: "#46E0B0", eyebrow: "DOUBLAGE" },
  { key: "quiz", dur: 2800, accent: "#8B7DF6", eyebrow: "QUIZ" },
  { key: "reco", dur: 2600, accent: "#4CC9F0", eyebrow: "RECONNAISSANCE" },
  { key: "final", dur: 3600, accent: "#FFC24B", eyebrow: "PRÊT À JOUER ?" },
] as const;

const CONFETTI_COLORS = ["#FFC24B", "#FF4D8D", "#46E0B0", "#8B7DF6", "#4CC9F0", "#F3EEFF"];

function Confetti({ n = 60 }: { n?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: n }).map((_, i) => ({
        left: Math.random() * 100,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 0.5,
        dur: 1.6 + Math.random() * 1.4,
        rot: Math.random() * 360,
        size: 6 + Math.random() * 8,
      })),
    [n],
  );
  return (
    <div className="bt-confetti" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.size,
            height: p.size * 1.4,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function BoumTrailer({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const scene = SCENES[i];

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((n) => (n + 1) % SCENES.length), scene.dur);
    return () => clearTimeout(t);
  }, [i, paused, scene.dur]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="bt-root" role="dialog" aria-modal="true" aria-label="Bande-annonce Boum">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="bt-aurora" aria-hidden />

      {/* stage — key forces a remount so per-scene animations restart */}
      <div className="bt-stage" key={i}>
        <span className="bt-eyebrow" style={{ color: scene.accent }}>{scene.eyebrow}</span>

        {scene.key === "intro" && (
          <div className="bt-intro">
            <h1 className="bt-logo">Boum<span className="bt-boom">🎉</span></h1>
            <p className="bt-tag">La soirée jeux, direct depuis ton téléphone</p>
            <Confetti n={70} />
          </div>
        )}

        {scene.key === "draw" && (
          <div className="bt-card" style={{ ["--a" as string]: scene.accent }}>
            <svg className="bt-house" width="150" height="140" viewBox="0 0 150 140" fill="none" stroke="#FF4D8D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path className="bt-draw" d="M25 70 L75 28 L125 70" />
              <path className="bt-draw d2" d="M37 66 L37 118 L113 118 L113 66" />
              <path className="bt-draw d3" d="M64 118 L64 88 L86 88 L86 118" />
            </svg>
            <div className="bt-guess">maison ✓ <b>+100</b></div>
            <p className="bt-line">Dessine le mot secret, les autres devinent</p>
          </div>
        )}

        {scene.key === "dub" && (
          <div className="bt-card" style={{ ["--a" as string]: scene.accent }}>
            <div className="bt-mic"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#46E0B0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0" /><path d="M12 17v4" /><path d="M8.5 21h7" /></svg></div>
            <div className="bt-eq">{Array.from({ length: 9 }).map((_, k) => <span key={k} style={{ animationDelay: `${k * 0.09}s` }} />)}</div>
            <p className="bt-line">Double la vidéo et improvise les voix 🎙️</p>
          </div>
        )}

        {scene.key === "quiz" && (
          <div className="bt-card" style={{ ["--a" as string]: scene.accent }}>
            <p className="bt-q">Quelle planète est la plus proche du Soleil&nbsp;?</p>
            <div className="bt-opts">
              <span>Vénus</span>
              <span className="ok">Mercure ✓</span>
              <span>Mars</span>
              <span>Jupiter</span>
            </div>
            <p className="bt-line">Réponds vite : la vitesse rapporte plus&nbsp;!</p>
          </div>
        )}

        {scene.key === "reco" && (
          <div className="bt-card" style={{ ["--a" as string]: scene.accent }}>
            <div className="bt-reco">
              <img src="/games/reco.png" alt="" className="bt-recoimg" draggable={false} />
              <div className="bt-lens"><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#4CC9F0" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="7" /><path d="M21 21l-5.5-5.5" strokeLinecap="round" /></svg></div>
            </div>
            <div className="bt-answer">Réponse : <b>caméléon</b> ✓</div>
            <p className="bt-line">Devine le personnage, le lieu, l&apos;œuvre…</p>
          </div>
        )}

        {scene.key === "final" && (
          <div className="bt-final">
            <div className="bt-fan">
              {["draw", "doublage", "quiz", "reco", "pixel"].map((g, k) => (
                <img key={g} src={`/games/${g}.png`} alt="" className="bt-fanimg" draggable={false} style={{ ["--k" as string]: k - 2 }} />
              ))}
            </div>
            <h2 className="bt-finaltitle">Boum<span className="bt-boom">🎉</span></h2>
            <p className="bt-tag">2 à 10 joueurs · aucun compte requis</p>
            <button className="bt-cta" onClick={onCreate}>Créer une partie</button>
            <Confetti n={70} />
          </div>
        )}
      </div>

      {/* controls */}
      <button className="bt-close" onClick={onClose} aria-label="Fermer">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>

      <div className="bt-reel" aria-hidden>
        {SCENES.map((s, n) => (
          <button
            key={s.key}
            className="bt-seg"
            onClick={() => setI(n)}
            aria-label={`Scène ${n + 1}`}
          >
            <i
              className="bt-segfill"
              style={
                n < i
                  ? { width: "100%" }
                  : n === i
                    ? { width: "100%", animation: `bt-fill ${scene.dur}ms linear`, background: scene.accent }
                    : { width: "0%" }
              }
            />
          </button>
        ))}
      </div>

      <div className="bt-hint">
        <button className="bt-skip" onClick={onClose}>Passer</button>
      </div>
    </div>
  );
}

const CSS = `
.bt-root{position:fixed;inset:0;z-index:120;overflow:hidden;background:#07050F;color:#F3EEFF;font-family:'Inter',system-ui,sans-serif;display:grid;place-items:center;animation:bt-in .25s ease both}
@keyframes bt-in{from{opacity:0}to{opacity:1}}
.bt-aurora{position:absolute;inset:-20%;background:
  radial-gradient(40% 40% at 20% 25%, rgba(255,77,141,.22), transparent 70%),
  radial-gradient(45% 45% at 82% 22%, rgba(139,125,246,.22), transparent 70%),
  radial-gradient(50% 50% at 50% 92%, rgba(70,224,176,.16), transparent 70%),
  radial-gradient(45% 45% at 78% 80%, rgba(76,201,240,.18), transparent 70%);
  filter:blur(20px);animation:bt-drift 14s ease-in-out infinite alternate}
@keyframes bt-drift{to{transform:translate3d(2%, -2%, 0) scale(1.05)}}
.bt-stage{position:relative;z-index:2;width:min(760px,92vw);min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px}
.bt-eyebrow{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.34em;text-transform:uppercase;margin-bottom:22px;opacity:0;animation:bt-up .5s .05s ease both}

/* intro */
.bt-intro{display:flex;flex-direction:column;align-items:center}
.bt-logo{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(72px,16vw,150px);line-height:.9;letter-spacing:-.03em;color:#FFC24B;text-shadow:0 8px 60px rgba(255,194,75,.5);animation:bt-pop .7s cubic-bezier(.34,1.7,.5,1) both}
.bt-boom{display:inline-block;margin-left:.08em;animation:bt-spin 1s .2s ease both}
.bt-tag{margin-top:14px;color:#A79FC7;font-size:clamp(15px,2.6vw,20px);animation:bt-up .6s .3s ease both}

/* generic scene card */
.bt-card{position:relative;width:min(540px,88vw);border-radius:24px;border:1px solid color-mix(in srgb,var(--a) 45%,#332A5A);background-image:linear-gradient(165deg,color-mix(in srgb,var(--a) 12%,rgba(24,19,47,.9)),rgba(14,11,26,.95));box-shadow:0 30px 80px -30px color-mix(in srgb,var(--a) 70%,transparent),inset 0 1px 0 rgba(255,255,255,.05);padding:34px 28px;display:flex;flex-direction:column;align-items:center;gap:18px;animation:bt-pop .55s cubic-bezier(.34,1.5,.5,1) both}
.bt-line{color:#C9C2E6;font-size:15px;margin-top:4px;animation:bt-up .5s .35s ease both}

/* sous-titres */
.bt-screen .bt-play{width:74px;height:74px;border-radius:20px;display:grid;place-items:center;background:var(--a);box-shadow:0 0 34px -4px var(--a);animation:bt-beat 1.1s ease-in-out infinite}
.bt-caption{display:inline-flex;align-items:center;gap:2px;font-family:'Space Mono',monospace;font-size:clamp(15px,3.4vw,22px);color:#fff}
.bt-type{display:inline-block;white-space:nowrap;overflow:hidden;border-right:0;width:0;animation:bt-typing 1.6s steps(24) .25s forwards}
.bt-caret{width:2px;height:1.1em;background:var(--a);display:inline-block;animation:bt-blink .7s steps(1) infinite}
@keyframes bt-typing{to{width:23ch}}
@keyframes bt-blink{50%{opacity:0}}

/* dessin */
.bt-house{filter:drop-shadow(0 6px 20px rgba(255,77,141,.5))}
.bt-draw{stroke-dasharray:220;stroke-dashoffset:220;animation:bt-stroke .9s .2s ease forwards}
.bt-draw.d2{animation-delay:.8s}
.bt-draw.d3{animation-delay:1.4s}
@keyframes bt-stroke{to{stroke-dashoffset:0}}
.bt-guess{margin-top:2px;padding:8px 16px;border-radius:999px;background:rgba(255,77,141,.16);border:1px solid rgba(255,77,141,.5);color:#fff;font-weight:700;opacity:0;transform:scale(.7);animation:bt-pop .5s 1.7s cubic-bezier(.34,1.7,.5,1) forwards}
.bt-guess b{color:#FF4D8D}

/* doublage */
.bt-mic{width:84px;height:84px;border-radius:24px;display:grid;place-items:center;background:rgba(70,224,176,.12);border:1px solid rgba(70,224,176,.4);box-shadow:0 0 30px -6px rgba(70,224,176,.7)}
.bt-eq{display:flex;align-items:flex-end;gap:6px;height:56px}
.bt-eq span{width:8px;height:100%;border-radius:4px;background:var(--a);transform-origin:bottom;transform:scaleY(.3);animation:bt-eq .7s ease-in-out infinite}
@keyframes bt-eq{0%,100%{transform:scaleY(.25)}50%{transform:scaleY(1)}}

/* quiz */
.bt-q{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:clamp(17px,3.4vw,22px);color:#fff}
.bt-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%}
.bt-opts span{padding:12px;border-radius:12px;border:1px solid #332A5A;background:rgba(28,22,54,.6);font-weight:600;color:#C9C2E6}
.bt-opts .ok{color:#052018;background:#46E0B0;border-color:#46E0B0;font-weight:800;opacity:.001;animation:bt-correct .45s 1.1s ease forwards}
@keyframes bt-correct{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}

/* reco */
.bt-reco{position:relative;width:min(320px,72vw);aspect-ratio:1/1;border-radius:18px;overflow:hidden;border:1px solid rgba(76,201,240,.4)}
.bt-recoimg{width:100%;height:100%;object-fit:cover;filter:blur(14px) brightness(.7);animation:bt-unblur 1s 1s ease forwards}
@keyframes bt-unblur{to{filter:blur(0) brightness(1)}}
.bt-lens{position:absolute;top:50%;left:0;transform:translate(-40%,-50%);filter:drop-shadow(0 6px 16px rgba(76,201,240,.7));animation:bt-sweep 1.1s ease-in-out forwards}
@keyframes bt-sweep{0%{left:0%}100%{left:78%}}
.bt-answer{padding:8px 16px;border-radius:999px;background:rgba(76,201,240,.16);border:1px solid rgba(76,201,240,.5);font-weight:700;opacity:0;animation:bt-up .5s 1.9s ease forwards}
.bt-answer b{color:#4CC9F0;text-transform:capitalize}

/* final */
.bt-final{display:flex;flex-direction:column;align-items:center}
.bt-fan{display:flex;justify-content:center;margin-bottom:8px}
.bt-fanimg{width:clamp(64px,15vw,104px);aspect-ratio:1/1;object-fit:cover;border-radius:16px;margin:0 -10px;border:2px solid rgba(255,255,255,.1);box-shadow:0 16px 40px -20px #000;transform:translateY(30px) rotate(0);opacity:0;animation:bt-fanin .6s cubic-bezier(.34,1.6,.5,1) forwards;animation-delay:calc(.1s + (var(--k) + 2) * .09s)}
.bt-fanimg{transform:rotate(calc(var(--k) * 8deg)) translateY(calc(var(--k) * var(--k) * 3px))}
@keyframes bt-fanin{from{opacity:0;transform:translateY(40px) rotate(0) scale(.8)}to{opacity:1}}
.bt-finaltitle{margin-top:14px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(48px,10vw,86px);color:#FFC24B;letter-spacing:-.02em;text-shadow:0 8px 50px rgba(255,194,75,.5);animation:bt-pop .6s .5s cubic-bezier(.34,1.6,.5,1) both}
.bt-cta{margin-top:20px;border:none;cursor:pointer;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:18px;color:#0E0B1A;background:#FFC24B;padding:15px 30px;border-radius:16px;box-shadow:0 6px 0 #B47F16,0 18px 40px -14px rgba(255,194,75,.9);opacity:0;animation:bt-up .5s .8s ease forwards,bt-cta-pulse 1.8s 1.3s ease-in-out infinite}
.bt-cta:hover{filter:brightness(1.05)}
.bt-cta:active{transform:translateY(5px);box-shadow:0 1px 0 #B47F16}
@keyframes bt-cta-pulse{0%,100%{box-shadow:0 6px 0 #B47F16,0 0 0 0 rgba(255,194,75,.5)}50%{box-shadow:0 6px 0 #B47F16,0 0 0 12px rgba(255,194,75,0)}}

/* shared keyframes */
@keyframes bt-pop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
@keyframes bt-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes bt-spin{from{transform:rotate(-25deg) scale(0)}to{transform:rotate(0) scale(1)}}
@keyframes bt-beat{50%{transform:scale(1.08)}}

/* confetti */
.bt-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.bt-confetti span{position:absolute;top:-8%;border-radius:2px;animation-name:bt-fall;animation-timing-function:linear;animation-iteration-count:1}
@keyframes bt-fall{to{transform:translateY(120vh) rotate(600deg);opacity:.2}}

/* controls */
.bt-close{position:absolute;top:18px;right:18px;z-index:4;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;border:1px solid #332A5A;background:rgba(14,11,26,.6);color:#C9C2E6;cursor:pointer;transition:.15s}
.bt-close:hover{color:#FFC24B;border-color:rgba(255,194,75,.5)}
.bt-reel{position:absolute;top:20px;left:50%;transform:translateX(-50%);z-index:4;display:flex;gap:6px;width:min(420px,70vw)}
.bt-seg{flex:1;height:5px;padding:0;border:none;border-radius:999px;background:rgba(255,255,255,.14);overflow:hidden;cursor:pointer}
.bt-segfill{display:block;height:100%;border-radius:999px;background:#F3EEFF}
@keyframes bt-fill{from{width:0%}to{width:100%}}
.bt-hint{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);z-index:4}
.bt-skip{border:none;background:transparent;color:#6E6796;font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;transition:.15s}
.bt-skip:hover{color:#F3EEFF}

@media (prefers-reduced-motion: reduce){
  .bt-confetti{display:none}
  .bt-logo,.bt-card,.bt-finaltitle,.bt-cta,.bt-fanimg{animation-duration:.01s!important}
  .bt-eq span,.bt-play{animation:none}
}
`;
