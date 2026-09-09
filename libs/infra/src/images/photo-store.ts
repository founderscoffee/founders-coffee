export interface StoredPhoto {
  readonly body: ReadableStream;
  readonly contentType: string;
  readonly etag: string;
}

export interface PhotoStore {
  put(
    key: string,
    body: ArrayBuffer | Uint8Array,
    contentType: string,
  ): Promise<void>;
  get(key: string): Promise<StoredPhoto | null>;
  deletePrefix(prefix: string): Promise<number>;
}

export class R2PhotoStore implements PhotoStore {
  constructor(private readonly bucket: R2Bucket) {}

  /**
   * Write bytes into the private bucket under an opaque key.
   *
   * Nothing in this class builds a URL. The bucket is reached only through the binding, so there is
   * no address a member could be handed that outlives the publication check in front of it — which
   * is the whole reason originals are not simply served from R2 with a public domain attached.
   */
  put = async (
    key: string,
    body: ArrayBuffer | Uint8Array,
    contentType: string,
  ): Promise<void> => {
    await this.bucket.put(key, body, {
      httpMetadata: { contentType },
    });
  };

  get = async (key: string): Promise<StoredPhoto | null> => {
    const object = await this.bucket.get(key);
    if (!object) return null;
    return {
      body: object.body,
      contentType:
        object.httpMetadata?.contentType ?? 'application/octet-stream',
      etag: object.httpEtag,
    };
  };

  /**
   * Remove every object under a prefix, which is how a withdrawal stays complete.
   *
   * Deleting a list of variant names would go stale the first time a size is added; deleting the
   * prefix removes whatever is actually there, including an original left behind by a run that
   * failed between writing it and writing its variants.
   */
  deletePrefix = async (prefix: string): Promise<number> => {
    let removed = 0;
    let cursor: string | undefined;
    do {
      const page = await this.bucket.list({ prefix, cursor, limit: 100 });
      const keys = page.objects.map((object) => object.key);
      if (keys.length > 0) {
        await this.bucket.delete(keys);
        removed += keys.length;
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return removed;
  };
}
