import { useCallback, useEffect, useRef } from 'react';

/** Whether an event landed anywhere other than inside the open dropdown. */
export const isOutside = (
  container: Node | null,
  target: EventTarget | null,
): boolean =>
  container !== null && !(target instanceof Node && container.contains(target));

/**
 * Give a `<details>` dropdown the dismissal behaviour every other dropdown has.
 *
 * `<details>` closes on one thing only: another click on its own summary. Clicking the page behind
 * it, choosing an item inside it, or pressing Escape all leave it standing open — so a member who
 * navigates away arrives at the new page with the menu still hanging over it, and one who changes
 * their mind has to find their way back to the avatar to get rid of it. Every one of those is the
 * moment a person considers the menu finished with.
 *
 * `pointerdown` rather than `click`: a menu should be gone by the time the mouse comes back up, and
 * a click that starts inside and ends outside is a drag, not a dismissal. Escape returns focus to
 * the summary, because closing a menu around someone's focus would otherwise strand it on the
 * document.
 */
export const useDismissableDetails = () => {
  const ref = useRef<HTMLDetailsElement>(null);

  const close = useCallback(() => {
    if (ref.current) ref.current.open = false;
  }, []);

  useEffect(() => {
    const onPointerDown = (event: Event) => {
      if (ref.current?.open && isOutside(ref.current, event.target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !ref.current?.open) return;
      const summary = ref.current.querySelector('summary');
      close();
      summary?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close]);

  return { ref, close };
};
