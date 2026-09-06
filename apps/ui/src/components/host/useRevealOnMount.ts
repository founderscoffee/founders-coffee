import { useEffect, type RefObject } from 'react';

/**
 * Bring a panel that has just appeared into view, and put the cursor in its first field.
 *
 * The wizard's rail is its own scroll container and the sign-in gate renders at the end of it, so
 * opening the gate moved nothing on screen: the publish button went disabled while the gate itself
 * sat several hundred pixels below the fold, which reads as a button that does nothing. Revealing
 * it on mount is what makes opening it visible.
 */
export const useRevealOnMount = (ref: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    node.querySelector<HTMLInputElement>('input')?.focus({
      preventScroll: true,
    });
  }, [ref]);
};
