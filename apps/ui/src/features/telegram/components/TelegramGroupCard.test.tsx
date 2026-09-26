import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  group: { data: undefined as unknown, isError: false, refetch: vi.fn() },
}));

vi.mock('../hooks', () => ({ useTelegramGroup: () => mocks.group }));
vi.mock('./TelegramHostPanel', () => ({
  TelegramHostPanel: () => <p>host-panel</p>,
}));
vi.mock('./TelegramJoinCard', () => ({
  TelegramJoinCard: () => <p>join-card</p>,
}));

const { TelegramGroupCard } = await import('./TelegramGroupCard');

const show = () => render(<TelegramGroupCard eventId="evt_1" locale="en" />);

afterEach(() => {
  cleanup();
  mocks.group = { data: undefined, isError: false, refetch: vi.fn() };
});

describe('TelegramGroupCard', () => {
  it('shows the host their panel and a member going their card', () => {
    mocks.group.data = {
      role: 'host',
      status: 'none',
      chatTitle: null,
      canConnect: true,
    };
    show();
    expect(screen.getByText('host-panel')).toBeTruthy();
    cleanup();

    mocks.group.data = { role: 'attendee', inviteLink: null, hasJoined: false };
    show();
    expect(screen.getByText('join-card')).toBeTruthy();
  });

  it('shows nothing while loading, or to anyone the group is not for', () => {
    const loading = show();
    expect(loading.container.innerHTML).toBe('');
    cleanup();

    mocks.group.data = { role: 'none' };
    const nobody = show();
    expect(nobody.container.innerHTML).toBe('');
  });

  it('says when the group could not be loaded, and tries again on request', () => {
    mocks.group.isError = true;
    show();

    expect(
      screen.getByText("The Telegram group couldn't be loaded."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.group.refetch).toHaveBeenCalledTimes(1);
  });
});
