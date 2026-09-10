import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

const state = vi.hoisted(() => ({
  session: {} as Record<string, unknown>,
  joined: {} as Record<string, unknown>,
  hosted: {} as Record<string, unknown>,
}));

vi.mock('../hooks', () => ({
  useMyJoinedEvents: () => state.joined,
  useHostedEvents: () => state.hosted,
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

const MARKETS = [{ code: 'DZ', slug: 'algeria' }];

const event = (overrides: Record<string, unknown> = {}) => ({
  id: 'evt_1',
  slug: 'coffee-code-hydra',
  title: 'Coffee + code',
  venue: 'Café des Délices',
  marketCode: 'DZ',
  status: 'published',
  startsAt: new Date('2099-01-15T18:00:00Z'),
  cityName: 'Algiers',
  ...overrides,
});

const page = (items: unknown[], total = items.length) => ({
  data: { pages: [{ items, total, nextCursor: null }] },
  isPending: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
});

const show = (locale: Locale = 'en') =>
  render(<ActivityPage locale={locale} markets={MARKETS} />);

beforeEach(() => {
  state.session = { data: { user: { id: 'usr_1' } }, isPending: false };
  state.joined = page([]);
  state.hosted = page([]);
});

afterEach(() => cleanup());

describe('the gatherings screen', () => {
  it('shows both lists, joined before hosted', () => {
    show();

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      'Gatherings you joined',
      'Gatherings you hosted',
    ]);
  });

  it('says plainly when a member has joined nothing', () => {
    show();

    expect(screen.getByText(/have not joined a gathering yet/i)).toBeTruthy();
    expect(screen.getByText(/have not hosted a gathering yet/i)).toBeTruthy();
  });

  it('lists a joined gathering and links to its real route', () => {
    state.joined = page([event()]);

    show();

    expect(screen.getByText('Coffee + code')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: /Coffee \+ code/i })
        .getAttribute('href'),
    ).toBe('/algeria/e/coffee-code-hydra');
  });

  it('reports the server total, not the length of the page it was given', () => {
    state.joined = page([event()], 17);

    show();

    expect(screen.getByText('17 in total')).toBeTruthy();
  });

  it('labels an elapsed gathering past, never completed', () => {
    state.joined = page([
      event({ startsAt: new Date('2020-01-01T18:00:00Z') }),
    ]);

    show();

    expect(screen.getByText('Past')).toBeTruthy();
    expect(screen.queryByText(/completed|held/i)).toBeNull();
  });

  it('labels a future gathering upcoming', () => {
    state.joined = page([event()]);

    show();

    expect(screen.getByText('Upcoming')).toBeTruthy();
  });

  it('says a cancelled gathering was cancelled rather than hiding it', () => {
    state.joined = page([event({ status: 'cancelled' })]);

    show();

    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.getByText('Coffee + code')).toBeTruthy();
  });

  it('offers more only when there is another page', () => {
    state.joined = { ...page([event()]), hasNextPage: true };

    show();

    fireEvent.click(screen.getByRole('button', { name: /Show more/i }));
    expect(
      (state.joined as { fetchNextPage: ReturnType<typeof vi.fn> })
        .fetchNextPage,
    ).toHaveBeenCalledOnce();
  });

  it('offers no more button when the list is complete', () => {
    state.joined = page([event()]);

    show();

    expect(screen.queryByRole('button', { name: /Show more/i })).toBeNull();
  });
});

describe('states the member can land in', () => {
  it('offers sign-in to an anonymous visitor rather than an empty list', () => {
    state.session = { data: undefined, isPending: false };

    show();

    expect(screen.getByTestId('access-recovery')).toBeTruthy();
    expect(screen.queryByText(/have not joined/i)).toBeNull();
  });

  it('shows a loading state while the session is still resolving', () => {
    state.session = { data: undefined, isPending: true };
    state.joined = { ...page([]), isPending: true };

    show();

    expect(screen.getByRole('status').textContent).toMatch(/Loading/i);
  });

  it('explains an unavailable read rather than rendering empty lists', () => {
    state.joined = { ...page([]), isError: true };

    show();

    expect(screen.getByRole('alert').textContent).toMatch(
      /could not be loaded/i,
    );
  });

  it('renders in the member locale', () => {
    show('ar');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'لقاءاتك',
    );
  });
});
