import { useCallback, useRef, useState, type RefObject } from 'react';

/**
 * Holds a two-step sign-in card at the height of its first step so that asking for the code does
 * not make the card collapse. The email step carries a challenge widget, a legal line, a divider
 * and two provider buttons; the code step carries far less, and the jump moves everything around
 * the card at the moment the reader is looking for the boxes.
 *
 * The height is captured imperatively at the moment of the switch rather than watched, because
 * that is exactly the height the reader last saw — a `ResizeObserver` reports whatever the box
 * measured when it last changed, which misses growth inside a third-party widget's own DOM.
 * `release` drops the floor when the card returns to its first step, so a later error line is
 * measured from scratch rather than against a stale lock.
 */
export const useStepHeightLock = (): {
  ref: RefObject<HTMLDivElement | null>;
  minHeight: number | undefined;
  lock: () => void;
  release: () => void;
} => {
  const ref = useRef<HTMLDivElement>(null);
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined);

  const lock = useCallback(() => {
    const height = ref.current?.offsetHeight ?? 0;
    if (height > 0) setMinHeight(height);
  }, []);

  const release = useCallback(() => setMinHeight(undefined), []);

  return { ref, minHeight, lock, release };
};
