import { CatchBoundary } from '@tanstack/react-router';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CHAT_FAILED = 'The chat could not be loaded.';
const ROUTE_FAILED = 'The route error page';

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  observability: {
    logger: {},
    reportError: vi.fn(),
  },
}));

vi.mock('@founders-coffee/observability', () => mocks.observability);
vi.mock('../useChatAddress', () => ({
  useChatAddress: () => ({ isOpen: true, open: vi.fn(), close: mocks.close }),
}));
vi.mock('../../../lib/app-providers', () => ({
  useAuth: () => ({ user: { id: 'usr_me' }, isLoading: false }),
}));
vi.mock('./ChatMuteToggle', () => ({ ChatMuteToggle: () => null }));

const lostChunk = new TypeError(
  'Failed to fetch dynamically imported module: https://founders.coffee/assets/ChatConversation-C4bTq9Lx.js',
);

const RouteError = () => <p>{ROUTE_FAILED}</p>;

const chatWithoutItsConversation = async () => {
  vi.resetModules();
  vi.doMock('./ChatConversation', () => {
    throw lostChunk;
  });
  const { EventChat } = await import('./EventChat');
  await act(async () => {
    render(
      <CatchBoundary getResetKey={() => 0} errorComponent={RouteError}>
        <EventChat
          locale="en"
          eventId="evt_1"
          title="Founders breakfast"
          isMember
          isCancelled={false}
          endsAt={null}
          timeZone="Africa/Algiers"
        />
      </CatchBoundary>,
    );
  });
};

const panel = () =>
  screen.getByRole('dialog', { name: 'Chat Founders breakfast' });

const reload = vi.fn();

beforeEach(() => {
  vi.stubGlobal('location', { ...window.location, reload });
});

afterEach(() => {
  cleanup();
  vi.doUnmock('./ChatConversation');
  vi.unstubAllGlobals();
  reload.mockReset();
  mocks.close.mockReset();
  mocks.observability.reportError.mockReset();
});

describe('the chat panel when the conversation’s own code never arrives', () => {
  it('shows the chat’s failure inside the panel, and the meetup page around it stays', async () => {
    await chatWithoutItsConversation();

    await waitFor(() => {
      expect(
        screen.queryByText(ROUTE_FAILED),
        'the failed import of ChatConversation reached the route, whose error page then replaced the whole meetup page',
      ).toBeNull();
      expect(within(panel()).getByText(CHAT_FAILED)).toBeTruthy();
    });
    expect(within(panel()).getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('still closes through the address', async () => {
    await chatWithoutItsConversation();
    await screen.findByText(CHAT_FAILED);

    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Close chat' }),
    );

    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('loads the page again on Retry, the only way to fetch that code again', async () => {
    await chatWithoutItsConversation();
    await screen.findByText(CHAT_FAILED);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(
      reload,
      'a browser keeps a module that failed to load as failed for the rest of the page, so a remount only meets the same failure',
    ).toHaveBeenCalledOnce();
  });

  it('reports the failure once, as the chat’s', async () => {
    await chatWithoutItsConversation();
    await screen.findByText(CHAT_FAILED);

    expect(mocks.observability.reportError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ cause: lostChunk }),
      { source: 'chat' },
      mocks.observability.logger,
    );
  });
});
