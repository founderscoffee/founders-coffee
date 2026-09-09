import { afterEach, describe, expect, it, vi } from 'vitest';

import { putProfilePhoto } from './photo-upload';

const respond = (status: number, body?: unknown) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(body === undefined ? null : JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );
};

const png = () => new Blob([new Uint8Array([1])], { type: 'image/png' });

afterEach(() => vi.unstubAllGlobals());

describe('sending a photo', () => {
  it('puts the bytes at the reserved key with their own content type', async () => {
    respond(201, { assetId: 'pha_1' });

    expect(await putProfilePhoto('pha_1', png())).toEqual({ ok: true });
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe('/api/profile/photo/pha_1');
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'image/png',
    );
  });

  it('carries the server’s own code back to the caller', async () => {
    respond(415, { code: 'photo_unsupported' });

    expect(await putProfilePhoto('pha_1', png())).toEqual({
      ok: false,
      error: { code: 'photo_unsupported' },
    });
  });

  it('reads a code from the status when the body carries none', async () => {
    respond(429);

    expect(await putProfilePhoto('pha_1', png())).toEqual({
      ok: false,
      error: { code: 'rate_limited' },
    });
  });

  it('has something to say about a failure it cannot name', async () => {
    respond(500, 'not json');

    expect(await putProfilePhoto('pha_1', png())).toEqual({
      ok: false,
      error: { code: 'photo_failed' },
    });
  });
});
