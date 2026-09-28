import {
  QueryClient,
  QueryClientProvider,
  type FetchStatus,
} from '@tanstack/react-query';
import { act } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const session: { current: { data: unknown; isPending: boolean } } = {
  current: { data: undefined, isPending: true },
};

vi.mock('./auth', () => ({
  authClient: { useSession: () => session.current },
}));

const unanswered = () => new Promise<never>(() => undefined);

vi.mock('../features/profile/api', () => ({
  profileApi: { getMyProfile: unanswered },
}));
vi.mock('../features/account/api', () => ({
  accountApi: { getMyAccount: unanswered, getMyDevices: unanswered },
}));
vi.mock('../features/preferences/api', () => ({
  preferencesApi: { getMyPreferences: unanswered },
}));
vi.mock('../features/push/client', () => ({}));
vi.mock('../features/operations/api', () => ({
  operationsApi: {
    getCloseoutView: unanswered,
    getMyCloseoutStates: unanswered,
    getFeedbackView: unanswered,
    getFeedbackTally: unanswered,
  },
}));
vi.mock('../features/events/api', () => ({
  eventsApi: { getMyJoinedEvents: unanswered },
}));

const { useMyAccount, useMyDevices } =
  await import('../features/account/hooks');
const { useMyJoinedEvents } = await import('../features/events/hooks');
const { useCloseout, useFeedback, useFeedbackTally, useMyCloseoutStates } =
  await import('../features/operations/hooks');
const { useMyPreferences } = await import('../features/preferences/hooks');
const { useMyProfile } = await import('../features/profile/hooks');

type Read = () => {
  userId?: string;
  isAuthLoading?: boolean;
  fetchStatus: FetchStatus;
};

const READS: Record<string, Read> = {
  useMyProfile,
  useMyAccount,
  useMyDevices,
  useMyPreferences,
  useMyJoinedEvents: () => useMyJoinedEvents(),
  useCloseout: () => useCloseout('evt_1'),
  useMyCloseoutStates: () => useMyCloseoutStates(['evt_1']),
  useFeedback: () => useFeedback('evt_1'),
  useFeedbackTally: () => useFeedbackTally('evt_1', true),
};

const Probe = ({ useRead }: { useRead: Read }) => {
  const { userId, isAuthLoading, fetchStatus } = useRead();
  return <p>{[userId ?? 'nobody', isAuthLoading, fetchStatus].join(' ')}</p>;
};

const page = (useRead: Read) => (
  <QueryClientProvider client={new QueryClient()}>
    <Probe useRead={useRead} />
  </QueryClientProvider>
);

const roots: Root[] = [];

afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  document.body.replaceChildren();
  session.current = { data: undefined, isPending: true };
});

describe('what the member data hooks render while React hydrates', () => {
  it.each(Object.entries(READS))(
    '%s hydrates what the server rendered when the session settled first, then asks for the member',
    async (_, useRead) => {
      const container = document.createElement('div');
      container.innerHTML = renderToString(page(useRead));
      document.body.appendChild(container);
      session.current = {
        data: { user: { id: 'usr_a' }, session: { id: 'ses_a' } },
        isPending: false,
      };
      const reported: unknown[] = [];
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation((...args: unknown[]) => void reported.push(args));
      await act(async () => {
        roots.push(
          hydrateRoot(container, page(useRead), {
            onRecoverableError: (error) => void reported.push(error),
          }),
        );
      });
      consoleError.mockRestore();

      expect(
        reported,
        'the server renders nobody, still resolving, asking for nothing; a hook that reads the browser’s early answer during hydration renders a member and a running request instead',
      ).toEqual([]);
      expect(container.textContent).toMatch(/ fetching$/);
    },
  );
});
