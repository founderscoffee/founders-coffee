import workerUrl from 'virtual:mapbox-worker-url';

import { logger } from '@founders-coffee/observability';

export const MAPBOX_WORKER_URL = workerUrl;

const logLoadFailure = (error: unknown): void => {
  logger.warn('map.library_load_failed', {
    message: error instanceof Error ? error.message : String(error),
  });
};

/**
 * Load Mapbox GL's CSP build, which is the only one that survives our production bundle.
 *
 * The default build has no worker file. It assembles one at runtime by calling `String()` on two of
 * its own module functions and concatenating them into a blob, which is only correct while those
 * functions are self-contained. Our minifier hoists a shared helper out of them, so the blob's
 * source referenced a binding that does not exist in worker scope and every worker died with
 * `ReferenceError: n is not defined`. The map still drew, because tile work falls back to the main
 * thread, but `mapbox-gl-rtl-text` is loaded *by the workers* — so it never loaded, and Arabic map
 * labels went unshaped in an Arabic-first product. Nothing failed loudly; the only signal was one
 * console line in a production build, which is why this survived until the staged run.
 *
 * The CSP build ships the worker as a real file instead, which `vite-mapbox-worker.ts` serves
 * verbatim from our own origin. There is no blob, no stringification, and nothing for a minifier to
 * break. It also means `worker-src` no longer needs `blob:` for this path.
 *
 * The promise resolves to the module's default export rather than its namespace, because
 * `react-map-gl` writes `workerUrl` onto whatever it is handed: an ES namespace object exposes only
 * getters, so assigning to it throws `Cannot set property workerUrl` and the map never mounts.
 *
 * Returns `undefined` on the server. `react-map-gl` only awaits this inside an effect, so the
 * fallback path it would take never runs in a browser — and the guard keeps 2.3 MB of browser code
 * from being evaluated in the Worker during SSR.
 *
 * A failed download is logged here, as the warning `map.library_load_failed`, and the map still
 * draws its own failure state from the same rejection. The download starts when a map's module is
 * evaluated, and a hover's preload of a meetup page does that long before any map mounts to take
 * the rejection: on 2026-10-04 a phone on `/ar/algeria` lost the download that way, and it surfaced
 * as an unhandled error that read like a deploy's missing script.
 */
export const loadMapboxCsp = (): Promise<unknown> | undefined => {
  if (typeof window === 'undefined') return undefined;
  const loading = import('mapbox-gl/dist/mapbox-gl-csp.js').then(
    (module) => module.default,
  );
  loading.catch(logLoadFailure);
  return loading;
};
