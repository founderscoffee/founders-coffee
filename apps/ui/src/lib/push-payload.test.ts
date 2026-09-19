import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readPushPayload, samePathOr } from './push-payload';

const EVENT_URL = 'https://founders.coffee/algeria/e/coffee-and-code';

beforeEach(() => {
  vi.stubGlobal('self', { location: { origin: 'https://founders.coffee' } });
});

describe('readPushPayload', () => {
  it('reads an FCM data message, which is what the producer sends', () => {
    expect(
      readPushPayload({
        data: {
          title: 'Tomorrow',
          body: 'Coffee + code, 18:00',
          url: EVENT_URL,
          icon: '/android-chrome-192x192.png',
          dedupeKey: 'ntf_1',
        },
        from: '1234567890',
        fcmMessageId: 'msg_1',
      }),
    ).toEqual({
      title: 'Tomorrow',
      body: 'Coffee + code, 18:00',
      url: '/algeria/e/coffee-and-code',
      icon: '/android-chrome-192x192.png',
      dedupeKey: 'ntf_1',
    });
  });

  it('reads an FCM notification message, in case something still sends one', () => {
    const payload = readPushPayload({
      notification: { title: 'Cancelled', body: 'The host cancelled' },
      data: { url: EVENT_URL },
    });

    expect(payload.title).toBe('Cancelled');
    expect(payload.url).toBe('/algeria/e/coffee-and-code');
  });

  it('reads a flat Web Push payload', () => {
    expect(readPushPayload({ title: 'Hi', body: 'There' }).title).toBe('Hi');
  });

  it('names the app rather than showing undefined when a title is missing', () => {
    expect(readPushPayload({ body: 'no title here' }).title).toBe(
      'Founders Coffee',
    );
  });

  it('falls back to the app icon rather than a path that 404s', () => {
    expect(readPushPayload({ title: 'x' }).icon).toBe(
      '/android-chrome-192x192.png',
    );
  });

  it('survives a payload that is not an object at all', () => {
    expect(readPushPayload('just text').title).toBe('Founders Coffee');
    expect(readPushPayload(null).url).toBe('/');
  });

  it('has no dedupe key rather than an empty one when none was sent', () => {
    expect(readPushPayload({ title: 'x', dedupeKey: '' }).dedupeKey).toBeNull();
  });
});

describe('samePathOr', () => {
  it('reduces one of our own absolute URLs to a path', () => {
    expect(samePathOr(EVENT_URL, '/')).toBe('/algeria/e/coffee-and-code');
  });

  it('keeps a query and a fragment, which carry the deep link', () => {
    expect(samePathOr('https://founders.coffee/a?b=1#c', '/')).toBe('/a?b=1#c');
  });

  it('refuses another origin rather than navigating to it', () => {
    expect(samePathOr('https://evil.example/steal', '/')).toBe('/');
  });

  it('refuses a protocol-relative URL, which is another origin in disguise', () => {
    expect(samePathOr('//evil.example/steal', '/')).toBe('/');
  });

  it('refuses a javascript: URL', () => {
    expect(samePathOr('javascript:alert(1)', '/')).toBe('/');
  });

  it('falls back when there is nothing to read', () => {
    expect(samePathOr(null, '/')).toBe('/');
  });
});
