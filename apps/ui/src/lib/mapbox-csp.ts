import workerUrl from 'virtual:mapbox-worker-url';

import { logger } from '@founders-coffee/observability';

export const MAPBOX_WORKER_URL = workerUrl;

let library: Promise<unknown> | undefined;
let isLibraryLost = false;

const logLoadFailure = (error: unknown): void => {
  isLibraryLost = true;
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
 * One download serves the page. The promise is kept, so every map that asks shares it and a
 * failure is logged once. The meetup page's map asks when it first renders rather than when its
 * module loads, because a hover or a touch on a meetup card preloads that module: measured on
 * production on 2026-10-05, a scroll that merely started on a card fetched 504 KB, 463 KB of it
 * this library, on a page with no map. Waiting cost the map about 60 ms at most, since the
 * preload only started the download a few tens of milliseconds before the meetup page rendered.
 *
 * A failed download is logged here, as the warning `map.library_load_failed`, and the map still
 * draws its own failure state from the same rejection. Nothing else may be listening when it
 * fails: the meetup page's map mounts only once its token has arrived. Before that map waited for
 * its first render, a hover started the download with no map at all: on 2026-10-04 a phone on
 * `/ar/algeria` lost it that way, and it surfaced as an unhandled error that read like a deploy's
 * missing script.
 */
export const loadMapboxCsp = (): Promise<unknown> | undefined => {
  if (typeof window === 'undefined') return undefined;
  if (library) return library;
  library = import('mapbox-gl/dist/mapbox-gl-csp.js').then(
    (module) => module.default,
  );
  library.catch(logLoadFailure);
  return library;
};

/**
 * Try a map that failed again: remount it, unless the failure was the library's own download.
 *
 * A browser keeps a module that failed to load as failed for the rest of the page. A second
 * `import()` of it rejects at once without a new request (Chromium, measured 2026-10-05), so a
 * remounted map only met the same rejection, and Retry on the host map could never succeed. Only
 * a new page load fetches the library again, so that is what Retry does then. The host loses
 * nothing to it: the wizard, a repeat included, and the edit page keep what the host typed for the
 * tab and put it back on load.
 */
export const retryMap = (remount: () => void): void => {
  if (isLibraryLost) {
    window.location.reload();
    return;
  }
  remount();
};
