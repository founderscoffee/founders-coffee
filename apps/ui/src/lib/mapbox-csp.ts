import workerUrl from 'virtual:mapbox-worker-url';

export const MAPBOX_WORKER_URL = workerUrl;

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
 */
export const loadMapboxCsp = (): Promise<unknown> | undefined =>
  typeof window === 'undefined'
    ? undefined
    : import('mapbox-gl/dist/mapbox-gl-csp.js').then(
        (module) => module.default,
      );
