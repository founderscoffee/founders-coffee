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
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LOCALES,
  load_more,
  load_more_error,
  retry,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';

import { useUpcomingEvents } from '../../features/events/hooks';
import { useEventPages } from '../../features/events/useEventPages';
import { meetup } from '../landing/city-landing.fixtures';
import { LoadMoreEvents } from './LoadMoreEvents';

const api = vi.hoisted(() => ({ getUpcomingEvents: vi.fn() }));

vi.mock('../../lib/auth', () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));
vi.mock('../../features/events/api', () => ({ eventsApi: api }));

const EN = { locale: 'en' } as const;

const first = meetup({ id: 'evt_first', slug: 'first', title: 'First meetup' });

const next = meetup({
  id: 'evt_next',
  slug: 'next',
  title: 'Next meetup',
  startsAt: new Date('2099-09-25T14:00:00Z'),
});

const cursorAfter = (item: EventFeedItem) => ({
  startsAt: item.startsAt.getTime(),
  id: item.id,
});

const UpcomingList = ({ locale }: { locale: Locale }) => {
  const pagination = useEventPages(
    useUpcomingEvents(
      { marketCode: 'DZ', limit: 1 },
      { initialPage: { items: [first], nextCursor: cursorAfter(first) } },
    ),
    [first],
  );
  return (
    <>
      <ul>
        {pagination.items.map((event) => (
          <li key={event.id}>{event.title}</li>
        ))}
      </ul>
      <LoadMoreEvents locale={locale} pagination={pagination} />
    </>
  );
};

let client: QueryClient;

const showList = (locale: Locale = 'en') =>
  render(
    <QueryClientProvider client={client}>
      <UpcomingList locale={locale} />
    </QueryClientProvider>,
  );

const press = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

const listState = () => client.getQueryCache().getAll()[0]?.state;

const expectNoAlert = (message: string) =>
  expect(
    screen.findByRole('alert', {}, { timeout: 200 }),
    message,
  ).rejects.toThrow();

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  client.clear();
  api.getUpcomingEvents.mockReset();
  focusManager.setFocused(undefined);
});

describe('Load more beneath an event list', () => {
  it('adds the next page beneath the first and says nothing of failing', async () => {
    api.getUpcomingEvents.mockResolvedValueOnce({
      items: [next],
      nextCursor: null,
    });
    showList();

    press(load_more({}, EN));

    expect(await screen.findByText('Next meetup')).toBeTruthy();
    expect(screen.getByText('First meetup')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each<Locale>(LOCALES)(
    'says in %s that the next page could not be loaded, and asks for it again on Retry',
    async (locale) => {
      api.getUpcomingEvents
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValueOnce({ items: [next], nextCursor: null });
      showList(locale);

      press(load_more({}, { locale }));

      expect((await screen.findByRole('alert')).textContent).toBe(
        load_more_error({}, { locale }),
      );
      expect(
        screen.queryByRole('button', { name: load_more({}, { locale }) }),
        'one way to try again, not two',
      ).toBeNull();

      press(retry({}, { locale }));

      expect(await screen.findByText('Next meetup')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(api.getUpcomingEvents).toHaveBeenCalledTimes(2);
      expect(api.getUpcomingEvents).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          afterStartsAt: cursorAfter(first).startsAt,
          afterId: first.id,
        }),
      });
    },
  );

  it('takes the alert down while Retry is on its way, and raises a new one when that fails too', async () => {
    let failAgain: (reason: Error) => void = () => undefined;
    api.getUpcomingEvents
      .mockRejectedValueOnce(new Error('network down'))
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          failAgain = reject;
        }),
      );
    showList();

    press(load_more({}, EN));
    const firstAlert = await screen.findByRole('alert');
    press(retry({}, EN));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    const button = screen.getByRole<HTMLButtonElement>('button');
    expect(button.disabled).toBe(true);
    expect(
      button.textContent,
      'Retry is offered only beside the alert that says why',
    ).toBe(load_more({}, EN));

    await act(async () => failAgain(new Error('still down')));

    const secondAlert = await screen.findByRole('alert');
    expect(secondAlert.textContent).toBe(load_more_error({}, EN));
    expect(
      secondAlert,
      'an alert left in place is not read out a second time',
    ).not.toBe(firstAlert);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: retry({}, EN) })
        .disabled,
    ).toBe(false);
  });

  it('holds the alert back while a retry waits for a hidden tab to be shown', async () => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: 1, retryDelay: 0 } },
    });
    api.getUpcomingEvents
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ items: [next], nextCursor: null });
    showList();

    press(load_more({}, EN));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(api.getUpcomingEvents).toHaveBeenCalledTimes(2);

    focusManager.setFocused(false);
    press(retry({}, EN));

    await waitFor(() => expect(listState()?.fetchStatus).toBe('paused'));
    await expectNoAlert('a retry still due was reported as a failure');
    expect(api.getUpcomingEvents).toHaveBeenCalledTimes(3);

    act(() => focusManager.setFocused(true));

    expect(await screen.findByText('Next meetup')).toBeTruthy();
    expect(api.getUpcomingEvents).toHaveBeenCalledTimes(4);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not take a failed refresh of the loaded pages for a next page that would not load', async () => {
    api.getUpcomingEvents.mockRejectedValueOnce(new Error('network down'));
    showList();

    await act(() => client.refetchQueries());

    expect(listState()?.status).toBe('error');
    await expectNoAlert(
      'a failed refresh was reported as a next page that would not load',
    );
    expect(screen.getByText('First meetup')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: load_more({}, EN) }),
    ).toBeTruthy();
  });
});
