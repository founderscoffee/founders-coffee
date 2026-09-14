import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  hosted: {} as Record<string, unknown>,
  closeoutStates: [] as {
    eventId: string;
    closed: boolean;
    outcome: 'held' | 'did_not_happen' | null;
  }[],
}));

vi.mock('../hooks', () => ({
  useMyJoinedEvents: () => ({ data: { pages: [] } }),
  useHostedEvents: () => state.hosted,
}));
vi.mock('../../operations/hooks', () => ({
  useMyCloseoutStates: () => ({ data: state.closeoutStates }),
}));
vi.mock('../../../lib/auth', () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: 'usr_1' } }, isPending: false }),
  },
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/repeat">{children}</a>
  ),
}));
vi.mock('../../profile/components/ProfileAccess', () => ({
  ProfileAccess: () => <div data-testid="access-recovery" />,
}));
vi.mock('../../account/components/ProfileSectionNav', () => ({
  ProfileSectionNav: () => <nav data-testid="section-nav" />,
}));

const { ActivityPage } = await import('./ActivityPage');

const page = (items: unknown[]) => ({
  data: { pages: [{ items, total: items.length, nextCursor: null }] },
  isPending: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
});

const show = () =>
  render(
    <ActivityPage locale="en" markets={[{ code: 'DZ', slug: 'algeria' }]} />,
  );

const event = {
  id: 'evt_1',
  slug: 'coffee-code-hydra',
  title: 'Coffee + code',
  venue: 'Café des Délices',
  marketCode: 'DZ',
  cityCode: '1',
  status: 'published',
  startsAt: new Date('2020-01-01T18:00:00Z'),
  cityName: 'Algiers',
};

beforeEach(() => {
  state.hosted = page([event]);
  state.closeoutStates = [];
});

afterEach(() => cleanup());

describe('repeat hosting entry point', () => {
  it('offers another like this after a held closeout', () => {
    state.closeoutStates = [
      { eventId: 'evt_1', closed: true, outcome: 'held' },
    ];

    show();

    expect(screen.getByText('Closed out')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /Host another like this/i }),
    ).toBeTruthy();
  });

  it('does not offer a repeat link for a gathering that did not happen', () => {
    state.closeoutStates = [
      { eventId: 'evt_1', closed: true, outcome: 'did_not_happen' },
    ];

    show();

    expect(
      screen.queryByRole('link', { name: /Host another like this/i }),
    ).toBeNull();
  });
});
