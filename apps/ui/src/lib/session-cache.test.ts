import {
  MutationObserver,
  QueryClient,
  QueryObserver,
} from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';

import { memberChanged, withdrawMemberCaches } from './session-cache';

const html = new Response('<!doctype html>', {
  headers: { 'content-type': 'text/html; charset=utf-8' },
});
const asset = new Response('body{}', {
  headers: { 'content-type': 'text/css' },
});

const fakeStorage = (entries: Readonly<Record<string, Response>>) => {
  const deleted: string[] = [];
  const cache = {
    keys: () =>
      Promise.resolve(Object.keys(entries).map((url) => new Request(url))),
    match: (request: Request) => Promise.resolve(entries[request.url]),
    delete: (request: Request) => {
      deleted.push(new URL(request.url).pathname);
      return Promise.resolve(true);
    },
  };
  return {
    deleted,
    storage: {
      keys: () => Promise.resolve(['pages']),
      open: () => Promise.resolve(cache),
    } as unknown as CacheStorage,
  };
};

const routerKeepingNothing = { clearCache: () => undefined };

let reader = 'usr_a';
let pageAnswer: Promise<void> = Promise.resolve();
const loads: string[] = [];

const rootRoute = createRootRoute();
const pageAt = (path: 'meetup' | 'elsewhere') =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    loader: async () => {
      loads.push(path);
      await pageAnswer;
      return { path, reader };
    },
  });
const routeTree = rootRoute.addChildren([
  pageAt('meetup'),
  pageAt('elsewhere'),
]);

/** A router showing `href` as it loaded for `usr_a`, each page answering at once until a test holds `pageAnswer` back. */
const routerOn = async (href: string) => {
  reader = 'usr_a';
  pageAnswer = Promise.resolve();
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [href] }),
  });
  await router.load();
  loads.length = 0;
  return router;
};

describe('member cache isolation', () => {
  it('treats the first settled session as nothing to withdraw', () => {
    expect(memberChanged(undefined, 'usr_a')).toBe(false);
    expect(memberChanged(undefined, null)).toBe(false);
  });

  it('withdraws on sign-out, sign-in and a switch between members', () => {
    expect(memberChanged('usr_a', null)).toBe(true);
    expect(memberChanged(null, 'usr_a')).toBe(true);
    expect(memberChanged('usr_a', 'usr_b')).toBe(true);
  });

  it('leaves a settled session alone while it stays the same member', () => {
    expect(memberChanged('usr_a', 'usr_a')).toBe(false);
    expect(memberChanged(null, null)).toBe(false);
  });

  it('drops viewer-dependent feed entries, not only the owner profile', async () => {
    const client = new QueryClient();
    client.setQueryData(['events', 'upcoming', {}], { viewerRsvp: 'going' });
    client.setQueryData(['profile', 'owner', 'usr_a'], { userId: 'usr_a' });

    await withdrawMemberCaches(client, routerKeepingNothing);

    expect(client.getQueryData(['events', 'upcoming', {}])).toBeUndefined();
    expect(client.getQueryData(['profile', 'owner', 'usr_a'])).toBeUndefined();
  });

  it('asks again for what is on screen, rather than leaving it waiting', async () => {
    const client = new QueryClient();
    const answers: ((profile: { userId: string }) => void)[] = [];
    const observer = new QueryObserver(client, {
      queryKey: ['profile', 'owner', 'usr_b'],
      queryFn: () =>
        new Promise<{ userId: string }>((resolve) => {
          answers.push(resolve);
        }),
    });
    const unsubscribe = observer.subscribe(() => undefined);

    await withdrawMemberCaches(client, routerKeepingNothing);
    for (const answer of answers) answer({ userId: 'usr_b' });

    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toEqual({ userId: 'usr_b' }),
    );
    unsubscribe();
  });

  it('replaces what a screen shows with what the new member should see', async () => {
    const client = new QueryClient();
    let viewer = 'usr_a';
    const observer = new QueryObserver(client, {
      queryKey: ['events', 'upcoming', {}],
      queryFn: () => Promise.resolve({ viewer }),
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toEqual({ viewer: 'usr_a' }),
    );

    viewer = 'usr_b';
    await withdrawMemberCaches(client, routerKeepingNothing);

    expect(observer.getCurrentResult().data).not.toEqual({ viewer: 'usr_a' });
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toEqual({ viewer: 'usr_b' }),
    );
    unsubscribe();
  });

  it('removes what nothing is reading, so a first page seeded for the last member cannot return', async () => {
    const client = new QueryClient();
    new QueryObserver(client, {
      queryKey: ['events', 'upcoming', {}],
      queryFn: () => Promise.resolve({ viewerRsvp: null }),
      initialData: { viewerRsvp: 'going' },
    });

    await withdrawMemberCaches(client, routerKeepingNothing);

    expect(client.getQueryData(['events', 'upcoming', {}])).toBeUndefined();
  });

  it('forgets what the previous member sent', async () => {
    const client = new QueryClient();
    await new MutationObserver(client, {
      mutationFn: (name: string) => Promise.resolve(name),
    }).mutate('Amina');
    expect(client.getMutationCache().getAll()).toHaveLength(1);

    await withdrawMemberCaches(client, routerKeepingNothing);

    expect(client.getMutationCache().getAll()).toEqual([]);
  });

  it('clears every stored page, private path or not, and keeps the assets', async () => {
    const { deleted, storage } = fakeStorage({
      'https://founders.coffee/profile': html,
      'https://founders.coffee/_serverFn/getMyProfile': asset,
      'https://founders.coffee/algeria/e/coffee-code': html,
      'https://founders.coffee/assets/app-abc123.css': asset,
    });

    await withdrawMemberCaches(
      new QueryClient(),
      routerKeepingNothing,
      storage,
    );

    expect(deleted).toEqual([
      '/profile',
      '/_serverFn/getMyProfile',
      '/algeria/e/coffee-code',
    ]);
  });

  it('works where the page has no cache storage at all', async () => {
    const client = new QueryClient();
    client.setQueryData(['profile', 'owner', 'usr_a'], { userId: 'usr_a' });

    await expect(
      withdrawMemberCaches(client, routerKeepingNothing),
    ).resolves.toBeUndefined();
    expect(client.getQueryData(['profile', 'owner', 'usr_a'])).toBeUndefined();
  });

  it('loads a page the router kept for the previous member before it shows it again', async () => {
    const router = await routerOn('/meetup');
    router.history.push('/elsewhere');
    await router.load();
    reader = 'usr_b';
    let answerNow = (): void => undefined;
    pageAnswer = new Promise((resolve) => {
      answerNow = resolve;
    });

    await withdrawMemberCaches(new QueryClient(), router);
    router.history.back();
    const back = router.load();
    await vi.waitFor(() => expect(loads).toContain('meetup'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const shownWhileLoading = router.state.matches.at(-1)?.loaderData;
    answerNow();
    await back;

    expect(
      shownWhileLoading,
      'Back showed the meetup as it had loaded for its host, who had just signed out, while it loaded again behind it',
    ).not.toEqual({ path: 'meetup', reader: 'usr_a' });
    await vi.waitFor(() =>
      expect(router.state.matches.at(-1)?.loaderData).toEqual({
        path: 'meetup',
        reader: 'usr_b',
      }),
    );
  });
});
