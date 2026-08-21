"use client";

import { useEffect, useRef, useState } from "react";
import type { UseRoom } from "@/lib/useRoom";

// ---------------------------------------------------------------------------
// Game sound effects — synthesised with the Web Audio API (no asset files, no
// network, works offline). One shared engine + one mute state for every game.
// ---------------------------------------------------------------------------

let soundOn = true;
if (typeof window !== "undefined") {
  soundOn = window.localStorage.getItem("stp-sound") !== "off";
}

let audioCtx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(freq: number, durMs: number, gain = 0.05, type: OscillatorType = "sine", delay = 0) {
  if (!soundOn) return;
  const c = audio();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(c.destination);
    const t = c.currentTime + delay;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
    o.start(t);
    o.stop(t + durMs / 1000 + 0.02);
  } catch {
    /* ignore */
  }
}

/** Named sound effects for each game situation. */
export type SoundName =
  | "tick" // urgency countdown
  | "chime" // generic positive
  | "correct" // someone found the word
  | "youFound" // YOU found the word
  | "fanfare" // final winner / champion
  | "win" // game over
  | "join" // a player joined
  | "start" // a round / turn begins
  | "yourTurn" // it's your turn (to draw / the pen is yours)
  | "reveal" // the word / impostor is revealed
  | "vote" // a vote was cast
  | "wrong" // your guess was wrong
  | "timeUp" // the phase timed out
  | "click"; // small UI feedback

export function playSound(name: SoundName) {
  switch (name) {
    case "tick":
      return tone(880, 90, 0.04, "triangle");
    case "chime":
      tone(620, 150, 0.05);
      return tone(930, 240, 0.05, "sine", 0.12);
    case "correct":
      tone(660, 130, 0.05, "triangle");
      return tone(990, 220, 0.05, "triangle", 0.11);
    case "youFound":
      [660, 880, 1174].forEach((f, i) => tone(f, 180, 0.06, "triangle", i * 0.09));
      return;
    case "fanfare":
    case "win":
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 220, 0.06, "triangle", i * 0.11));
      return;
    case "join":
      return tone(523, 120, 0.035, "sine");
    case "start":
      tone(392, 130, 0.045, "sine");
      return tone(523, 200, 0.045, "sine", 0.11);
    case "yourTurn":
      [523, 659, 784].forEach((f, i) => tone(f, 150, 0.055, "triangle", i * 0.08));
      return;
    case "reveal":
      tone(440, 160, 0.045, "sine");
      return tone(660, 260, 0.045, "sine", 0.12);
    case "vote":
      return tone(320, 90, 0.05, "square");
    case "wrong":
      tone(196, 130, 0.035, "sawtooth");
      return tone(147, 200, 0.035, "sawtooth", 0.1);
    case "timeUp":
      tone(400, 160, 0.05, "sawtooth");
      return tone(200, 280, 0.05, "sawtooth", 0.14);
    case "click":
      return tone(700, 40, 0.03, "triangle");
  }
}

// Back-compat helpers used by the subtitles view.
export const playTick = () => playSound("tick");
export const playChime = () => playSound("chime");
export const playFanfare = () => playSound("fanfare");

export function isSoundOn() {
  return soundOn;
}
export function setSoundOn(on: boolean) {
  soundOn = on;
  if (typeof window !== "undefined") window.localStorage.setItem("stp-sound", on ? "on" : "off");
  if (on) audio();
}

export function SoundToggle({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(soundOn);
  return (
    <button
      onClick={() => {
        setSoundOn(!on);
        setOn(!on);
        if (!on) playSound("click");
      }}
      className={`rounded-md border border-ink-border px-2 py-1 text-xs text-text-muted transition-colors hover:border-gold ${className}`}
      title={on ? "Couper les sons du jeu" : "Activer les sons du jeu"}
      aria-label={on ? "Couper les sons du jeu" : "Activer les sons du jeu"}
    >
      {on ? "🔔" : "🔕"}
    </button>
  );
}

/**
 * Fires sound effects from room state transitions. Call once, high in the tree.
 * Subtitles keeps its own ticks/chime (handled in its view); this covers the
 * draw / fake-artist / relay games plus the global "player joined" cue.
 */
export function useGameSounds(room: UseRoom) {
  const gid = room.gameId;
  const game = room.game as
    | (Record<string, unknown> & { phase?: string; deadline?: number | null; voteCount?: number })
    | null;
  const inDrawFamily = gid === "draw" || gid === "relay" || gid === "fakeartist";

  // A player joined the room.
  const prevCount = useRef<number | null>(null);
  const count = room.state?.playerOrder.length ?? 0;
  useEffect(() => {
    if (prevCount.current !== null && count > prevCount.current) playSound("join");
    prevCount.current = count;
  }, [count]);

  // Correct guesses (draw + relay use the chat feed).
  const lastChatId = useRef(-1);
  useEffect(() => {
    for (const m of room.chat) {
      if (m.id <= lastChatId.current) continue;
      if (m.kind === "correct") playSound(m.from === room.you ? "youFound" : "correct");
      else if (m.kind === "guess" && m.from === room.you) playSound("wrong");
    }
    if (room.chat.length) lastChatId.current = Math.max(lastChatId.current, room.chat[room.chat.length - 1].id);
  }, [room.chat, room.you]);

  // Phase transitions: round start, reveal, game over, and "your turn".
  const prevPhase = useRef<string | null>(null);
  const prevYourTurn = useRef(false);
  const phase = (game?.phase as string | undefined) ?? undefined;
  const youAreDrawer = (game as { youAreDrawer?: boolean } | null)?.youAreDrawer ?? false;
  const youAreActive = (game as { youAreActive?: boolean } | null)?.youAreActive ?? false;
  useEffect(() => {
    if (!inDrawFamily) {
      prevPhase.current = phase ?? null;
      return;
    }
    if (phase && phase !== prevPhase.current) {
      if (phase === "drawing") playSound("start");
      else if (phase === "reveal") playSound("reveal");
      else if (phase === "scoreboard") playSound("win");
    }
    prevPhase.current = phase ?? null;

    const yourTurn =
      gid === "draw" ? youAreDrawer && (phase === "choosing" || phase === "drawing") : gid === "relay" ? youAreActive : false;
    if (yourTurn && !prevYourTurn.current) playSound("yourTurn");
    prevYourTurn.current = yourTurn;
  }, [inDrawFamily, gid, phase, youAreDrawer, youAreActive]);

  // A vote was cast (fake-artist / relay expose voteCount).
  const prevVotes = useRef(0);
  const voteCount = game?.voteCount ?? 0;
  useEffect(() => {
    if (voteCount > prevVotes.current) playSound("vote");
    prevVotes.current = voteCount;
  }, [voteCount]);

  // Urgency ticks in the final seconds of a timed phase.
  const prevSec = useRef<number | null>(null);
  const deadline = game?.deadline ?? null;
  useEffect(() => {
    if (!inDrawFamily || deadline == null) {
      prevSec.current = null;
      return;
    }
    const id = setInterval(() => {
      const sec = Math.ceil((deadline - room.serverNow()) / 1000);
      if (prevSec.current !== null && sec < prevSec.current && sec <= 3 && sec >= 1) playSound("tick");
      prevSec.current = sec;
    }, 250);
    return () => clearInterval(id);
  }, [inDrawFamily, deadline, room]);
}
