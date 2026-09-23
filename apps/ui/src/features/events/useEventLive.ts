import { useCallback, useEffect, useRef, useState } from 'react';

import {
  HEARTBEAT_FRAME,
  HEARTBEAT_INTERVAL_MS,
} from '../../durable-objects/event-live/constants';

export interface RosterUser {
  userId: string;
  name: string;
  status: 'arrived' | 'walking_in' | 'running_late' | 'connected';
  etaMinutes?: number;
}

export interface HostState {
  userId: string;
  arrived: boolean;
  tableNumber?: number;
  visualCue?: string;
}

export type ConnectionState =
  'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error';

export type LiveErrorCode =
  'session_expired' | 'cancelled' | 'connection' | 'unknown';

export interface UseEventLiveResult {
  roster: RosterUser[];
  host: HostState | null;
  connectionState: ConnectionState;
  error: LiveErrorCode | null;
  notAttending: boolean;
  sendArrived: (tableNumber?: number, visualCue?: string) => void;
  sendWalkingIn: () => void;
  sendRunningLate: (etaMinutes?: number) => void;
  sendTablePin: (tableNumber: number) => void;
  disconnect: () => void;
}

interface OutboundMsg {
  type: 'auth' | 'arrived' | 'walking_in' | 'running_late' | 'table_pin';
  sessionToken?: string;
  tableNumber?: number;
  visualCue?: string;
  etaMinutes?: number;
}

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

/**
 * Join the live room for an event over a WebSocket, and expose what is happening in it.
 *
 * `enabled` decides whether a socket is opened at all: outside the meetup's window there is
 * nothing to join, and connecting anyway would hold a Durable Object open for every visitor
 * reading a page about next week. Flipping it false closes the socket and reports `disconnected`.
 *
 * `notAttending` is deliberately neither a connection state nor an error. A signed-in member who
 * has not joined is not broken and has nothing to fix, so the room reports the fact and the page
 * shows them what an anonymous reader sees. Telling them their session had ended was the whole of
 * #36: false about their account, and a remedy that does nothing.
 *
 * Failures surface as `LiveErrorCode` rather than sentences. The room is reached from an
 * Arabic-first page, so the words a reader sees have to come from the message catalogue; a string
 * built here would arrive in English whatever their locale. Server `error` frames collapse to
 * `unknown` on purpose — their text is written by the Durable Object, not translated, and is
 * diagnostic rather than something to show.
 *
 * The heartbeat is sent as `HEARTBEAT_FRAME`, the exact text the Durable Object's runtime answers
 * on the room's behalf, so keeping a socket alive never wakes the room or costs a query (#85). Its
 * acknowledgement is JSON of a type nothing here handles, so it passes through unremarked.
 */
export const useEventLive = (
  eventId: string,
  options: { enabled?: boolean } = {},
): UseEventLiveResult => {
  const isEnabled = options.enabled ?? true;
  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [host, setHost] = useState<HostState | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [error, setError] = useState<LiveErrorCode | null>(null);
  const [notAttending, setNotAttending] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const intentionalCloseRef = useRef(false);

  const sendFrame = useCallback((frame: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(frame);
    }
  }, []);

  const send = useCallback(
    (msg: OutboundMsg) => sendFrame(JSON.stringify(msg)),
    [sendFrame],
  );

  const connect = useCallback(() => {
    if (!eventId || !isEnabled) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnectionState('connecting');
    setError(null);
    setNotAttending(false);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/api/live/${eventId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnectionState('authenticating');
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          roster?: RosterUser[];
          host?: HostState;
          message?: string;
        };

        switch (msg.type) {
          case 'auth_ok':
            setConnectionState('connected');
            reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
            break;
          case 'not_attending':
            setNotAttending(true);
            setConnectionState('disconnected');
            intentionalCloseRef.current = true;
            ws.close(4003, 'not_attending');
            break;
          case 'auth_expired':
            setConnectionState('error');
            setError('session_expired');
            intentionalCloseRef.current = true;
            ws.close(4001, 'auth_expired');
            break;
          case 'roster_update':
            if (msg.roster) setRoster(msg.roster);
            break;
          case 'host_update':
            if (msg.host) setHost(msg.host);
            break;
          case 'error':
            setError('unknown');
            break;
          case 'event_cancelled':
            setConnectionState('error');
            setError('cancelled');
            intentionalCloseRef.current = true;
            ws.close(1000, 'event_cancelled');
            break;
        }
      } catch {
        return;
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      wsRef.current = null;

      if (intentionalCloseRef.current) {
        intentionalCloseRef.current = false;
        return;
      }

      setConnectionState('disconnected');

      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);

      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setConnectionState('error');
      setError('connection');
    };
  }, [eventId, isEnabled, send]);

  useEffect(() => {
    mountedRef.current = true;
    if (!isEnabled) {
      setConnectionState('disconnected');
      return;
    }
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect, isEnabled]);

  useEffect(() => {
    if (!isEnabled) return;
    const interval = window.setInterval(
      () => sendFrame(HEARTBEAT_FRAME),
      HEARTBEAT_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [isEnabled, sendFrame]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionState('disconnected');
  }, []);

  return {
    roster,
    host,
    connectionState,
    error,
    notAttending,
    sendArrived: useCallback(
      (tableNumber?: number, visualCue?: string) =>
        send({ type: 'arrived', tableNumber, visualCue }),
      [send],
    ),
    sendWalkingIn: useCallback(() => send({ type: 'walking_in' }), [send]),
    sendRunningLate: useCallback(
      (etaMinutes?: number) => send({ type: 'running_late', etaMinutes }),
      [send],
    ),
    sendTablePin: useCallback(
      (tableNumber: number) => send({ type: 'table_pin', tableNumber }),
      [send],
    ),
    disconnect,
  };
};
