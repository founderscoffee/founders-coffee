import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useResendCooldown } from './useResendCooldown';

const advance = (seconds: number) =>
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });

describe('useResendCooldown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is ready before the first send, so nothing blocks the initial code', () => {
    const { result } = renderHook(() => useResendCooldown());

    expect(result.current.isReady).toBe(true);
    expect(result.current.secondsLeft).toBe(0);
  });

  it('holds the first resend for 30 seconds and counts down', () => {
    const { result } = renderHook(() => useResendCooldown());

    act(() => result.current.start());
    expect(result.current.secondsLeft).toBe(30);
    expect(result.current.isReady).toBe(false);

    advance(20);
    expect(result.current.secondsLeft).toBe(10);

    advance(10);
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isReady).toBe(true);
  });

  it('adds 30 seconds per attempt and stops climbing at five minutes', () => {
    const { result } = renderHook(() => useResendCooldown());
    const waits: number[] = [];

    for (let attempt = 0; attempt < 12; attempt += 1) {
      act(() => result.current.start());
      waits.push(result.current.secondsLeft);
      advance(result.current.secondsLeft);
    }

    expect(waits.slice(0, 5)).toEqual([30, 60, 90, 120, 150]);
    expect(waits.at(-1)).toBe(300);
    expect(Math.max(...waits)).toBe(300);
  });
});
