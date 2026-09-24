import { useEffect, useRef, useState } from 'react';

/**
 * Focus the control an action puts in place of the one that was pressed, once it is shown.
 *
 * The Telegram panels swap one control for the next as a step completes, and the button that was
 * pressed leaves the page with focus still on it, dropping a keyboard user back to the top. A key
 * names the element inside `container` that carries it as `data-focus`; that element is focused on
 * the first render that shows it, and the key is then forgotten.
 */
export const useFocusWhenShown = <T extends HTMLElement>() => {
  const container = useRef<T>(null);
  const [wanted, setWanted] = useState<string | null>(null);

  useEffect(() => {
    if (!wanted) return;
    const target = container.current?.querySelector<HTMLElement>(
      `[data-focus="${wanted}"]`,
    );
    if (!target) return;
    target.focus();
    setWanted(null);
  });

  return { container, focusWhenShown: setWanted };
};
