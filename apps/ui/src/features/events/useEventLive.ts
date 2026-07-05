/**
 * useEventLive — React hook for the real-time live dashboard WebSocket.
 * Connects to the EventLiveDO via `/api/live/{eventId}`.
 *
 * Handles: connection, auth (session token), reconnection with exponential
 * backoff, message dispatch to state. Returns live roster + host state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

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
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'error';

export interface UseEventLiveResult {
  roster: RosterUser[];
  host: HostState | null;
  connectionState: ConnectionState;
  error: string | null;
  sendArrived: (tableNumber?: number, visualCue?: string) => void;
  sendWalkingIn: () => void;
  sendRunningLate: (etaMinutes?: number) => void;
  sendTablePin: (tableNumber: number) => void;
  disconnect: () => void;
}

/* -------------------------------------------------------------------------- */
/* Outbound messages                                                           */
/* -------------------------------------------------------------------------- */

interface OutboundMsg {
  type: 'auth' | 'arrived' | 'walking_in' | 'running_late' | 'table_pin';
  sessionToken?: string;
  tableNumber?: number;
  visualCue?: string;
  etaMinutes?: number;
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                        */
/* -------------------------------------------------------------------------- */

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

export const useEventLive = (
  eventId: string,
  sessionToken: string | null,
): UseEventLiveResult => {
  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [host, setHost] = useState<HostState | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const intentionalCloseRef = useRef(false);

  const send = useCallback((msg: OutboundMsg) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionToken || !eventId) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnectionState('connecting');
    setError(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/api/live/${eventId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnectionState('authenticating');
      send({ type: 'auth', sessionToken });
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
          case 'auth_expired':
            setConnectionState('error');
            setError('Session expired. Please refresh.');
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
            setError(msg.message ?? 'Unknown error');
            break;
          case 'event_cancelled':
            setConnectionState('error');
            setError('This event has been cancelled.');
            intentionalCloseRef.current = true;
            ws.close(1000, 'event_cancelled');
            break;
        }
      } catch {
        /* empty */
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
      reconnectDelayRef.current = Math.min(
        delay * 2,
        MAX_RECONNECT_DELAY,
      );

      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setConnectionState('error');
      setError('WebSocket connection failed');
    };
  }, [eventId, sessionToken, send]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

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
