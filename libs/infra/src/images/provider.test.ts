import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { R2ImageProvider } from './provider.js';

describe('R2ImageProvider (real Miniflare R2)', () => {
  it('serves stored bytes with content-type + cache headers', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    await env.IMAGES_BUCKET.put('logos/main.png', bytes, {
      httpMetadata: { contentType: 'image/png' },
    });

    const res = await new R2ImageProvider(env.IMAGES_BUCKET).fetch(
      'logos/main.png',
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('max-age=31536000');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it('returns 404 for a missing key', async () => {
    const res = await new R2ImageProvider(env.IMAGES_BUCKET).fetch(
      'does/not/exist.png',
    );
    expect(res.status).toBe(404);
  });
});
