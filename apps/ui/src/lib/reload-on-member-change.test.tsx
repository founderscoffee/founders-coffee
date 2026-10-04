import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session: { current: { data: unknown; isPending: boolean } } = {
  current: { data: null, isPending: true },
};

const mocks = vi.hoisted(() => {
  const invalidate = vi.fn(() => Promise.resolve());
  return { invalidate, router: { invalidate } };
});

vi.mock('./auth', () => ({
  authClient: { useSession: () => session.current },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useRouter: () => mocks.router,
}));

const { useReloadOnMemberChange } = await import('./reload-on-member-change');

const Page = () => {
  useReloadOnMemberChange();
  return null;
};

const resolving = () => {
  session.current = { data: null, isPending: true };
};

const settle = (userId: string | null) => {
  session.current = {
    data: userId
      ? {
          user: { id: userId, name: 'A', email: 'a@test.coffee' },
          session: { id: `ses_${userId}`, userId, expiresAt: new Date(0) },
        }
      : null,
    isPending: false,
  };
};

afterEach(() => cleanup());

describe('loading the page again for another member', () => {
  beforeEach(() => {
    mocks.invalidate.mockClear();
    resolving();
  });

  it('loads nothing again when the session answers with the member the page was loaded for', () => {
    const view = render(<Page />);
    settle('usr_host');
    view.rerender(<Page />);

    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it('loads the page again when its member signs out from the header', () => {
    settle('usr_host');
    const view = render(<Page />);
    settle(null);
    view.rerender(<Page />);

    expect(
      mocks.invalidate,
      "the meetup page takes whether its reader hosts it from its loader, so a host who signed out kept the host's panel until the page loaded again",
    ).toHaveBeenCalledOnce();
  });

  it('loads the page again when another tab signs in as someone else', () => {
    settle('usr_host');
    const view = render(<Page />);
    settle('usr_guest');
    view.rerender(<Page />);

    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });

  it('waits out a refetch that answers with the same member', () => {
    settle('usr_host');
    const view = render(<Page />);
    resolving();
    view.rerender(<Page />);
    settle('usr_host');
    view.rerender(<Page />);

    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it('leaves a signed-out page alone while a refetch asks again', () => {
    settle(null);
    const view = render(<Page />);
    resolving();
    view.rerender(<Page />);
    settle(null);
    view.rerender(<Page />);

    expect(
      mocks.invalidate,
      'Better Auth reports a signed-out session as pending again on every refetch, a focus among them',
    ).not.toHaveBeenCalled();
  });
});
