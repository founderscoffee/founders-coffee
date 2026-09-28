import { useEffect, type RefObject } from 'react';

/**
 * Bring a sign-in panel into view and focus its first field when it opens.
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
