import { act, renderHook } from '@testing-library/react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMapResize } from './useMapResize';

const observers: FrameObserver[] = [];

class FrameObserver {
  readonly report: () => void;
  isConnected = true;

  constructor(report: () => void) {
    this.report = report;
    observers.push(this);
  }

  observe = (): void => undefined;
  unobserve = (): void => undefined;
  disconnect = (): void => {
    this.isConnected = false;
  };
}

const frameMap = () => {
  const resize = vi.fn();
  const { result } = renderHook(() =>
    useMapResize({ current: { resize } as unknown as MapboxMap }),
  );
  return { resize, attach: result.current };
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FrameObserver);
});

afterEach(() => {
  observers.length = 0;
  vi.unstubAllGlobals();
});

describe('useMapResize', () => {
  it('redraws the map each time its frame changes size', () => {
    const { resize, attach } = frameMap();
    act(() => attach(document.createElement('div')));

    observers[0]?.report();
    observers[0]?.report();

    expect(
      resize,
      'Mapbox follows only the window, so a frame the name question shortened kept a canvas that ran past it',
    ).toHaveBeenCalledTimes(2);
  });

  it('stops watching a frame that leaves the page', () => {
    const { attach } = frameMap();
    act(() => attach(document.createElement('div')));

    act(() => attach(null));

    expect(observers[0]?.isConnected).toBe(false);
  });
});
