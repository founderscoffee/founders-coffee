import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { ConnectionState } from './useEventLive';

type LivePresenceValue = {
  presence: ConnectionState | null;
  publish: (state: ConnectionState | null) => void;
};

const LivePresenceContext = createContext<LivePresenceValue>({
  presence: null,
  publish: () => undefined,
});

export const LivePresenceProvider = ({ children }: { children: ReactNode }) => {
  const [presence, setPresence] = useState<ConnectionState | null>(null);
  const value = useMemo(() => ({ presence, publish: setPresence }), [presence]);
  return (
    <LivePresenceContext.Provider value={value}>
      {children}
    </LivePresenceContext.Provider>
  );
};

export const useLivePresence = (): ConnectionState | null =>
  useContext(LivePresenceContext).presence;

export const usePublishLivePresenceWhileMounted = (
  state: ConnectionState,
): void => {
  const { publish } = useContext(LivePresenceContext);
  useEffect(() => {
    publish(state);
    return () => publish(null);
  }, [publish, state]);
};
