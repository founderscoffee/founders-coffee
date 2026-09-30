import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVisualViewport } from './useVisualViewport';

const WINDOW_HEIGHT = 844;

const viewport = Object.assign(new EventTarget(), {
  height: WINDOW_HEIGHT,
  offsetTop: 0,
  scale: 1,
});

const move = (change: Partial<typeof viewport>, event = 'resize') =>
  act(() => {
    Object.assign(viewport, change);
    viewport.dispatchEvent(new Event(event));
  });

beforeEach(() => {
  Object.assign(viewport, { height: WINDOW_HEIGHT, offsetTop: 0, scale: 1 });
  vi.stubGlobal('innerHeight', WINDOW_HEIGHT);
  vi.stubGlobal('visualViewport', viewport);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the part of the window the chat panel can use', () => {
  it('is the whole window while no keyboard covers it', () => {
    const { result } = renderHook(() => useVisualViewport());

    expect(result.current).toBeNull();
  });

  it('is what the keyboard leaves, followed as the page pans', () => {
    const { result } = renderHook(() => useVisualViewport());

    move({ height: 500 });
    expect(result.current).toEqual({ height: 500, top: 0 });

    move({ offsetTop: 120 }, 'scroll');
    expect(result.current).toEqual({ height: 500, top: 120 });

    move({ height: WINDOW_HEIGHT, offsetTop: 0 });
    expect(result.current).toBeNull();
  });

  it('leaves a pinch zoom alone', () => {
    const { result } = renderHook(() => useVisualViewport());

    move({ height: 422, scale: 2 });

    expect(result.current).toBeNull();
  });
});
