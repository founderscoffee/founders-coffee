import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TelegramGroupView } from '../api';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('../hooks', () => ({
  useConnectTelegramGroup: () => ({ mutate: mocks.connect, isPending: false }),
  useDisconnectTelegramGroup: () => ({
    mutate: mocks.disconnect,
    isPending: false,
  }),
}));

const { TelegramHostPanel } = await import('./TelegramHostPanel');

type HostView = Extract<TelegramGroupView, { role: 'host' }>;

const LINK =
  'https://t.me/FoundersCoffeeBot?startgroup=abc&admin=invite_users+restrict_members+pin_messages';

const view = (overrides: Partial<HostView> = {}): HostView => ({
  role: 'host',
  status: 'none',
  chatTitle: null,
  canConnect: true,
  ...overrides,
});

const show = (item: HostView, locale: 'ar' | 'en' = 'en') =>
  render(<TelegramHostPanel eventId="evt_1" locale={locale} view={item} />);

type Handlers = {
  onSuccess?: (data: unknown) => void;
  onError?: (cause: unknown) => void;
};

const handlersOf = (spy: { mock: { calls: unknown[][] } }): Handlers =>
  (spy.mock.calls[0]?.[1] ?? {}) as Handlers;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TelegramHostPanel before a group is connected', () => {
  it('offers to connect one while the meetup can still take it', () => {
    show(view());

    fireEvent.click(
      screen.getByRole('button', { name: 'Connect a Telegram group' }),
    );

    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });

  it('offers nothing once the meetup is over or cancelled', () => {
    const unconnected = show(view({ canConnect: false }));
    expect(unconnected.container.innerHTML).toBe('');
    cleanup();

    const waiting = show(view({ status: 'pending', canConnect: false }));
    expect(waiting.container.innerHTML).toBe('');
  });

  it('hands over the link that opens Telegram once it is made', () => {
    const { rerender } = show(view());
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect a Telegram group' }),
    );
    act(() =>
      handlersOf(mocks.connect).onSuccess?.({
        connectLink: LINK,
        expiresAt: new Date(),
      }),
    );
    rerender(
      <TelegramHostPanel
        eventId="evt_1"
        locale="en"
        view={view({ status: 'pending' })}
      />,
    );

    const open = screen.getByRole('link', { name: 'Open Telegram' });
    expect(open.getAttribute('href')).toBe(LINK);
    expect(open.getAttribute('rel')).toBe('noopener noreferrer');
    expect(document.activeElement).toBe(open);
  });

  it('stops handing over a link once it has run out', () => {
    const { rerender } = show(view());
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect a Telegram group' }),
    );
    act(() =>
      handlersOf(mocks.connect).onSuccess?.({
        connectLink: LINK,
        expiresAt: new Date(),
      }),
    );
    rerender(<TelegramHostPanel eventId="evt_1" locale="en" view={view()} />);

    expect(screen.queryByRole('link', { name: 'Open Telegram' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Connect a Telegram group' }),
    ).toBeTruthy();
  });

  it('offers a new link when it has lost the one it made', () => {
    show(view({ status: 'pending' }));

    expect(
      screen.getByText('Waiting for the bot to be added to your group.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Get a new link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });

  it('says why a link could not be made', () => {
    show(view());
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect a Telegram group' }),
    );

    act(() => handlersOf(mocks.connect).onError?.({ code: 'rate_limited' }));

    expect(
      screen.getByText('Too many attempts. Wait a few minutes and try again.'),
    ).toBeTruthy();
  });
});

describe('TelegramHostPanel with a group connected', () => {
  const connected = view({ status: 'active', chatTitle: 'قهوة المؤسسين' });

  it('names the group as its title is written', () => {
    show(connected);

    expect(screen.getByText('Your group is connected.')).toBeTruthy();
    expect(screen.getByText('قهوة المؤسسين').getAttribute('dir')).toBe('auto');
  });

  it('asks before letting the bot go, and lets the host keep it', () => {
    show(connected);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(mocks.disconnect).not.toHaveBeenCalled();
    const keep = screen.getByRole('button', { name: 'Keep it' });
    expect(document.activeElement).toBe(keep);
    fireEvent.click(keep);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Disconnect' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });

  it('offers to connect again once the bot has gone, with focus on it', () => {
    const { rerender } = show(connected);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    act(() => handlersOf(mocks.disconnect).onSuccess?.({ disconnected: true }));
    rerender(<TelegramHostPanel eventId="evt_1" locale="en" view={view()} />);

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Connect a Telegram group' }),
    );
  });

  it('stays available after the meetup, until the bot leaves on its own', () => {
    show({ ...connected, canConnect: false });

    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
  });

  it('reads in Arabic', () => {
    show(connected, 'ar');

    expect(
      screen.getByRole('heading', { name: 'مجموعة تيليغرام' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'فكّ الربط' })).toBeTruthy();
  });
});
