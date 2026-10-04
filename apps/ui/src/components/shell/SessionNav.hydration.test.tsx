import { act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sign_in } from '@founders-coffee/i18n';

const session: { current: { data: unknown; isPending: boolean } } = {
  current: { data: undefined, isPending: true },
};

const router = { clearCache: () => undefined };

vi.mock('../../lib/auth', () => ({
  authClient: { useSession: () => session.current, signOut: vi.fn() },
}));
vi.mock('../../features/profile/hooks', () => ({
  useMyProfile: () => ({
    data: { userId: 'usr_a', photoAssetId: null },
    isPending: false,
  }),
}));
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [name, value]) => path.replace(`$${name}`, value),
        to,
      )}
    >
      {children}
    </a>
  ),
  useLocation: ({ select }: { select: (l: { pathname: string }) => string }) =>
    select({ pathname: '/en' }),
  useRouter: () => router,
}));

const { AppProviders } = await import('../../lib/app-providers');
const { SessionNav } = await import('./SessionNav');

const settle = (userId: string | null) => {
  session.current = {
    data: userId
      ? {
          user: { id: userId, name: 'Amina Benali', email: 'a@test.coffee' },
          session: { id: `ses_${userId}`, userId, expiresAt: new Date(0) },
        }
      : null,
    isPending: false,
  };
};

const header = (
  <AppProviders>
    <SessionNav locale="en" />
  </AppProviders>
);

const roots: Root[] = [];

afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  document.body.replaceChildren();
  window.localStorage.clear();
  delete document.documentElement.dataset.authSlot;
  session.current = { data: undefined, isPending: true };
});

const hydrateAfterSettling = async (userId: string | null) => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(header);
  document.body.appendChild(container);
  const server = container.innerHTML;
  settle(userId);
  const reported: unknown[] = [];
  const consoleError = vi
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => void reported.push(args));
  await act(async () => {
    roots.push(
      hydrateRoot(container, header, {
        onRecoverableError: (error) => void reported.push(error),
      }),
    );
  });
  consoleError.mockRestore();
  return { server, container, reported };
};

describe('the header on a shared-cached document', () => {
  it.each([
    ['signed out', null],
    ['signed in', 'usr_a'],
  ])(
    'renders the skeleton on the server even with the session store already answered %s',
    (_, userId) => {
      settle(userId);

      const html = renderToString(header);

      expect(html).toContain('skeleton');
      expect(
        html,
        'public documents go out as public, s-maxage=60, stale-while-revalidate=300, so whatever this renders on the server is handed to every reader the shared cache serves for the next minute. A signed-in header cached from one visitor and replayed to the next is worse than a placeholder, which is why the session is resolved in the browser and this stays empty until it is',
      ).not.toContain('<details');
      expect(html).not.toContain('<a ');
    },
  );

  it('hydrates the skeleton when the session settled signed out first, then offers sign-in', async () => {
    const { server, container, reported } = await hydrateAfterSettling(null);

    expect(server).toContain('skeleton');
    expect(
      reported,
      'the session request starts before hydration and can land before React reaches the header, which must still hydrate the skeleton the server sent rather than the answer',
    ).toEqual([]);
    expect(container.querySelector('a')?.textContent).toBe(
      sign_in({}, { locale: 'en' }),
    );
  });

  it('hydrates the skeleton when the session settled signed in first, then shows the avatar', async () => {
    const { server, container, reported } = await hydrateAfterSettling('usr_a');

    expect(server).toContain('skeleton');
    expect(reported).toEqual([]);
    expect(container.querySelector('details summary')?.textContent).toBe('AB');
  });
});
