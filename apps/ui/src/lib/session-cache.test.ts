import {
  MutationObserver,
  QueryClient,
  QueryObserver,
} from '@tanstack/react-query';
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

    await withdrawMemberCaches(client);

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

    await withdrawMemberCaches(client);
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
    await withdrawMemberCaches(client);

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

    await withdrawMemberCaches(client);

    expect(client.getQueryData(['events', 'upcoming', {}])).toBeUndefined();
  });

  it('forgets what the previous member sent', async () => {
    const client = new QueryClient();
    await new MutationObserver(client, {
      mutationFn: (name: string) => Promise.resolve(name),
    }).mutate('Amina');
    expect(client.getMutationCache().getAll()).toHaveLength(1);

    await withdrawMemberCaches(client);

    expect(client.getMutationCache().getAll()).toEqual([]);
  });

  it('clears every stored page, private path or not, and keeps the assets', async () => {
    const { deleted, storage } = fakeStorage({
      'https://founders.coffee/profile': html,
      'https://founders.coffee/_serverFn/getMyProfile': asset,
      'https://founders.coffee/algeria/e/coffee-code': html,
      'https://founders.coffee/assets/app-abc123.css': asset,
    });

    await withdrawMemberCaches(new QueryClient(), storage);

    expect(deleted).toEqual([
      '/profile',
      '/_serverFn/getMyProfile',
      '/algeria/e/coffee-code',
    ]);
  });

  it('works where the page has no cache storage at all', async () => {
    const client = new QueryClient();
    client.setQueryData(['profile', 'owner', 'usr_a'], { userId: 'usr_a' });

    await expect(withdrawMemberCaches(client)).resolves.toBeUndefined();
    expect(client.getQueryData(['profile', 'owner', 'usr_a'])).toBeUndefined();
  });
});
