export interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'add';
  format?: 'avif' | 'webp' | 'jpeg' | 'png';
}

export interface ImageProvider {
  fetch(key: string, options?: ImageTransformOptions): Promise<Response>;
}

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
