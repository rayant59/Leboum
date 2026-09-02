"use client";

import { useEffect, useRef, useState } from "react";
import { BOMBE_ALPHABET } from "@subtitles-party/shared";
import type { BombePublic } from "@subtitles-party/shared";
import type { UseRoom } from "@/lib/useRoom";
import { Avatar } from "@/components/Avatar";
import { BoumBackdrop } from "@/components/BoumBackdrop";
import { ResultsScreen } from "@/components/ResultsScreen";
import { SoundToggle, playSound } from "@/lib/sound";

/** Fraction de temps écoulée vers la borne haute (0 → 1). Sert UNIQUEMENT à
 *  l'animation : le vrai instant d'explosion reste secret côté serveur. */
function useFuse(game: BombePublic, serverNow: () => number) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 80);
    return () => clearInterval(id);
  }, []);
  if (game.phase !== "playing") return 0;
  const span = Math.max(1, game.maxMs);
  const elapsed = serverNow() - game.turnStartedAt;
  return Math.max(0, Math.min(1, elapsed / span));
}

function Hearts({ n, max }: { n: number; max: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} vies`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`text-[15px] leading-none ${i < n ? "" : "opacity-25 grayscale"}`}>
          {i < n ? "❤️" : "🖤"}
        </span>
      ))}
    </span>
  );
}

/** Grille des lettres A-V : découvertes en surbrillance, à découvrir en grisé. */
function LettersGrid({ used }: { used: string[] }) {
  const set = new Set(used);
  return (
    <div className="mx-auto mt-4 max-w-md">
      <p className="eyebrow mb-1.5 text-center text-text-faint">Lettres · {set.size}/{BOMBE_ALPHABET.length} <span className="text-gold">(nouvelle lettre = +1 ❤️)</span></p>
      <div className="flex flex-wrap justify-center gap-1">
        {BOMBE_ALPHABET.map((l) => {
          const on = set.has(l);
          return (
            <span
              key={l}
              className={`grid h-7 w-7 place-items-center rounded-md border font-display text-sm font-bold ${on ? "border-mint/60 bg-mint/15 text-mint" : "border-ink-border bg-ink-deep text-text-faint opacity-50"}`}
            >
              {l}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Toast « nouvelle lettre » — non bloquant, disparaît tout seul. */
function LetterToast({ ev, nameOf }: { ev: BombePublic["letterEvent"]; nameOf: (id: string | null) => string }) {
  if (!ev) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4" style={{ animation: "revealPop 0.35s ease-out" }}>
      <div className="rounded-2xl border-2 border-gold/60 bg-[rgba(20,16,42,0.95)] px-5 py-3 text-center shadow-[0_10px_40px_-10px_rgba(255,194,75,0.6)]">
        {ev.gainedLife ? (
          <>
            <p className="font-display text-lg font-extrabold text-gold">🔤 NOUVELLE LETTRE ! <span className="text-magenta">+1 ❤️</span></p>
            <p className="text-sm text-text-muted">{nameOf(ev.playerId)} découvre : <b className="text-mint">{ev.newLetters.join(" · ")}</b></p>
          </>
        ) : (
          <>
            <p className="font-display text-lg font-extrabold text-gold">🔤 LETTRE DÉCOUVERTE</p>
            <p className="text-sm text-text-muted">❤️ Vie maximale atteinte · <b className="text-mint">{ev.newLetters.join(" · ")}</b></p>
          </>
        )}
      </div>
    </div>
  );
}

export function BombeView({ room }: { room: UseRoom }) {
  const game = room.game as BombePublic;
  const you = room.you;
  const isHost = room.state?.hostId === you;
  const fuse = useFuse(game, room.serverNow);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastTypedRef = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<BombePublic["letterEvent"]>(null);

  // Live typing : le joueur actif diffuse son texte (throttlé ~120ms).
  function pushTyping(v: string) {
    const val = v.trim().slice(0, 48);
    const now = Date.now();
    const elapsed = now - lastTypedRef.current;
    if (elapsed >= 120) { lastTypedRef.current = now; room.sendBombeTyping(val); }
    else {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => { lastTypedRef.current = Date.now(); room.sendBombeTyping(val); }, 120 - elapsed);
    }
  }
  function onType(v: string) {
    setText(v);
    if (room.error) room.clearError();
    if (game.youAreCurrent) pushTyping(v);
  }

  // Toast « nouvelle lettre » (déclenché par letterEvent.at, non bloquant).
  const lastLetterAt = useRef(0);
  useEffect(() => {
    const ev = game.letterEvent;
    if (ev && ev.at !== lastLetterAt.current) {
      lastLetterAt.current = ev.at;
      setToast(ev);
      playSound(ev.gainedLife ? "youFound" : "chime");
      const t = setTimeout(() => setToast(null), 2600);
      return () => clearTimeout(t);
    }
  }, [game.letterEvent]);

  const byId = new Map(game.players.map((p) => [p.id, p]));
  const nameOf = (id: string | null) => (id ? byId.get(id)?.name ?? "?" : "?");
  const currentName = nameOf(game.currentId);

  // Nouvelle syllabe / nouveau tour → on nettoie l'input et l'erreur, et on refocus.
  const turnKey = `${game.currentId}|${game.syllable}|${game.usedCount}`;
  const prevTurn = useRef(turnKey);
  useEffect(() => {
    if (prevTurn.current !== turnKey) {
      prevTurn.current = turnKey;
      setText("");
      room.clearError();
      if (game.youAreCurrent) setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [turnKey, game.youAreCurrent, room]);

  // Sons : c'est à toi, mot validé, explosion, victoire, tic-tac de fin.
  const prevCurrent = useRef<string | null>(null);
  useEffect(() => {
    if (game.phase === "playing" && game.youAreCurrent && prevCurrent.current !== game.currentId) {
      playSound("yourTurn");
    }
    prevCurrent.current = game.currentId;
  }, [game.currentId, game.youAreCurrent, game.phase]);

  const prevUsed = useRef(game.usedCount);
  useEffect(() => {
    if (game.usedCount > prevUsed.current) playSound("correct");
    prevUsed.current = game.usedCount;
  }, [game.usedCount]);

  const prevExploded = useRef<string | null>(null);
  useEffect(() => {
    if (game.justExploded && game.justExploded !== prevExploded.current) playSound("timeUp");
    prevExploded.current = game.justExploded;
  }, [game.justExploded]);

  const prevPhase = useRef(game.phase);
  useEffect(() => {
    if (prevPhase.current !== game.phase && game.phase === "gameover") playSound("win");
    prevPhase.current = game.phase;
  }, [game.phase]);

  const tickRef = useRef(false);
  useEffect(() => {
    if (game.phase === "playing" && game.youAreCurrent && fuse > 0.66 && !tickRef.current) {
      playSound("tick");
      tickRef.current = true;
      setTimeout(() => (tickRef.current = false), 500);
    }
  }, [fuse, game.youAreCurrent, game.phase]);

  function send() {
    const t = text.trim();
    if (!t) return;
    room.bombeSubmit(t);
    room.sendBombeTyping(""); // efface l'aperçu live chez les autres
  }

  // Aperçu live du joueur actif (visible par les AUTRES uniquement).
  const liveTyping = !game.youAreCurrent && room.bombeTyping && room.bombeTyping.from === game.currentId ? room.bombeTyping.text : "";

  // --- écran de victoire ----------------------------------------------------
  if (game.phase === "gameover") {
    return (
      <>
        <BoumBackdrop />
        <main className="relative z-[1] mx-auto max-w-2xl px-5 py-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
          <ResultsScreen
            ranking={game.ranking.map((r) => ({ id: r.id, name: r.name, color: r.color, avatar: r.avatar, score: r.wordsFound }))}
            you={you}
            stats={{ fastest: null, brain: game.stats?.words ?? null, streak: null }}
            isHost={isHost}
            onReturn={() => room.returnLobby()}
            onReplay={() => room.playAgain()}
          />
          <p className="mt-4 text-center text-xs text-text-faint">Le score affiché = nombre de mots trouvés · 🧠 = le plus de mots</p>
        </main>
      </>
    );
  }

  // --- couleur de danger selon le temps écoulé ------------------------------
  const danger = fuse; // 0 → 1
  const bombColor = danger < 0.5 ? "#FFC24B" : danger < 0.8 ? "#FF8A3D" : "#FF4D4D";
  const shake = danger > 0.55;
  const exploded = game.justExploded;

  return (
    <>
      <BoumBackdrop />
      <LetterToast ev={toast} nameOf={nameOf} />
      <main className="relative z-[1] mx-auto max-w-3xl px-4 py-5" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow">💣 Bombe · {game.aliveCount} en vie · {game.usedCount} mots joués</span>
          <div className="flex items-center gap-2">
            <SoundToggle />
            {isHost && <button onClick={() => room.skipPhase()} className="rounded-md border border-ink-border px-2 py-1 text-xs text-text-muted transition-colors hover:border-magenta hover:text-magenta" title="Faire exploser maintenant (hôte)">💥 Skip</button>}
          </div>
        </div>

        {/* La bombe */}
        <section className="grid place-items-center py-4">
          <div
            className="relative grid place-items-center"
            style={{ width: 220, height: 220 }}
          >
            {/* anneau de minuterie (se vide vers la borne haute) */}
            <svg width="220" height="220" viewBox="0 0 220 220" className="absolute inset-0 -rotate-90">
              <circle cx="110" cy="110" r="100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <circle
                cx="110" cy="110" r="100" fill="none" stroke={bombColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 100}
                strokeDashoffset={2 * Math.PI * 100 * danger}
                style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.3s" }}
              />
            </svg>
            {/* corps de la bombe */}
            <div
              className="grid place-items-center rounded-full"
              style={{
                width: 168, height: 168,
                background: exploded
                  ? "radial-gradient(circle, #FF4D4D, #7a1010)"
                  : `radial-gradient(circle at 38% 32%, #3a3357, #14102a)`,
                boxShadow: `0 0 ${20 + danger * 50}px ${bombColor}${exploded ? "" : "55"}, inset 0 4px 12px rgba(0,0,0,0.5)`,
                border: `2px solid ${bombColor}66`,
                animation: exploded ? "bombPop 0.5s ease-out" : shake ? `wiggle ${0.5 - danger * 0.3}s ease-in-out infinite` : undefined,
              }}
            >
              {exploded ? (
                <span className="text-6xl" style={{ animation: "bombPop 0.5s ease-out" }}>💥</span>
              ) : (
                <div className="text-center">
                  <div className="font-display text-5xl font-black tracking-wider text-white" style={{ textShadow: `0 2px 16px ${bombColor}` }}>
                    {game.syllable.toUpperCase()}
                  </div>
                </div>
              )}
            </div>
            {/* mèche/étincelle */}
            {!exploded && (
              <span className="absolute -top-1 right-8 text-2xl" style={{ animation: `wiggle ${Math.max(0.15, 0.5 - danger * 0.35)}s ease-in-out infinite` }}>🔥</span>
            )}
          </div>

          {/* à qui de jouer */}
          <div className="mt-3 text-center">
            {exploded ? (
              <p className="font-display text-xl font-extrabold text-magenta animate-pop">💥 {nameOf(exploded)} a explosé !</p>
            ) : game.youAreCurrent ? (
              <p className="font-display text-2xl font-extrabold text-mint animate-pop">À toi de jouer ! 🔥</p>
            ) : (
              <p className="font-display text-xl font-bold text-text">
                Au tour de <span className="text-gold">{currentName}</span>…
              </p>
            )}
            {liveTyping && !exploded && (
              <p className="mt-1 font-mono text-sm text-mint animate-pop">✍️ {currentName} écrit : <b>{liveTyping}</b></p>
            )}
            {game.lastWord && !exploded && (
              <p className="mt-1 text-sm text-text-muted">
                Dernier mot : <b className="text-mint">{game.lastWord}</b>{game.lastWordBy && <> par {nameOf(game.lastWordBy)}</>}
              </p>
            )}
          </div>

          {/* saisie (joueur courant uniquement) */}
          {game.youAreCurrent && !exploded ? (
            <div className="mt-4 w-full max-w-md">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => onType(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={`un mot avec « ${game.syllable.toUpperCase()} »…`}
                  className="flex-1 rounded-2xl border-2 border-gold/50 bg-ink-deep px-4 py-3.5 text-lg outline-none focus:border-gold"
                />
                <button onClick={send} className="arc arc-p" style={{ padding: "0 22px" }}>OK</button>
              </div>
              {room.error && (
                <p key={room.error.message} className="mt-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-center text-sm text-danger" style={{ animation: "shake 0.32s" }}>
                  ❌ {room.error.message} <span className="text-text-faint">(le timer continue, réessaie !)</span>
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 h-[52px] text-center text-sm text-text-faint">
              {exploded ? "La bombe passe au joueur suivant…" : `Trouve un mot contenant « ${game.syllable.toUpperCase()} ».`}
            </p>
          )}
        </section>

        {/* joueurs + vies */}
        <section className="mx-auto mt-2 max-w-md space-y-2">
          {game.ranking.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border p-2.5 transition-all"
              style={{
                borderColor: r.isCurrent ? "rgba(70,224,176,0.6)" : r.eliminated ? "#2a2340" : "#332A5A",
                background: r.isCurrent ? "rgba(70,224,176,0.08)" : "rgba(28,22,54,0.5)",
                opacity: r.eliminated ? 0.5 : 1,
              }}
            >
              <Avatar name={r.name} color={r.color} avatar={r.avatar} size={30} />
              <span className="flex-1 truncate font-medium">
                {r.name}{r.id === you && " (toi)"}
                {r.isCurrent && !r.eliminated && <span className="ml-2 text-xs font-bold text-mint">● à lui</span>}
              </span>
              {r.wordsFound > 0 && <span className="font-mono text-xs text-text-faint">{r.wordsFound} mot{r.wordsFound > 1 ? "s" : ""}</span>}
              {r.eliminated ? <span className="text-lg" title="Éliminé">💀</span> : <Hearts n={r.lives} max={game.maxLives} />}
            </div>
          ))}
        </section>

        {/* Lettres A-V découvertes */}
        <LettersGrid used={game.usedLetters} />
      </main>
    </>
  );
}
