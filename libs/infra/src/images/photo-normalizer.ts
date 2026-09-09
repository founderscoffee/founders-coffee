export interface PhotoDescription {
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
}

export interface NormalizedPhoto {
  readonly bytes: ArrayBuffer;
  readonly contentType: string;
}

export interface PhotoNormalizer {
  describe(bytes: Uint8Array): Promise<PhotoDescription | null>;
  square(bytes: Uint8Array, pixels: number): Promise<NormalizedPhoto>;
}

const stream = (bytes: Uint8Array): ReadableStream<Uint8Array> =>
  new Response(bytes).body as ReadableStream<Uint8Array>;

export class CloudflareImagesNormalizer implements PhotoNormalizer {
  constructor(
    private readonly images: ImagesBinding,
    private readonly outputFormat: 'image/webp' = 'image/webp',
  ) {}

  /** Ask the decoder what this actually is; `null` when it will not decode as a raster image. */
  describe = async (bytes: Uint8Array): Promise<PhotoDescription | null> => {
    try {
      const info = await this.images.info(stream(bytes));
      if (!('width' in info)) return null;
      return {
        format: info.format,
        width: info.width,
        height: info.height,
        byteSize: info.fileSize,
      };
    } catch {
      return null;
    }
  };

  /**
   * One square variant, decoded, cropped and re-encoded through the Images binding.
   *
   * The binding takes raw bytes rather than a URL, which is what lets the bucket stay private: the
   * URL form of image transformation needs a publicly fetchable source, and a public bucket has no
   * publication check in front of it. Transformations are counted once per unique source and
   * parameters per calendar month, so this runs at upload and never per view — on a read it would
   * reset that count monthly and scale it with cache misses instead of with what members do.
   *
   * The re-encode is also the metadata removal step: a WebP written out of a decoded bitmap carries
   * no EXIF and therefore no GPS coordinates from the phone that took the picture, so there is no
   * separate stripping pass to forget to run.
   *
   * The crop is `cover` rather than a pad. Every surface that shows a member is a circle, so a
   * letterboxed portrait would render as a face between two bars; filling the frame loses the edges,
   * which is the right loss for an avatar.
   */
  square = async (
    bytes: Uint8Array,
    pixels: number,
  ): Promise<NormalizedPhoto> => {
    const result = await this.images
      .input(stream(bytes))
      .transform({
        width: pixels,
        height: pixels,
        fit: 'cover',
        gravity: 'auto',
      })
      .output({ format: this.outputFormat, quality: 82 });
    return {
      bytes: await new Response(result.image()).arrayBuffer(),
      contentType: result.contentType(),
    };
  };
}
