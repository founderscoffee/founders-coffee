import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session: { current: { data: unknown; isPending: boolean } } = {
  current: { data: undefined, isPending: true },
};

vi.mock('./auth', () => ({
  authClient: { useSession: () => session.current },
}));

const withdraw = vi.fn(() => Promise.resolve());

vi.mock('./session-cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./session-cache')>()),
  withdrawMemberCaches: () => withdraw(),
}));

const { AppProviders } = await import('./app-providers');

const settle = (userId: string | null) => {
  session.current = {
    data: userId
      ? { user: { id: userId, name: 'A', email: 'a@test.coffee' } }
      : null,
    isPending: false,
  };
};

describe('member cache isolation wiring', () => {
  beforeEach(() => {
    withdraw.mockClear();
    session.current = { data: undefined, isPending: true };
  });

  it('withdraws nothing while the session is still resolving', () => {
    const view = render(<AppProviders>ok</AppProviders>);
    settle('usr_a');
    view.rerender(<AppProviders>ok</AppProviders>);

    expect(withdraw).not.toHaveBeenCalled();
  });

  it('withdraws when the member behind the tab changes', () => {
    settle('usr_a');
    const view = render(<AppProviders>ok</AppProviders>);
    expect(withdraw).not.toHaveBeenCalled();

    settle(null);
    view.rerender(<AppProviders>ok</AppProviders>);
    expect(withdraw).toHaveBeenCalledOnce();

    settle('usr_b');
    view.rerender(<AppProviders>ok</AppProviders>);
    expect(withdraw).toHaveBeenCalledTimes(2);
  });

  it('leaves a steady session alone across re-renders', () => {
    settle('usr_a');
    const view = render(<AppProviders>ok</AppProviders>);
    view.rerender(<AppProviders>ok</AppProviders>);
    view.rerender(<AppProviders>ok</AppProviders>);

    expect(withdraw).not.toHaveBeenCalled();
  });
});
