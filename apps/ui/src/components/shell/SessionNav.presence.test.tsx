import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LivePresenceProvider,
  usePublishLivePresenceWhileMounted,
} from '../../features/events/live-presence';
import type { ConnectionState } from '../../features/events/useEventLive';
import { SessionNav } from './SessionNav';

const state = vi.hoisted(() => ({
  auth: {
    user: {
      id: 'usr_1',
      name: 'Amina Yagoub',
      email: 'a@b.dz',
      role: 'member',
    },
    isAuthenticated: true,
    isLoading: false,
  },
  profile: { data: null, isPending: false },
}));

vi.mock('../../features/profile/hooks', () => ({
  useMyProfile: () => state.profile,
}));
vi.mock('../../lib/app-providers', () => ({ useAuth: () => state.auth }));
vi.mock('../../lib/auth', () => ({ authClient: { signOut: vi.fn() } }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const InARoom = ({ live }: { live: ConnectionState }) => {
  usePublishLivePresenceWhileMounted(live);
  return null;
};

const show = (live?: ConnectionState) =>
  render(
    <LivePresenceProvider>
      {live && <InARoom live={live} />}
      <SessionNav locale="en" />
    </LivePresenceProvider>,
  );

afterEach(() => cleanup());

describe('the presence dot on the navbar avatar', () => {
  it('shows nothing while the reader is in no live room', () => {
    const { container } = show();

    const summary = container.querySelector('summary');
    expect(
      summary?.className,
      'this avatar is on every page, and a dot there would describe a connection nobody opened',
    ).not.toMatch(/avatar-(online|offline)/);
    expect(container.querySelector('.sr-only')).toBeNull();
  });

  it('names the state in words, not only in the colour of a dot', () => {
    const { container } = show('connected');

    expect(container.querySelector('summary')?.className).toContain(
      'avatar-online',
    );
    expect(
      container.querySelector('.sr-only')?.textContent,
      'a dot with no name is a colour telling a reader something they may not be able to see',
    ).toBe('Connected');
  });

  it('marks a dropped socket differently from a live one', () => {
    const { container } = show('disconnected');

    expect(container.querySelector('summary')?.className).toContain(
      'avatar-offline',
    );
  });

  it('keeps a reconnecting socket off the settled green', () => {
    const { container } = show('connecting');

    expect(container.querySelector('summary')?.className).toContain(
      'before:!bg-warning',
    );
  });
});
