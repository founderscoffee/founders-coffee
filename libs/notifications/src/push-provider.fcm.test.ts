import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FcmPushProvider } from './push-provider.js';

let serviceAccountJson: string;

const pemFrom = (pkcs8: ArrayBuffer): string => {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
  return `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;
};

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  serviceAccountJson = JSON.stringify({
    project_id: 'founders-test',
    client_email: 'sender@founders-test.iam.gserviceaccount.com',
    private_key: pemFrom(
      await crypto.subtle.exportKey('pkcs8', pair.privateKey),
    ),
  });
});

const provider = () =>
  new FcmPushProvider({ projectId: 'founders-test', serviceAccountJson });

const args = {
  token: 'device-token',
  title: 'Tomorrow',
  body: 'Coffee + code, 18:00',
  url: 'https://founders.coffee/algeria/e/coffee-and-code',
  icon: '/android-chrome-192x192.png',
  dedupeKey: 'ntf_01HZ',
};

const okJson = (value: unknown) =>
  new Response(JSON.stringify(value), { status: 200 });

const calls = () => vi.mocked(globalThis.fetch).mock.calls;

const bodyOf = (index: number): Record<string, string> => {
  const init = calls()[index]?.[1] as RequestInit;
  return Object.fromEntries(new URLSearchParams(String(init.body)));
};

const messageOf = (index: number): Record<string, never> => {
  const init = calls()[index]?.[1] as RequestInit;
  return (JSON.parse(String(init.body)) as { message: Record<string, never> })
    .message;
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        okJson({ access_token: 'ya29.access', expires_in: 3600 }),
      )
      .mockResolvedValue(okJson({ name: 'projects/founders-test/messages/1' })),
  );
});

describe('FcmPushProvider authentication', () => {
  it('exchanges the signed assertion for an access token before sending', async () => {
    await provider().send(args);

    expect(calls()[0]?.[0]).toBe('https://oauth2.googleapis.com/token');
    expect(bodyOf(0).grant_type).toBe(
      'urn:ietf:params:oauth:grant-type:jwt-bearer',
    );
    expect(bodyOf(0).assertion.split('.')).toHaveLength(3);
  });

  it('sends the access token, never the assertion it was minted from', async () => {
    await provider().send(args);

    const headers = (calls()[1]?.[1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe('Bearer ya29.access');
    expect(headers.Authorization).not.toContain(bodyOf(0).assertion);
  });

  it('reuses the token across sends rather than exchanging every time', async () => {
    const fcm = provider();
    await fcm.send(args);
    await fcm.send(args);

    expect(
      calls().filter(
        (call) => call[0] === 'https://oauth2.googleapis.com/token',
      ),
    ).toHaveLength(1);
  });

  it('fails transiently and sends nothing when the exchange is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('nope', { status: 401 })),
    );

    const result = await provider().send(args);

    expect(result.ok).toBe(false);
    expect(calls()).toHaveLength(1);
  });
});

describe('the message FCM is asked to deliver', () => {
  it('carries the payload as data, so our own worker can read it', async () => {
    await provider().send(args);
    const webpush = messageOf(1).webpush as unknown as {
      data: Record<string, string>;
      notification?: unknown;
      headers?: Record<string, string>;
    };

    expect(webpush.notification).toBeUndefined();
    expect(webpush.data).toEqual({
      title: 'Tomorrow',
      body: 'Coffee + code, 18:00',
      url: 'https://founders.coffee/algeria/e/coffee-and-code',
      icon: '/android-chrome-192x192.png',
      dedupeKey: 'ntf_01HZ',
    });
  });

  it('carries the event URL, which decides where a tap lands', async () => {
    await provider().send(args);

    expect(
      (messageOf(1).webpush as unknown as { data: { url: string } }).data.url,
    ).toContain('/algeria/e/coffee-and-code');
  });

  it('falls back to the site root when no URL was given', async () => {
    await provider().send({ ...args, url: undefined });

    expect(
      (messageOf(1).webpush as unknown as { data: { url: string } }).data.url,
    ).toBe('/');
  });

  it('collapses a redelivery onto one topic', async () => {
    await provider().send(args);

    expect(
      (messageOf(1).webpush as unknown as { headers: { Topic: string } })
        .headers.Topic,
    ).toBe('ntf_01HZ');
  });
});
