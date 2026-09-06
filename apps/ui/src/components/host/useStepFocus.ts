import { useEffect, useRef, type RefObject } from 'react';

/**
 * Move focus to each new step's heading without moving the frame around it.
 *
 * The rail is its own scroll container from `lg` up, so scrolling the heading to `start` scrolled
 * the *document* instead — carrying the stepper and the map off the top of the window on every step
 * change, which is exactly what one fixed layout exists to prevent. Resetting the rail and asking
 * for `nearest` moves only what has to move, and only on the narrow layout where the page itself is
 * the scroller. `scrollTop` rather than `scrollTo`, which jsdom does not implement.
 */
export const useStepFocus = (
  step: number,
  headingRef: RefObject<HTMLHeadingElement | null>,
  scrollRef: RefObject<HTMLDivElement | null>,
): void => {
  const previousStep = useRef(step);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [step, headingRef, scrollRef]);
};
