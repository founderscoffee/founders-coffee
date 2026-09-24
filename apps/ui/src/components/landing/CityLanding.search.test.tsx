import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  filter_ar,
  filter_fr,
  load_more,
  load_more_error,
  loading,
  no_filter_match,
  retry,
} from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';

import { CityLanding } from './CityLanding';
import { market, meetup, oran } from './city-landing.fixtures';

const api = vi.hoisted(() => ({ getUpcomingEvents: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => createElement('a', { href: '/', className }, children),
}));
vi.mock('../../lib/auth', () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));
vi.mock('../../features/events/api', () => ({ eventsApi: api }));

const EN = { locale: 'en' } as const;

const inArabic = (day: number) =>
  meetup({
    id: `evt_ar_${day}`,
    slug: `arabic-${day}`,
    title: `Arabic meetup ${day}`,
    language: 'ar',
    startsAt: new Date(`2099-10-${String(day).padStart(2, '0')}T17:00:00Z`),
  });

const french = meetup({
  id: 'evt_fr',
  slug: 'french',
  title: 'French meetup',
  language: 'fr',
  startsAt: new Date('2099-10-30T17:00:00Z'),
});

const firstPage = [inArabic(1), inArabic(2)];

const cursorAfter = (item: EventFeedItem) => ({
  startsAt: item.startsAt.getTime(),
  id: item.id,
});

let client: QueryClient;

const showOran = () =>
  render(
    <QueryClientProvider client={client}>
      <CityLanding
        locale="en"
        market={market}
        city={oran}
        events={firstPage}
        nextCursor={cursorAfter(inArabic(2))}
      />
    </QueryClientProvider>,
  );

const turnOn = (chip: string) =>
  fireEvent.click(screen.getByRole('button', { name: chip }));

const nothingMatches = { name: no_filter_match({}, EN) };

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  client.clear();
  api.getUpcomingEvents.mockReset();
  focusManager.setFocused(undefined);
});

describe('city page chips that match nothing loaded so far', () => {
  it('look on the next page and show what they find there', async () => {
    api.getUpcomingEvents.mockResolvedValueOnce({
      items: [french],
      nextCursor: null,
    });
    showOran();

    turnOn(filter_fr({}, EN));

    expect(screen.getByRole('status').textContent).toBe(loading({}, EN));
    expect(screen.queryByRole('heading', nothingMatches)).toBeNull();
    expect(
      await screen.findByRole('heading', { level: 3, name: 'French meetup' }),
    ).toBeTruthy();
    expect(api.getUpcomingEvents).toHaveBeenCalledOnce();
    expect(api.getUpcomingEvents).toHaveBeenCalledWith({
      data: expect.objectContaining({
        marketCode: 'DZ',
        cityCode: '1131',
        afterStartsAt: cursorAfter(inArabic(2)).startsAt,
        afterId: cursorAfter(inArabic(2)).id,
      }),
    });
  });

  it('say nothing matches only once the last page has been looked through', async () => {
    api.getUpcomingEvents
      .mockResolvedValueOnce({
        items: [inArabic(3)],
        nextCursor: cursorAfter(inArabic(3)),
      })
      .mockResolvedValueOnce({ items: [inArabic(4)], nextCursor: null });
    showOran();

    turnOn(filter_fr({}, EN));

    expect(await screen.findByRole('heading', nothingMatches)).toBeTruthy();
    expect(api.getUpcomingEvents).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('stop at a page that fails, say so, and ask again only when told to', async () => {
    api.getUpcomingEvents
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ items: [french], nextCursor: null });
    showOran();

    turnOn(filter_fr({}, EN));

    const failure = await screen.findByRole('alert');
    expect(within(failure).getByText(load_more_error({}, EN))).toBeTruthy();
    expect(
      within(failure).getByRole('button', { name: retry({}, EN) }),
      'the retry sits in the message that says what failed',
    ).toBeTruthy();
    expect(screen.queryByRole('heading', nothingMatches)).toBeNull();
    expect(
      screen.queryByRole('button', { name: load_more({}, EN) }),
      'one way to try again, not two',
    ).toBeNull();
    expect(api.getUpcomingEvents).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: retry({}, EN) }));

    expect(
      await screen.findByRole('heading', { level: 3, name: 'French meetup' }),
    ).toBeTruthy();
    expect(api.getUpcomingEvents).toHaveBeenCalledTimes(2);
  });

  it('leave a retry paused in a hidden tab to resume, rather than asking again', async () => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: 1, retryDelay: 0 } },
    });
    focusManager.setFocused(false);
    api.getUpcomingEvents
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ items: [french], nextCursor: null });
    showOran();

    turnOn(filter_fr({}, EN));

    await waitFor(() =>
      expect(
        client.getQueryCache().getAll()[0]?.state.fetchStatus,
        'the retry waiting for the tab to be seen again was replaced by a new request',
      ).toBe('paused'),
    );
    expect(api.getUpcomingEvents).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe(loading({}, EN));

    act(() => focusManager.setFocused(true));

    expect(
      await screen.findByRole('heading', { level: 3, name: 'French meetup' }),
    ).toBeTruthy();
    expect(api.getUpcomingEvents).toHaveBeenCalledTimes(2);
  });

  it('leave the next page alone when something loaded already matches', () => {
    showOran();

    turnOn(filter_ar({}, EN));

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
    expect(api.getUpcomingEvents).not.toHaveBeenCalled();
  });
});
