import {
  CloudflareImagesNormalizer,
  R2PhotoStore,
} from '@founders-coffee/infra';

import { workerEnv } from '../env.js';
import type { PhotoServices } from './photo.js';

/**
 * The photo pipeline, or nothing where the environment has not been given one.
 *
 * Both bindings are declared optional in `WorkerEnv` and both are required here: a bucket without a
 * transformer would store an untouched original with its EXIF intact, and a transformer without a
 * bucket has nowhere to put what it produced. Returning `null` rather than throwing is what lets
 * the client ask whether uploads exist at all — the plan's rule is that no upload control ships
 * before the real provider works, and a control that is simply absent is how that reads on screen.
 */
export const photoServices = (): PhotoServices | null => {
  const env = workerEnv();
  if (!env.PROFILE_ASSETS || !env.IMAGES) return null;
  return {
    store: new R2PhotoStore(env.PROFILE_ASSETS),
    normalizer: new CloudflareImagesNormalizer(env.IMAGES),
  };
};
