import type { Map as MapboxMap } from 'mapbox-gl';
import { useRef, useState, type RefObject } from 'react';

import {
  calloutFitsAbove,
  calloutFitsBelow,
  calloutShift,
} from './callout-placement';

type Point = { longitude: number; latitude: number } | null;

export interface CalloutPlacement {
  readonly above: boolean;
  readonly measure: (node: HTMLDivElement | null) => void;
  readonly sync: () => void;
}

/**
 * Where the venue card sits by the pin, kept current as the map moves: hanging below it or flipped
 * above it, and slid sideways as far as it has to go to stay on the map.
 *
 * The card lives inside a Mapbox marker, and a marker is not in the document until Mapbox adds it
 * to the map — so reading its size from the ref callback gives zero. A ResizeObserver measures it
 * once it is really laid out, and again whenever its text rewraps into a different number of lines.
 *
 * The slide is written straight onto the card's `translate` instead of going through state.
 * Mapbox moves the marker inside its own frame and a render lands a frame later, so a card placed
 * near an edge would show cut off for a frame before jumping in, and would trail the pin while
 * the map pans. The flip changes only when the pin crosses a line, not on every frame of a pan,
 * so it stays in state.
 */
export const useCalloutPlacement = (
  mapRef: RefObject<MapboxMap | null>,
  point: Point,
  covered = 0,
): CalloutPlacement => {
  const [above, setAbove] = useState(false);
  const card = useRef<HTMLDivElement | null>(null);
  const size = useRef({ width: 0, height: 0 });
  const observer = useRef<ResizeObserver | null>(null);
  const latest = useRef(point);
  latest.current = point;
  const cover = useRef(covered);
  cover.current = covered;

  const sync = (): void => {
    const map = mapRef.current;
    const target = latest.current;
    const node = card.current;
    const { width, height } = size.current;
    if (!map || !target || !node || height === 0) return;
    const { x, y } = map.project([target.longitude, target.latitude]);
    const { clientWidth, clientHeight } = map.getContainer();
    node.style.translate = `${calloutShift(x, clientWidth, width)}px`;
    const fitsBelow = calloutFitsBelow(y, clientHeight, height);
    setAbove(!fitsBelow && calloutFitsAbove(y, height, cover.current));
  };

  const measure = (node: HTMLDivElement | null): void => {
    observer.current?.disconnect();
    observer.current = null;
    card.current = node;
    if (!node) return;
    const resize = new ResizeObserver(() => {
      size.current = { width: node.offsetWidth, height: node.offsetHeight };
      sync();
    });
    resize.observe(node);
    observer.current = resize;
  };

  return { above, measure, sync };
};
