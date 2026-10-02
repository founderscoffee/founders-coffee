import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

const state = vi.hoisted(() => ({
  session: {} as Record<string, unknown>,
  joined: {} as Record<string, unknown>,
  hosted: {} as Record<string, unknown>,
  unread: new Map<string, number>(),
  askedAbout: [] as string[][],
}));

vi.mock('../hooks', () => ({
  useMyJoinedEvents: () => ({ ...state.joined, ...state.session }),
  useHostedEvents: () => state.hosted,
}));
vi.mock('../../chat/hooks', () => ({
  useChatUnreadCounts: (eventIds: readonly string[]) => {
    state.askedAbout.push([...eventIds]);
    return state.unread;
  },
}));
vi.mock('../../operations/hooks', () => ({
  useMyCloseoutStates: () => ({ data: [] }),
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

const gathering = (id: string, title: string) => ({
  id,
  slug: `${id}-slug`,
  title,
  venue: 'Café des Délices',
  marketCode: 'DZ',
  cityCode: '1',
  status: 'published',
  startsAt: new Date('2099-01-15T18:00:00Z'),
  cityName: 'Algiers',
});

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
      markets={[{ code: 'DZ', slug: 'algeria', timezone: 'Africa/Algiers' }]}
    />,
  );

beforeEach(() => {
  state.session = { userId: 'usr_1', isAuthLoading: false };
  state.joined = page([
    gathering('evt_joined', 'Joined meetup'),
    gathering('evt_quiet', 'Quiet meetup'),
  ]);
  state.hosted = page([gathering('evt_hosted', 'Hosted meetup')]);
  state.unread = new Map([
    ['evt_joined', 2],
    ['evt_quiet', 0],
    ['evt_hosted', 5],
  ]);
  state.askedAbout = [];
});

afterEach(() => cleanup());

describe('the gatherings screen and their chats', () => {
  it('asks about the chats of the gatherings joined and hosted together', () => {
    show();

    expect(state.askedAbout.at(-1)).toEqual([
      'evt_joined',
      'evt_quiet',
      'evt_hosted',
    ]);
  });

  it('marks a gathering whose chat has messages the member has not read', () => {
    show();

    expect(
      screen.getByRole('link', { name: /Joined meetup/ }).textContent,
    ).toContain('New messages in the chat');
    expect(
      screen.getByRole('link', { name: /Quiet meetup/ }).textContent,
    ).not.toContain('New messages in the chat');

    fireEvent.click(screen.getByRole('tab', { name: 'Gatherings you hosted' }));

    expect(
      screen.getByRole('link', { name: /Hosted meetup/ }).textContent,
    ).toContain('New messages in the chat');
  });

  it('says it in the member’s language', () => {
    show('ar');

    expect(
      screen.getByRole('link', { name: /Joined meetup/ }).textContent,
    ).toContain('رسائل جديدة في المحادثة');
  });
});
