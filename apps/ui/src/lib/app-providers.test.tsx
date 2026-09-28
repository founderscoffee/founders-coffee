import { act, render } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const { AppProviders, useAuth } = await import('./app-providers');

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

const PrimaryAction = () => {
  const { isAuthenticated, isLoading } = useAuth();
  return (
    <button type="button" disabled={isLoading}>
      {isAuthenticated ? 'Publish' : 'Continue to sign in'}
    </button>
  );
};

const page = (
  <AppProviders>
    <PrimaryAction />
  </AppProviders>
);

describe('hydration', () => {
  const roots: Root[] = [];

  afterEach(() => {
    act(() => roots.splice(0).forEach((root) => root.unmount()));
    document.body.replaceChildren();
  });

  const hydrateAfterSettling = async (userId: string | null) => {
    session.current = { data: undefined, isPending: true };
    const container = document.createElement('div');
    container.innerHTML = renderToString(page);
    document.body.appendChild(container);
    const wasDisabledOnServer = container.querySelector('button')?.disabled;
    settle(userId);
    const reported: unknown[] = [];
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => void reported.push(args));
    await act(async () => {
      roots.push(
        hydrateRoot(container, page, {
          onRecoverableError: (error) => void reported.push(error),
        }),
      );
    });
    consoleError.mockRestore();
    return {
      wasDisabledOnServer,
      button: container.querySelector('button'),
      reported,
    };
  };

  it.each([
    ['signed out', null, 'Continue to sign in'],
    ['signed in', 'usr_a', 'Publish'],
  ])(
    'hydrates what the server rendered when the session settled %s before React reached the provider',
    async (_, userId, label) => {
      const { wasDisabledOnServer, button, reported } =
        await hydrateAfterSettling(userId);

      expect(
        wasDisabledOnServer,
        'the document never knows who is reading, so the server always renders the session as still resolving',
      ).toBe(true);
      expect(
        reported,
        'Better Auth starts the session request the first time a render reads it, and Start hydrates in a transition that yields to the network, so a quick answer lands before React reaches the provider; hydrating with it is a mismatch React 19 reports and, for attributes, never patches',
      ).toEqual([]);
      expect(
        button?.disabled,
        'the host wizard kept its action button disabled this way: React believed it had enabled a button whose DOM still carried the server’s disabled attribute',
      ).toBe(false);
      expect(button?.textContent).toBe(label);
    },
  );
});
