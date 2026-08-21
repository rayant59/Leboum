// ---------------------------------------------------------------------------
// Real-time transport abstraction.
//
// The UI talks to `RoomTransport`, never to the socket directly. This is the
// seam that let us swap the whole real-time layer (PartyKit -> plain Node ws)
// without touching a single component. Swapping again later is one new impl.
// ---------------------------------------------------------------------------

import type { ClientMessage, ServerMessage } from "@subtitles-party/shared";

export type ConnectionStatus = "connecting" | "open" | "closed";

export interface RoomTransport {
  send(msg: ClientMessage): void;
  onMessage(cb: (msg: ServerMessage) => void): () => void;
  onStatus(cb: (status: ConnectionStatus) => void): () => void;
  close(): void;
}

export interface WebSocketTransportOptions {
  host: string; // e.g. "localhost:1999"
  room: string;
  playerId: string;
}

/**
 * A reconnecting WebSocket transport. Buffers sends while offline and flushes
 * them on reconnect, so a dropped Wi-Fi blip doesn't lose the player's action.
 */
export function createWebSocketTransport(
  opts: WebSocketTransportOptions,
): RoomTransport {
  const msgCbs = new Set<(m: ServerMessage) => void>();
  const statusCbs = new Set<(s: ConnectionStatus) => void>();
  const outbox: string[] = [];

  let ws: WebSocket | null = null;
  let closedByUs = false;
  let attempts = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const url = () => {
    const proto =
      typeof location !== "undefined" && location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${opts.host}/?room=${encodeURIComponent(
      opts.room,
    )}&id=${encodeURIComponent(opts.playerId)}`;
  };

  const emitStatus = (s: ConnectionStatus) => statusCbs.forEach((cb) => cb(s));

  function connect() {
    emitStatus("connecting");
    ws = new WebSocket(url());

    ws.onopen = () => {
      attempts = 0;
      emitStatus("open");
      while (outbox.length) ws!.send(outbox.shift()!);
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as ServerMessage;
        msgCbs.forEach((cb) => cb(msg));
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      emitStatus("closed");
      if (closedByUs) return;
      const delay = Math.min(1000 * 2 ** attempts, 8000);
      attempts++;
      retryTimer = setTimeout(connect, delay);
    };
    ws.onerror = () => ws?.close();
  }

  connect();

  return {
    send(msg) {
      const data = JSON.stringify(msg);
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
      else outbox.push(data);
    },
    onMessage(cb) {
      msgCbs.add(cb);
      return () => msgCbs.delete(cb);
    },
    onStatus(cb) {
      statusCbs.add(cb);
      cb(ws?.readyState === WebSocket.OPEN ? "open" : "connecting");
      return () => statusCbs.delete(cb);
    },
    close() {
      closedByUs = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    },
  };
}
