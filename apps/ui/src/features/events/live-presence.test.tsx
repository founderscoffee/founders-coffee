import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  LivePresenceProvider,
  useLivePresence,
  usePublishLivePresenceWhileMounted,
} from './live-presence';
import type { ConnectionState } from './useEventLive';

const Reader = () => (
  <span data-testid="read">{useLivePresence() ?? 'none'}</span>
);

const Room = ({ state }: { state: ConnectionState }) => {
  usePublishLivePresenceWhileMounted(state);
  return null;
};

const show = (room: boolean, state: ConnectionState = 'connected') =>
  render(
    <LivePresenceProvider>
      <Reader />
      {room && <Room state={state} />}
    </LivePresenceProvider>,
  );

const read = () => screen.getByTestId('read').textContent;

afterEach(() => cleanup());

describe('what the navbar is told about the live room', () => {
  it('says nothing at all when no room is open', () => {
    show(false);

    expect(
      read(),
      'every page that is not a live event shares this avatar, and a dot there would describe a connection nobody opened',
    ).toBe('none');
  });

  it('reports the room while it is on screen', () => {
    show(true);

    expect(read()).toBe('connected');
  });

  it('follows the socket rather than latching on the first state', () => {
    const { rerender } = show(true, 'connecting');
    expect(read()).toBe('connecting');

    rerender(
      <LivePresenceProvider>
        <Reader />
        <Room state="error" />
      </LivePresenceProvider>,
    );

    expect(read()).toBe('error');
  });

  it('takes the dot with it when the reader leaves the room', () => {
    const { rerender } = show(true);
    expect(read()).toBe('connected');

    rerender(
      <LivePresenceProvider>
        <Reader />
      </LivePresenceProvider>,
    );

    expect(
      read(),
      'a room that unmounts without clearing strands a stale dot in the navbar for the rest of the session',
    ).toBe('none');
  });
});
