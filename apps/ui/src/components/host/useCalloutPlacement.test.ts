import { act, renderHook } from '@testing-library/react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CALLOUT_EDGE_PADDING } from './callout-placement';
import { useCalloutPlacement } from './useCalloutPlacement';

const MAP_WIDTH = 375;
const MAP_HEIGHT = 700;
const CARD_WIDTH = 256;
const CARD_HEIGHT = 120;
const VENUE = { longitude: 3.0588, latitude: 36.7538 };

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

const cardSides = (node: HTMLDivElement, pinX: number) => {
  const left = pinX - CARD_WIDTH / 2 + parseFloat(node.style.translate);
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
    const { result } = renderHook(() =>
      useCalloutPlacement(mapShowing(pin), VENUE),
    );
    const card = laidOutCard();

    act(() => result.current.measure(card));

    expect(cardSides(card, pin.x).left).toBe(CALLOUT_EDGE_PADDING);
  });

  it('slides the card along with the pin on every move of the map', () => {
    const pin = { x: 60, y: 200 };
    const { result } = renderHook(() =>
      useCalloutPlacement(mapShowing(pin), VENUE),
    );
    const card = laidOutCard();
    act(() => result.current.measure(card));

    pin.x = MAP_WIDTH - 40;
    act(() => result.current.sync());
    expect(cardSides(card, pin.x).right).toBe(MAP_WIDTH - CALLOUT_EDGE_PADDING);

    pin.x = MAP_WIDTH / 2;
    act(() => result.current.sync());
    expect(
      card.style.translate,
      'with room on both sides the card hangs centred under the pin again',
    ).toBe('0px');
  });
});
