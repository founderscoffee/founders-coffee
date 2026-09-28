import type { Map as MapboxMap } from 'mapbox-gl';
import { useRef, type RefObject } from 'react';

import {
  CALLOUT_GAP,
  calloutFitsAbove,
  calloutFitsBelow,
  calloutShift,
  PIN_HEIGHT,
} from './callout-placement';

const ABOVE_PIN = `calc(-100% - ${PIN_HEIGHT + CALLOUT_GAP * 2}px)`;

type Point = { longitude: number; latitude: number } | null;

export interface CalloutPlacement {
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
 * Both moves are written straight onto the card's `transform` instead of going through state.
 * Mapbox moves the marker inside its own frame and a render lands a frame later, so a new card
 * would first show where it does not fit, cut off at an edge, before jumping into place, and would
 * trail the pin while the map pans.
 */
export const useCalloutPlacement = (
  mapRef: RefObject<MapboxMap | null>,
  point: Point,
  covered = 0,
): CalloutPlacement => {
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
    const above =
      !calloutFitsBelow(y, clientHeight, height) &&
      calloutFitsAbove(y, height, cover.current);
    node.style.transform = `translate(${calloutShift(x, clientWidth, width)}px, ${above ? ABOVE_PIN : '0px'})`;
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

  return { measure, sync };
};
