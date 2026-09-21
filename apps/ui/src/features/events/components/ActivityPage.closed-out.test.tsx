import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

const state = vi.hoisted(() => ({
  session: {} as Record<string, unknown>,
  hosted: {} as Record<string, unknown>,
  closeoutStates: [] as {
    eventId: string;
    closed: boolean;
    outcome: 'held' | 'did_not_happen' | null;
  }[],
}));

vi.mock('../hooks', () => ({
  useMyJoinedEvents: () => state.hosted,
  useHostedEvents: () => state.hosted,
}));
vi.mock('../../operations/hooks', () => ({
  useMyCloseoutStates: () => ({ data: state.closeoutStates }),
}));
vi.mock('../../../lib/auth', () => ({
  authClient: { useSession: () => state.session },
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}
    >
      {children}
    </a>
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

const show = (locale: Locale = 'en') =>
  render(
    <ActivityPage
      locale={locale}
      markets={[{ code: 'DZ', slug: 'algeria' }]}
    />,
  );

const openHostedTab = () =>
  fireEvent.click(screen.getByRole('tab', { name: 'Gatherings you hosted' }));

beforeEach(() => {
  state.session = { data: { user: { id: 'usr_1' } }, isPending: false };
  state.hosted = page([
    {
      id: 'evt_1',
      slug: 'coffee-code-hydra',
      title: 'Coffee + code',
      venue: 'Café des Délices',
      marketCode: 'DZ',
      cityCode: '1',
      status: 'published',
      startsAt: new Date('2020-01-01T18:00:00Z'),
      cityName: 'Algiers',
    },
  ]);
  state.closeoutStates = [{ eventId: 'evt_1', closed: true, outcome: 'held' }];
});

afterEach(() => cleanup());

describe('a gathering the host has already closed out', () => {
  it('still leads back to its closeout page, which is where the pulse is', () => {
    show();
    openHostedTab();

    expect(
      screen.getByRole('link', { name: /Closed out/i }).getAttribute('href'),
      'a host who closed out had no way back to this page, so the feedback summary on it could not be reached at all',
    ).toBe('/en/closeout/evt_1');
  });

  it('leads there in the host’s own language', () => {
    show('ar');
    fireEvent.click(screen.getByRole('tab', { name: 'لقاءات استضفتها' }));

    expect(
      screen.getByRole('link', { name: 'تم الإغلاق' }).getAttribute('href'),
    ).toBe('/ar/closeout/evt_1');
  });
});
