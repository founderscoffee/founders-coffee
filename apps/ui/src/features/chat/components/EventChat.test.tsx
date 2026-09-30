import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isHydrated: true,
  isOpen: true,
  auth: {
    user: null as { id: string } | null,
    isLoading: false,
  },
  close: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useHydrated: () => mocks.isHydrated,
}));
vi.mock('../useChatAddress', () => ({
  useChatAddress: () => ({
    isOpen: mocks.isOpen,
    open: vi.fn(),
    close: mocks.close,
  }),
}));
vi.mock('../../../lib/app-providers', () => ({ useAuth: () => mocks.auth }));
vi.mock('../chat-panel-loader', () => ({
  loadChatConversation: async () => ({
    ChatConversation: ({ viewerId }: { viewerId: string }) => (
      <p>conversation for {viewerId}</p>
    ),
  }),
}));
vi.mock('./ChatSignIn', () => ({ ChatSignIn: () => <p>chat-sign-in</p> }));

const { EventChat } = await import('./EventChat');

const show = (isMember: boolean) =>
  render(
    <EventChat
      locale="en"
      eventId="evt_1"
      title="Founders breakfast"
      isMember={isMember}
      isCancelled={false}
      endsAt={null}
      timeZone="Africa/Algiers"
    />,
  );

const panel = () =>
  screen.queryByRole('dialog', { name: 'Chat Founders breakfast' });

beforeEach(() => {
  mocks.isHydrated = true;
  mocks.isOpen = true;
  mocks.auth = { user: { id: 'usr_me' }, isLoading: false };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EventChat', () => {
  it('opens the conversation for a member whose address asks for it', async () => {
    show(true);

    expect(panel()).toBeTruthy();
    expect(await screen.findByText('conversation for usr_me')).toBeTruthy();
  });

  it('asks a signed-out reader to sign in, inside the panel', () => {
    mocks.auth = { user: null, isLoading: false };
    show(false);

    expect(panel()).toBeTruthy();
    expect(screen.getByText('chat-sign-in')).toBeTruthy();
  });

  it.each([
    ['before the page hydrates', () => (mocks.isHydrated = false)],
    ['while the address has no panel', () => (mocks.isOpen = false)],
    [
      'while the session is being read',
      () => (mocks.auth = { user: null, isLoading: true }),
    ],
  ])('opens nothing %s', (_case, arrange) => {
    arrange();
    show(true);

    expect(panel()).toBeNull();
  });

  it('opens nothing for a signed-in reader who is not going', () => {
    show(false);

    expect(panel()).toBeNull();
  });

  it('closes through the address', () => {
    show(true);

    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }));

    expect(mocks.close).toHaveBeenCalledTimes(1);
  });
});
