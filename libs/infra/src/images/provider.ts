/** Optional image transform. The dev adapter ignores it (raw bytes); a
 *  transform-capable (Cloudflare Images) adapter applies it. */
export interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'add';
  format?: 'avif' | 'webp' | 'jpeg' | 'png';
}

/** Serves an image by storage key. Implementations: dev (raw R2 bytes) now,
 *  prod (Cloudflare Images transforms) lands with uploads (P1). */
export interface ImageProvider {
  fetch(key: string, options?: ImageTransformOptions): Promise<Response>;
}

/**
 * Dev/local image adapter (AGENTS.md §11.7): serves the raw bytes stored in R2,
 * with no transform — for local dev where the Cloudflare Images binding isn't
 * available. Real against the R2 binding (Miniflare in tests, provisioned R2 in
 * P0-019); never a mock. The transform-capable prod adapter ships behind the
 * same interface with uploads (P1).
 */
export class R2ImageProvider implements ImageProvider {
  constructor(private readonly bucket: R2Bucket) {}

  fetch = async (key: string): Promise<Response> => {
    const object = await this.bucket.get(key);
    if (!object) return new Response('Not Found', { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    return new Response(object.body, { headers });
  };
}
