import { useCallback, useRef } from 'react';

/**
 * How far the venue panel reaches down over the map, reported whenever that changes.
 *
 * The panel floats over the map's top edge only below `lg`; from `lg` up it sits in the rail and
 * covers nothing, which its computed position tells apart without a media query of its own. The
 * gap above the panel counts as covered, since nothing on the map can be read through it, and a
 * panel that leaves the page, or is hidden while the host works the map, covers nothing any more.
 */
export const useCoveredHeight = (onChange: (height: number) => void) => {
  const latest = useRef(onChange);
  latest.current = onChange;
  const observer = useRef<ResizeObserver | null>(null);

  return useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) {
      latest.current(0);
      return;
    }
    const report = () => {
      const style = getComputedStyle(node);
      latest.current(
        style.position === 'absolute' && node.offsetHeight > 0
          ? Math.round(node.offsetHeight + parseFloat(style.marginTop))
          : 0,
      );
    };
    const resize = new ResizeObserver(report);
    resize.observe(node);
    observer.current = resize;
    report();
  }, []);
};
