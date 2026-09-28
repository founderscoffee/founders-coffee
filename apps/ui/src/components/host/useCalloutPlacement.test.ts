import { act, renderHook } from '@testing-library/react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CALLOUT_EDGE_PADDING,
  CALLOUT_GAP,
  PIN_HEIGHT,
} from './callout-placement';
import { useCalloutPlacement } from './useCalloutPlacement';

const MAP_WIDTH = 375;
const MAP_HEIGHT = 700;
const CARD_WIDTH = 256;
const CARD_HEIGHT = 120;
const VENUE = { longitude: 3.0588, latitude: 36.7538 };
const ABOVE_PIN = `calc(-100% - ${PIN_HEIGHT + CALLOUT_GAP * 2}px)`;

class MeasuringObserver {
  readonly report: () => void;

  constructor(report: () => void) {
    this.report = report;
  }

  observe = (): void => this.report();
  unobserve = (): void => undefined;
  disconnect = (): void => undefined;
}

const mapShowing = (pin: { x: number; y: number }) => ({
  current: {
    project: () => ({ ...pin }),
    getContainer: () => ({ clientWidth: MAP_WIDTH, clientHeight: MAP_HEIGHT }),
  } as unknown as MapboxMap,
});

const laidOutCard = (): HTMLDivElement => {
  const node = document.createElement('div');
  Object.defineProperties(node, {
    offsetWidth: { value: CARD_WIDTH },
    offsetHeight: { value: CARD_HEIGHT },
  });
  return node;
};

const placeCard = (pin: { x: number; y: number }, covered = 0) => {
  let renders = 0;
  const { result } = renderHook(() => {
    renders += 1;
    return useCalloutPlacement(mapShowing(pin), VENUE, covered);
  });
  const card = laidOutCard();
  act(() => result.current.measure(card));
  return {
    card,
    sync: () => act(() => result.current.sync()),
    renders: () => renders,
  };
};

const offsetOf = (card: HTMLDivElement) => {
  const [, x, y] =
    /^translate\((-?[\d.]+)px, (.+)\)$/.exec(card.style.transform) ?? [];
  return { x: Number(x), y };
};

const cardSides = (card: HTMLDivElement, pinX: number) => {
  const left = pinX - CARD_WIDTH / 2 + offsetOf(card).x;
  return { left, right: left + CARD_WIDTH };
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MeasuringObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useCalloutPlacement', () => {
  it('slides a card placed near the left edge onto the map as soon as it is measured', () => {
    const pin = { x: 60, y: 200 };
    const { card } = placeCard(pin);

    expect(cardSides(card, pin.x).left).toBe(CALLOUT_EDGE_PADDING);
    expect(offsetOf(card).y).toBe('0px');
  });

  it('slides the card along with the pin on every move of the map', () => {
    const pin = { x: 60, y: 200 };
    const { card, sync } = placeCard(pin);

    pin.x = MAP_WIDTH - 40;
    sync();
    expect(cardSides(card, pin.x).right).toBe(MAP_WIDTH - CALLOUT_EDGE_PADDING);

    pin.x = MAP_WIDTH / 2;
    sync();
    expect(
      offsetOf(card).x,
      'with room on both sides the card hangs centred under the pin again',
    ).toBe(0);
  });

  it('flips a card placed near the bottom above the pin, and back under it once the map lifts the pin', () => {
    const pin = { x: MAP_WIDTH / 2, y: MAP_HEIGHT - 60 };
    const { card, sync } = placeCard(pin);

    expect(offsetOf(card)).toEqual({ x: 0, y: ABOVE_PIN });

    pin.y = 200;
    sync();
    expect(offsetOf(card)).toEqual({ x: 0, y: '0px' });
  });

  it('keeps the card under a pin near the bottom while the venue list covers the room above it', () => {
    const pin = { x: MAP_WIDTH / 2, y: MAP_HEIGHT - 60 };
    const { card } = placeCard(pin, MAP_HEIGHT - 200);

    expect(offsetOf(card).y).toBe('0px');
  });

  it('slides and flips the card without a render, so it keeps pace with the marker', () => {
    const pin = { x: 30, y: MAP_HEIGHT - 60 };
    const { card, sync, renders } = placeCard(pin);

    expect(offsetOf(card).y).toBe(ABOVE_PIN);
    expect(cardSides(card, pin.x).left).toBe(CALLOUT_EDGE_PADDING);

    pin.x = MAP_WIDTH - 30;
    pin.y = 200;
    sync();
    expect(offsetOf(card).y).toBe('0px');
    expect(cardSides(card, pin.x).right).toBe(MAP_WIDTH - CALLOUT_EDGE_PADDING);
    expect(
      renders(),
      'a render lands a frame after Mapbox has moved the marker',
    ).toBe(1);
  });
});
