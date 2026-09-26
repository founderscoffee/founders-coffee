import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../lib/query-client';
import type { TelegramGroupView } from './api';
import {
  useConnectTelegramGroup,
  useDisconnectTelegramGroup,
  useRequestTelegramInvite,
  useTelegramGroup,
} from './hooks';

const INVITE = 'https://t.me/+member';

const hostView = (
  status: 'none' | 'pending' | 'active',
): TelegramGroupView => ({
  role: 'host',
  status,
  chatTitle: status === 'active' ? 'Founders' : null,
  canConnect: true,
});

const server = vi.hoisted(() => ({
  view: { role: 'none' } as TelegramGroupView,
  reads: 0,
  isConnectRefused: false,
}));

vi.mock('./api', () => ({
  telegramApi: {
    getView: async () => {
      server.reads += 1;
      return server.view;
    },
    connect: async () => {
      if (server.isConnectRefused)
        throw Object.assign(new Error('refused'), {
          code: 'telegram_group_connected',
        });
      server.view = hostView('pending');
      return { connectLink: 'https://t.me/bot', expiresAt: new Date() };
    },
    disconnect: async () => {
      server.view = hostView('none');
      return { disconnected: true };
    },
    requestInvite: async () => {
      server.view = { role: 'attendee', inviteLink: INVITE, hasJoined: false };
      return { inviteLink: INVITE };
    },
  },
}));

let cache = createQueryClient();
const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cache}>{children}</QueryClientProvider>
);

const renderHost = () =>
  renderHook(
    () => ({
      group: useTelegramGroup('evt_1'),
      connect: useConnectTelegramGroup('evt_1'),
      disconnect: useDisconnectTelegramGroup('evt_1'),
    }),
    { wrapper: Wrapper },
  );

beforeEach(() => {
  cache = createQueryClient();
  server.view = hostView('none');
  server.reads = 0;
  server.isConnectRefused = false;
});

afterEach(() => {
  cleanup();
  cache.clear();
  focusManager.setFocused(undefined);
});

describe('the Telegram group hooks', () => {
  it('show the host where their group stands after each thing they do', async () => {
    const { result } = renderHost();
    await waitFor(() =>
      expect(result.current.group.data).toEqual(hostView('none')),
    );

    await act(() => result.current.connect.mutateAsync());
    await waitFor(() =>
      expect(result.current.group.data).toEqual(hostView('pending')),
    );

    await act(() => result.current.disconnect.mutateAsync());
    await waitFor(() =>
      expect(result.current.group.data).toEqual(hostView('none')),
    );
  });

  it('show what happened in Telegram when a link is refused because of it', async () => {
    const { result } = renderHost();
    await waitFor(() =>
      expect(result.current.group.data).toEqual(hostView('none')),
    );
    server.view = hostView('active');
    server.isConnectRefused = true;

    await act(() =>
      result.current.connect.mutateAsync().catch(() => undefined),
    );

    await waitFor(() =>
      expect(result.current.group.data).toEqual(hostView('active')),
    );
  });

  it('put the invite a member asked for on their card', async () => {
    server.view = { role: 'attendee', inviteLink: null, hasJoined: false };
    const { result } = renderHook(
      () => ({
        group: useTelegramGroup('evt_1'),
        invite: useRequestTelegramInvite('evt_1'),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.group.isSuccess).toBe(true));

    await act(() => result.current.invite.mutateAsync());

    await waitFor(() =>
      expect(result.current.group.data).toEqual({
        role: 'attendee',
        inviteLink: INVITE,
        hasJoined: false,
      }),
    );
  });

  it('ask again when the reader comes back from Telegram', async () => {
    const { result } = renderHost();
    await waitFor(() =>
      expect(result.current.group.data).toEqual(hostView('none')),
    );
    server.view = hostView('active');

    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    await waitFor(() =>
      expect(result.current.group.data).toEqual(hostView('active')),
    );
    expect(server.reads).toBe(2);
  });
});
