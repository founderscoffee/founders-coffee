import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CHAT_ROOM_CLOSES,
  HEARTBEAT_FRAME,
  HEARTBEAT_INTERVAL_MS,
} from '@founders-coffee/core/rooms';

import type { ChatMessageView } from './api';
import type { ChatRemoval } from './chat-cache';
import { parseChatFrame } from './chat-frames';

export type ChatEnding = 'closed' | 'revoked' | 'signed_out' | 'paused';

export type ChatConnection =
  'connecting' | 'live' | 'reconnecting' | 'offline' | ChatEnding;

export type ChatSocketHandlers = {
  readonly onMessage: (message: ChatMessageView) => void;
  readonly onRemoved: (removed: ChatRemoval) => void;
  readonly onCatchUp: () => void;
  readonly onClosed: () => void;
};

export const CHAT_RECONNECT_DELAY_MS = { first: 1_000, longest: 30_000 };
export const CHAT_POLL_INTERVAL_MS = 15_000;
export const CHAT_FAILURES_BEFORE_POLLING = 3;

/** Why the room closed a socket for good, from its close code, or `null` for a reason to retry. */
const endingFor = (code: number): ChatEnding | null => {
  switch (code) {
    case CHAT_ROOM_CLOSES.noSession.code:
      return 'signed_out';
    case CHAT_ROOM_CLOSES.revoked.code:
      return 'revoked';
    case CHAT_ROOM_CLOSES.closed.code:
      return 'closed';
    case CHAT_ROOM_CLOSES.superseded.code:
      return 'paused';
    default:
      return null;
  }
};

const isOffline = (): boolean => globalThis.navigator?.onLine === false;

const roomUrl = (eventId: string): string =>
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/chat/${encodeURIComponent(eventId)}`;

/**
 * Hold a socket to a meetup's chat room while `isEnabled`, and hand what the room pushes to
 * `handlers`.
 *
 * The room only pushes, so the socket carries nothing but the heartbeat out, as `HEARTBEAT_FRAME`,
 * which the runtime answers without waking the room. Every time a socket opens, `onCatchUp` is
 * asked to read what was said while there was none.
 *
 * A socket that drops is opened again after one second, then two, doubling to thirty. One the
 * room closed for good is not: the chat has closed, the reader is no longer in it, their session
 * has ended, or their newest screens took the socket over, which `resume` undoes. After three
 * sockets in a row that never opened, as on a network that does not carry them, `onCatchUp` is
 * also asked every fifteen seconds until one does. While the browser is offline nothing is tried,
 * and coming back online tries at once.
 *
 * The room says why it is closing a socket in a frame before the close, and in the close code. The
 * frame is acted on the moment it arrives, since a proxy may hold the close behind it back, as
 * Vite's dev server does for ten seconds, or not carry its code intact; the code serves when no
 * frame came.
 */
export const useChatSocket = (
  eventId: string,
  isEnabled: boolean,
  handlers: ChatSocketHandlers,
) => {
  const [connection, setConnection] = useState<ChatConnection>('connecting');
  const [ending, setEnding] = useState<ChatEnding | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [failures, setFailures] = useState(0);
  const handlersRef = useRef(handlers);
  const socketRef = useRef<WebSocket | null>(null);
  const delayRef = useRef(CHAT_RECONNECT_DELAY_MS.first);
  const hasEverOpenedRef = useRef(false);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!isEnabled || ending) return;
    if (isOffline()) {
      setConnection('offline');
      return;
    }
    let isCurrent = true;
    let hasOpened = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const socket = new WebSocket(roomUrl(eventId));
    socketRef.current = socket;
    setConnection(hasEverOpenedRef.current ? 'reconnecting' : 'connecting');

    const end = (ended: ChatEnding): void => {
      isCurrent = false;
      socketRef.current = null;
      setEnding(ended);
      setConnection(ended);
      if (ended === 'closed') handlersRef.current.onClosed();
    };

    socket.onopen = () => {
      if (!isCurrent) return;
      hasOpened = true;
      hasEverOpenedRef.current = true;
      delayRef.current = CHAT_RECONNECT_DELAY_MS.first;
      setFailures(0);
      setConnection('live');
      handlersRef.current.onCatchUp();
    };
    socket.onmessage = (event: MessageEvent) => {
      if (!isCurrent) return;
      const frame = parseChatFrame(event.data);
      if (frame?.type === 'message')
        handlersRef.current.onMessage(frame.message);
      else if (frame?.type === 'removed')
        handlersRef.current.onRemoved({ id: frame.id, removal: frame.removal });
      else if (frame) end(frame.type);
    };
    socket.onclose = (event: CloseEvent) => {
      if (!isCurrent) return;
      const ended = endingFor(event.code);
      if (ended) {
        end(ended);
        return;
      }
      socketRef.current = null;
      if (!hasOpened) setFailures((count) => count + 1);
      setConnection(isOffline() ? 'offline' : 'reconnecting');
      const delay = delayRef.current;
      delayRef.current = Math.min(delay * 2, CHAT_RECONNECT_DELAY_MS.longest);
      retry = setTimeout(() => setAttempt((count) => count + 1), delay);
    };

    return () => {
      isCurrent = false;
      if (retry) clearTimeout(retry);
      socketRef.current = null;
      socket.close(1000, 'left');
    };
  }, [eventId, isEnabled, ending, attempt]);

  useEffect(() => {
    if (!isEnabled) return;
    const beat = setInterval(() => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) socket.send(HEARTBEAT_FRAME);
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(beat);
  }, [isEnabled]);

  const isPolling =
    isEnabled &&
    !ending &&
    failures >= CHAT_FAILURES_BEFORE_POLLING &&
    (connection === 'reconnecting' || connection === 'connecting');

  useEffect(() => {
    if (!isPolling) return;
    const poll = setInterval(
      () => handlersRef.current.onCatchUp(),
      CHAT_POLL_INTERVAL_MS,
    );
    return () => clearInterval(poll);
  }, [isPolling]);

  useEffect(() => {
    if (!isEnabled) return;
    const goOnline = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;
      delayRef.current = CHAT_RECONNECT_DELAY_MS.first;
      setAttempt((count) => count + 1);
    };
    const goOffline = () => {
      setConnection((current) =>
        current === 'live' ||
        current === 'connecting' ||
        current === 'reconnecting'
          ? 'offline'
          : current,
      );
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [isEnabled]);

  const resume = useCallback(() => {
    delayRef.current = CHAT_RECONNECT_DELAY_MS.first;
    setFailures(0);
    setEnding(null);
    setAttempt((count) => count + 1);
  }, []);

  return { connection, isPolling, resume };
};
