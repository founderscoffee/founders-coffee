import { act, cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBoundedPending, useOnlineStatus } from './network-status';

const setOnLine = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });

const Online = () => <p>{useOnlineStatus() ? 'online' : 'offline'}</p>;

const Pending = ({ isPending }: { isPending: boolean }) => (
  <p>{useBoundedPending(isPending) ? 'waiting' : 'settled'}</p>
);

const text = () =>
  screen.getByText(/online|offline|waiting|settled/).textContent;

beforeEach(() => {
  vi.useFakeTimers();
  setOnLine(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setOnLine(true);
});

describe('online status', () => {
  it('renders as online on the server, so hydration has nothing to correct', () => {
    setOnLine(false);

    expect(renderToString(<Online />)).toContain('online');
  });

  it('reports what the browser already knew, once it is mounted', () => {
    setOnLine(false);

    render(<Online />);

    expect(text()).toBe('offline');
  });

  it('follows the browser leaving and rejoining the network', () => {
    render(<Online />);
    expect(text()).toBe('online');

    setOnLine(false);
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(text()).toBe('offline');

    setOnLine(true);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(text()).toBe('online');
  });

  it('stops listening once it is gone from the page', () => {
    const { unmount } = render(<Online />);
    unmount();
    setOnLine(false);
    expect(() =>
      act(() => void window.dispatchEvent(new Event('offline'))),
    ).not.toThrow();
  });
});

describe('bounded pending', () => {
  it('gives up on a read that never lands', () => {
    render(<Pending isPending />);
    expect(text()).toBe('waiting');

    act(() => vi.advanceTimersByTime(8_000));

    expect(text()).toBe('settled');
  });

  it('keeps waiting while the read is still plausibly in flight', () => {
    render(<Pending isPending />);

    act(() => vi.advanceTimersByTime(7_900));

    expect(text()).toBe('waiting');
  });

  it('never waits at all when the browser knows it is offline', () => {
    setOnLine(false);
    render(<Pending isPending />);
    act(() => void window.dispatchEvent(new Event('offline')));

    expect(text()).toBe('settled');
  });

  it('starts a fresh grace period for the next read', () => {
    const { rerender } = render(<Pending isPending />);
    act(() => vi.advanceTimersByTime(8_000));
    expect(text()).toBe('settled');

    rerender(<Pending isPending={false} />);
    rerender(<Pending isPending />);

    expect(text()).toBe('waiting');
  });
});
