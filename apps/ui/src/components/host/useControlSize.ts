import { useCallback, useRef } from 'react';

export type ControlSize = { readonly width: number; readonly height: number };

/**
 * The rendered size of a control, reported whenever it changes and as null once it leaves the
 * page, for whatever has to lay itself out beside it.
 */
export const useControlSize = (
  onChange?: (size: ControlSize | null) => void,
) => {
  const latest = useRef(onChange);
  latest.current = onChange;
  const observer = useRef<ResizeObserver | null>(null);

  return useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) {
      latest.current?.(null);
      return;
    }
    const report = () =>
      latest.current?.({ width: node.offsetWidth, height: node.offsetHeight });
    const resize = new ResizeObserver(report);
    resize.observe(node);
    observer.current = resize;
    report();
  }, []);
};
