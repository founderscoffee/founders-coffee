import { useEffect, useRef, useState } from 'react';

import { useMarkChatRead } from './hooks';

export const CHAT_READ_DELAY_MS = 1_200;
export const CHAT_READ_INTERVAL_MS = 6_000;

/** Whether the page is on screen, as the browser reports it and kept current. */
const useIsDocumentVisible = (): boolean => {
  const [isVisible, setIsVisible] = useState(
    () =>
      typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  useEffect(() => {
    const sync = () => setIsVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  return isVisible;
};

/**
 * Move the reader's read marker up to the newest message while they can see it: the panel is on
 * screen and scrolled to the bottom.
 *
 * The marker moves a moment after the newest message comes into view, and no more often than every
 * six seconds, which keeps a busy chat inside the `markRead` budget of 120 in ten minutes. When the
 * panel closes before a waiting move is made, it is made then, so what the reader saw is not
 * reported to them later as unread.
 */
export const useChatReadMarker = (input: {
  readonly eventId: string;
  readonly viewerId: string;
  readonly readUpTo: Date | null;
  readonly newestAt: number | null;
  readonly isAtEnd: boolean;
}) => {
  const { eventId, viewerId, newestAt, isAtEnd } = input;
  const { mutate } = useMarkChatRead(eventId, viewerId);
  const isVisible = useIsDocumentVisible();
  const markedRef = useRef(input.readUpTo?.getTime() ?? 0);
  const markedAtRef = useRef(0);
  const waitingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isVisible || !isAtEnd || newestAt === null) return;
    if (newestAt <= markedRef.current) return;
    waitingRef.current = newestAt;
    const wait = Math.max(
      CHAT_READ_DELAY_MS,
      markedAtRef.current + CHAT_READ_INTERVAL_MS - Date.now(),
    );
    const timer = setTimeout(() => {
      waitingRef.current = null;
      markedRef.current = newestAt;
      markedAtRef.current = Date.now();
      mutate(newestAt);
    }, wait);
    return () => clearTimeout(timer);
  }, [isVisible, isAtEnd, newestAt, mutate]);

  useEffect(
    () => () => {
      const waiting = waitingRef.current;
      if (waiting !== null && waiting > markedRef.current) mutate(waiting);
    },
    [mutate],
  );
};
