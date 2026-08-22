"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  DEFAULT_GAME_SETTINGS,
  SUBTITLES_GAME_ID,
  type GameSettings,
  type PublicGameState,
  type AnyPublicGame,
  type DrawStroke,
  type PublicRoomState,
  type RoomErrorCode,
  type SubtitlesErrorCode,
  type DoublageClientAction,
} from "@subtitles-party/shared";
import { getPlayerId } from "./identity";
import {
  createWebSocketTransport,
  type ConnectionStatus,
  type RoomTransport,
} from "./transport";

const WS_PORT = process.env.NEXT_PUBLIC_WS_PORT ?? "1999";

/** Where the realtime server lives. Defaults to the SAME host the page was
 *  opened from, on the ws port — so opening the app via the PC's local IP
 *  (e.g. http://192.168.1.42:3000) lets phones on the same Wi-Fi play too.
 *  An explicit NEXT_PUBLIC_WS_HOST overrides this (e.g. for a deployed server). */
function wsHost(): string {
  if (process.env.NEXT_PUBLIC_WS_HOST) return process.env.NEXT_PUBLIC_WS_HOST;
  if (typeof window !== "undefined" && window.location.hostname) {
    return `${window.location.hostname}:${WS_PORT}`;
  }
  return `localhost:${WS_PORT}`;
}

export interface RoomError {
  code: RoomErrorCode | SubtitlesErrorCode | string;
  message: string;
}

/** A live emoji reaction floating up on screen (ephemeral). */
export interface FloatingReaction {
  id: number;
  emoji: string;
  x: number; // horizontal position, 0–100 (%)
}

export interface ChatEntry {
  id: number;
  from: string;
  name: string;
  text: string;
  kind: "guess" | "correct" | "system" | "talk";
}

export type StrokeEvent =
  | { id: number; type: "stroke"; stroke: DrawStroke; from?: string }
  | { id: number; type: "fill"; x: number; y: number; color: string; from?: string }
  | { id: number; type: "clear"; from?: string };

export interface UseRoom {
  state: PublicRoomState | null;
  gameId: string | null;
  game: AnyPublicGame | null;
  settings: GameSettings;
  you: string;
  status: ConnectionStatus;
  error: RoomError | null;
  clearError: () => void;
  join: (name: string) => void;
  setReady: (ready: boolean) => void;
  setName: (name: string) => void;
  setAvatar: (avatar: string | null) => void;
  setSettings: (settings: GameSettings) => void;
  startGame: (gameId?: string, settings?: unknown) => void;
  leave: () => void;
  submitLines: (lines: string[]) => void;
  vote: (token: string) => void;
  skipPhase: () => void;
  debugFill: () => void;
  returnLobby: () => void;
  playAgain: () => void;
  react: (emoji: string) => void;
  reactions: FloatingReaction[];
  speakingIds: Set<string>;
  sendSpeaking: (speaking: boolean) => void;
  quizAnswer: (value: number | boolean | string) => void;
  // draw game
  chooseWord: (word: string) => void;
  guess: (text: string) => void;
  sendTalk: (text: string) => void;
  revealTheme: () => void;
  endDrawing: () => void;
  castVote: (targetId: string) => void;
  doublageAction: (action: DoublageClientAction) => void;
  sendStroke: (stroke: DrawStroke) => void;
  sendFill: (x: number, y: number, color: string) => void;
  clearCanvas: () => void;
  chat: ChatEntry[];
  strokeQueueRef: MutableRefObject<StrokeEvent[]>;
  strokeResetRef: MutableRefObject<number>;
  /** Best estimate of the server's clock — use for timers and video sync. */
  serverNow: () => number;
}

export function useRoom(code: string): UseRoom {
  const playerId = useMemo(() => getPlayerId(), []);
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<AnyPublicGame | null>(null);
  const [settings, setSettingsState] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
  const [you, setYou] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<RoomError | null>(null);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const strokeQueueRef = useRef<StrokeEvent[]>([]);
  const strokeResetRef = useRef(0);
  const eventId = useRef(0);
  const reactionId = useRef(0);
  const transportRef = useRef<RoomTransport | null>(null);
  const clockOffset = useRef(0);

  useEffect(() => {
    if (!code || !playerId) return;
    const transport = createWebSocketTransport({ host: wsHost(), room: code, playerId });
    transportRef.current = transport;

    const offMsg = transport.onMessage((msg) => {
      if (msg.type === "state") {
        clockOffset.current = msg.serverTime - Date.now();
        setState(msg.state);
        setGameId(msg.gameId);
        setGame(msg.game);
        setSettingsState(msg.settings);
        setYou(msg.you);
        if (msg.state.phase !== "in_game") {
          setChat([]);
          strokeQueueRef.current = [];
          strokeResetRef.current++;
        }
      } else if (msg.type === "error") {
        setError({ code: msg.code, message: msg.message });
      } else if (msg.type === "chat") {
        setChat((prev) => [...prev.slice(-80), { id: eventId.current++, from: msg.from, name: msg.name, text: msg.text, kind: msg.kind }]);
      } else if (msg.type === "stroke") {
        strokeQueueRef.current.push({ id: eventId.current++, type: "stroke", stroke: msg.stroke, from: msg.from });
        if (strokeQueueRef.current.length > 9000) strokeQueueRef.current.splice(0, strokeQueueRef.current.length - 9000);
      } else if (msg.type === "fill") {
        strokeQueueRef.current.push({ id: eventId.current++, type: "fill", x: msg.x, y: msg.y, color: msg.color, from: msg.from });
        if (strokeQueueRef.current.length > 9000) strokeQueueRef.current.splice(0, strokeQueueRef.current.length - 9000);
      } else if (msg.type === "draw_clear") {
        strokeQueueRef.current.push({ id: eventId.current++, type: "clear", from: msg.from });
      } else if (msg.type === "reaction") {
        const id = reactionId.current++;
        const x = 8 + Math.random() * 84;
        setReactions((prev) => [...prev.slice(-24), { id, emoji: msg.emoji, x }]);
        setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2300);
      } else if (msg.type === "speaking") {
        setSpeakingIds((prev) => {
          const next = new Set(prev);
          if (msg.speaking) next.add(msg.from);
          else next.delete(msg.from);
          return next;
        });
      }
    });
    const offStatus = transport.onStatus(setStatus);

    return () => {
      offMsg();
      offStatus();
      transport.close();
      transportRef.current = null;
    };
  }, [code, playerId]);

  const send = transportRef;

  const join = useCallback(
    (name: string) => {
      send.current?.send({ type: "join", name });
      // Re-apply a previously chosen avatar (persisted locally) after joining.
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("stp-avatar");
        if (saved) send.current?.send({ type: "set_avatar", avatar: saved });
      }
    },
    [send],
  );
  const setReady = useCallback((ready: boolean) => send.current?.send({ type: "set_ready", ready }), [send]);
  const setName = useCallback((name: string) => send.current?.send({ type: "set_name", name }), [send]);
  const setAvatar = useCallback(
    (avatar: string | null) => {
      if (typeof window !== "undefined") {
        if (avatar) window.localStorage.setItem("stp-avatar", avatar);
        else window.localStorage.removeItem("stp-avatar");
      }
      send.current?.send({ type: "set_avatar", avatar });
    },
    [send],
  );
  const setSettings = useCallback(
    (s: GameSettings) => send.current?.send({ type: "set_settings", settings: s }),
    [send],
  );
  const startGame = useCallback(
    (gid: string = SUBTITLES_GAME_ID, settings?: unknown) =>
      send.current?.send({ type: "start_game", gameId: gid, settings }),
    [send],
  );
  const chooseWord = useCallback(
    (word: string) => send.current?.send({ type: "game", action: { kind: "choose_word", word } }),
    [send],
  );
  const guess = useCallback(
    (text: string) => send.current?.send({ type: "game", action: { kind: "guess", text } }),
    [send],
  );
  const revealTheme = useCallback(
    () => send.current?.send({ type: "game", action: { kind: "reveal_theme" } }),
    [send],
  );
  const endDrawing = useCallback(
    () => send.current?.send({ type: "game", action: { kind: "end_drawing" } }),
    [send],
  );
  const sendTalk = useCallback((text: string) => send.current?.send({ type: "chat", text }), [send]);
  const castVote = useCallback(
    (targetId: string) => send.current?.send({ type: "game", action: { kind: "vote", targetId } }),
    [send],
  );
  const doublageAction = useCallback(
    (action: DoublageClientAction) => send.current?.send({ type: "game", action }),
    [send],
  );
  const sendSpeaking = useCallback((speaking: boolean) => send.current?.send({ type: "speaking", speaking }), [send]);
  const quizAnswer = useCallback((value: number | boolean | string) => send.current?.send({ type: "game", action: { kind: "answer", value } }), [send]);
  const sendStroke = useCallback(
    (stroke: DrawStroke) => send.current?.send({ type: "draw_stroke", stroke }),
    [send],
  );
  const sendFill = useCallback(
    (x: number, y: number, color: string) => send.current?.send({ type: "draw_fill", x, y, color }),
    [send],
  );
  const clearCanvas = useCallback(() => send.current?.send({ type: "draw_clear" }), [send]);
  const leave = useCallback(() => send.current?.send({ type: "leave" }), [send]);
  const submitLines = useCallback(
    (lines: string[]) => send.current?.send({ type: "game", action: { kind: "submit", lines } }),
    [send],
  );
  const vote = useCallback(
    (token: string) => send.current?.send({ type: "game", action: { kind: "vote", token } }),
    [send],
  );
  const skipPhase = useCallback(() => send.current?.send({ type: "skip" }), [send]);
  const debugFill = useCallback(() => send.current?.send({ type: "debug_fill" }), [send]);
  const returnLobby = useCallback(() => send.current?.send({ type: "return_lobby" }), [send]);
  const playAgain = useCallback(() => send.current?.send({ type: "play_again" }), [send]);
  const react = useCallback((emoji: string) => send.current?.send({ type: "react", emoji }), [send]);
  const clearError = useCallback(() => setError(null), []);
  const serverNow = useCallback(() => Date.now() + clockOffset.current, []);

  return {
    state, gameId, game, settings, you, status, error, clearError,
    join, setReady, setName, setAvatar, setSettings, startGame, leave,
    submitLines, vote, skipPhase, debugFill, returnLobby, playAgain, react, reactions, speakingIds, sendSpeaking, quizAnswer,
    chooseWord, guess, sendTalk, castVote, doublageAction, revealTheme, endDrawing, sendStroke, sendFill, clearCanvas, chat, strokeQueueRef, strokeResetRef, serverNow,
  };
}
