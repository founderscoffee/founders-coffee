import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEventLive } from './useEventLive';

const sockets: FakeSocket[] = [];

class FakeSocket {
  static readonly OPEN = 1;
  readyState = FakeSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closedWith: { code: number; reason: string } | null = null;

  constructor() {
    sockets.push(this);
  }

  send = () => undefined;

  close = (code?: number, reason?: string) => {
    this.closedWith = { code: code ?? 1000, reason: reason ?? '' };
  };
}

const deliver = (frame: Record<string, unknown>) =>
  act(() => {
    sockets.at(-1)?.onmessage?.({ data: JSON.stringify(frame) });
  });

beforeEach(() => {
  sockets.length = 0;
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('location', {
    protocol: 'https:',
    host: 'founders.coffee',
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('what the room tells a member who has not joined', () => {
  it('reports the fact without calling it an error', () => {
    const { result } = renderHook(() => useEventLive('evt_1'));

    deliver({ type: 'not_attending', message: 'Not attending this event' });

    expect(result.current.notAttending).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('still says session_expired when the session really has expired', () => {
    const { result } = renderHook(() => useEventLive('evt_1'));

    deliver({ type: 'auth_expired', message: 'Session expired' });

    expect(result.current.error).toBe('session_expired');
    expect(result.current.notAttending).toBe(false);
  });

  it('closes on its own code, so the two refusals stay apart on the wire', () => {
    renderHook(() => useEventLive('evt_1'));

    deliver({ type: 'not_attending' });

    expect(sockets.at(-1)?.closedWith).toEqual({
      code: 4003,
      reason: 'not_attending',
    });
  });

  it('clears the fact when the member joins and the room is opened again', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useEventLive('evt_1', { enabled }),
      { initialProps: { enabled: true } },
    );
    deliver({ type: 'not_attending' });
    expect(result.current.notAttending).toBe(true);

    rerender({ enabled: false });
    rerender({ enabled: true });

    expect(result.current.notAttending).toBe(false);
  });
});
