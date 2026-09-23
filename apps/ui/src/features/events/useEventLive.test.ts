import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HEARTBEAT_ACK_FRAME,
  HEARTBEAT_FRAME,
  HEARTBEAT_INTERVAL_MS,
} from '../../durable-objects/event-live/constants';
import { useEventLive } from './useEventLive';

const sockets: FakeSocket[] = [];

class FakeSocket {
  static readonly OPEN = 1;
  readyState = FakeSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closedWith: { code: number; reason: string } | null = null;

  constructor() {
    sockets.push(this);
  }

  sent: string[] = [];

  send = (data: string) => {
    this.sent.push(data);
  };

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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

describe('a room that could not check the session', () => {
  it('is asked again, rather than taken for an expired session', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEventLive('evt_1'));

    deliver({ type: 'error', message: 'Temporary auth error, please retry' });
    act(() => {
      sockets.at(-1)?.onclose?.({ code: 1013, reason: 'try_again_later' });
    });

    expect(result.current.error).not.toBe('session_expired');
    expect(result.current.connectionState).toBe('disconnected');
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(sockets, 'the reconnect loop opened a new socket').toHaveLength(2);
  });
});

describe('the heartbeat the room keeps a socket alive by', () => {
  it('is the exact frame the runtime answers, so the room never wakes for it', () => {
    vi.useFakeTimers();
    renderHook(() => useEventLive('evt_1'));

    act(() => {
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    });

    expect(sockets.at(-1)?.sent).toEqual([HEARTBEAT_FRAME]);
  });

  it('takes the acknowledgement as nothing to report', () => {
    const { result } = renderHook(() => useEventLive('evt_1'));

    act(() => {
      sockets.at(-1)?.onmessage?.({ data: HEARTBEAT_ACK_FRAME });
    });

    expect(result.current.error).toBeNull();
  });
});
