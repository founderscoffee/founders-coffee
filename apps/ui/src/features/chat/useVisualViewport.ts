import { useEffect, useState } from 'react';

export type VisibleFrame = { readonly height: number; readonly top: number };

/**
 * The part of the window a panel can use while an on-screen keyboard covers the rest, or `null`
 * while nothing does.
 *
 * Safari on iOS keeps the layout viewport, which a fixed element fills, the height of the window
 * when the keyboard opens: it shrinks and pans the visual viewport instead, so a composer at the
 * bottom of a fixed panel ends up behind the keyboard. Sizing the panel to the visual viewport and
 * moving it to its top keeps the composer just above the keyboard. A pinch zoom shrinks the
 * visual viewport too, and is left alone.
 */
export const useVisualViewport = (): VisibleFrame | null => {
  const [frame, setFrame] = useState<VisibleFrame | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const isZoomed = Math.abs(viewport.scale - 1) > 0.01;
      const isCovered = window.innerHeight - viewport.height > 1;
      setFrame(
        isCovered && !isZoomed
          ? { height: viewport.height, top: viewport.offsetTop }
          : null,
      );
    };
    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
    };
  }, []);

  return frame;
};
