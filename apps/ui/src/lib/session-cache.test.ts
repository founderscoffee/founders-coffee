import { QueryClient } from '@tanstack/react-query';
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
    const clear = vi.spyOn(client, 'clear');

    await expect(withdrawMemberCaches(client)).resolves.toBeUndefined();
    expect(clear).toHaveBeenCalledOnce();
  });
});
