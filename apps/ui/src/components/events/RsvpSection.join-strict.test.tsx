import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { rememberJoinIntent } from '../../features/events/join-intent';
import { rsvpEvent as event } from './RsvpSection.fixtures';

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  createRsvp: vi.fn(() => Promise.resolve({ status: 'going' as const })),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: mocks.invalidate }),
}));

vi.mock('../../lib/auth', () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));

vi.mock('../../features/events/api', () => ({
  eventsApi: { createRsvp: mocks.createRsvp, cancelRsvp: vi.fn() },
}));

vi.mock('../../lib/app-providers', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('./HostEventPanel', () => ({ HostEventPanel: () => null }));
vi.mock('../../features/chat/components/ChatOpenButton', () => ({
  ChatOpenButton: () => null,
}));
vi.mock('../../features/events/components/PushPermissionPrompt', () => ({
  PushPermissionPrompt: () => <p>push-prompt</p>,
}));

const { RsvpSection } = await import('./RsvpSection');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe('joining after sign-in under StrictMode', () => {
  it('settles the seat it takes', async () => {
    rememberJoinIntent(event.id);

    render(
      <StrictMode>
        <QueryClientProvider client={new QueryClient()}>
          <RsvpSection
            event={event}
            hostName="Amine"
            marketSlug="algeria"
            locale="en"
            isHost={false}
            live={null}
            isWindowOpen={false}
            phase="upcoming"
            isChatAvailable={false}
          />
        </QueryClientProvider>
      </StrictMode>,
    );

    await waitFor(() =>
      expect(
        mocks.invalidate,
        'a join started during the mount is dropped by the observer StrictMode tears down, so the page never learns the seat is taken',
      ).toHaveBeenCalledTimes(1),
    );
    expect(mocks.createRsvp).toHaveBeenCalledTimes(1);
    expect(screen.getByText('push-prompt')).toBeTruthy();
    expect(screen.queryByText('Saving your seat…')).toBeNull();
  });
});
