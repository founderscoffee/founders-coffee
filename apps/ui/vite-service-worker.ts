import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { serwist } from '@serwist/vite';
import type { Plugin } from 'vite';

export const CLIENT_OUT_DIR = 'dist/client';

export const SW_DEST = 'sw.js';

/**
 * What the worker must not download before anyone asks for it.
 *
 * Serwist precaches every js, css and html file it finds, which on this build is 5.5 MB — and 4 MB
 * of that is Mapbox: the library, its CSP variant and its worker. A member who opens the home page
 * on mobile data would pay for the map bundle whether or not they ever host an event, in a market
 * where that data is metered and not cheap. Excluding it costs the map a cold load on the one screen
 * that needs it, and those chunks are content-hashed under `/assets` with a year of immutable
 * caching, so that load happens once per release rather than once per visit.
 */
export const precacheIgnores = (): string[] => ['**/mapbox-gl*'];

/**
 * Serwist, pinned to the client build.
 *
 * `@serwist/vite` keeps a single `viteConfig` and overwrites it on every `configResolved`. Under the
 * Vite environments API this app resolves three of them — the shared config, `client`, then `ssr` —
 * so the plugin ends up holding the SSR one, whose `build.ssr` is `true`. Its `closeBundle` guard is
 * `if (!ctx.viteConfig.build.ssr)`, which then refuses to generate anything, and its `swDest` would
 * have resolved under `dist/server` even if it had.
 *
 * That is why `/sw.js` has always been a 404 in production: not a missing worker — `src/sw.ts` is
 * complete and handles `push` — but a worker the build silently declined to write, with no error and
 * a successful exit code.
 *
 * Dropping the SSR pass leaves the plugin holding the client config, so the guard passes and
 * `swDest` lands in `dist/client`. This wraps the documented `configResolved` hook rather than
 * reaching into the plugin, so a Serwist upgrade that fixes the underlying behaviour makes this a
 * no-op instead of a breakage.
 */
export const clientOnlyServwist = (
  options: Parameters<typeof serwist>[0],
): Plugin[] =>
  serwist(options).map((plugin) => {
    const onConfig = plugin.configResolved;
    const onClose = plugin.closeBundle;
    return {
      ...plugin,
      ...(typeof onConfig === 'function'
        ? {
            // eslint-disable-next-line no-restricted-syntax
            configResolved(config, ...rest) {
              if (config.build.ssr) return undefined;
              return Reflect.apply(onConfig, this, [config, ...rest]);
            },
          }
        : {}),
      ...(onClose && typeof onClose === 'object' && 'handler' in onClose
        ? {
            closeBundle: {
              ...onClose,
              // eslint-disable-next-line no-restricted-syntax
              handler(...rest) {
                if (this.environment?.name !== 'client') return undefined;
                return Reflect.apply(onClose.handler, this, rest);
              },
            },
          }
        : {}),
    } as Plugin;
  });

/**
 * Fail the build when the service worker is missing from the client output.
 *
 * The defect this guards against produced no error, no warning and a green build; it was found by
 * curling production months later. Every path that ships runs `vite build` — CI, `deploy:staging`,
 * `deploy:production` — so asserting here covers all of them, and none of them would otherwise
 * notice that push notifications and offline caching had quietly become inert.
 *
 * Scoped to the client environment because that is the only one that emits the worker, and because
 * the SSR bundle closes after it: asserting on both would be checking the same file twice.
 */
export const assertServiceWorkerEmitted = (): Plugin => ({
  name: 'assert-service-worker-emitted',
  enforce: 'post',
  apply: 'build',
  closeBundle: {
    sequential: true,
    order: 'post',
    // eslint-disable-next-line no-restricted-syntax
    handler() {
      if (this.environment?.name !== 'client') return;
      const built = fileURLToPath(
        new URL(`./${CLIENT_OUT_DIR}/${SW_DEST}`, import.meta.url),
      );
      if (!existsSync(built))
        throw new Error(
          `Service worker missing from the client build: ${CLIENT_OUT_DIR}/${SW_DEST}. ` +
            'Push notifications and offline caching are inert without it.',
        );
    },
  },
});
