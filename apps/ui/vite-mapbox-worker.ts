import { createReadStream, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);

const WORKER_FILE = require.resolve('mapbox-gl/dist/mapbox-gl-csp-worker.js');

const VERSION = (require('mapbox-gl/package.json') as { version: string })
  .version;

const WORKER_PATH = `/mapbox-gl-csp-worker-${VERSION}.js`;

const VIRTUAL_ID = 'virtual:mapbox-worker-url';

const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * Serve Mapbox GL's CSP worker as a plain script at one stable URL, in dev and in the build.
 *
 * The worker cannot go through Vite's JavaScript pipeline. It is a classic worker, so the browser
 * refuses a module in it, and both of Vite's ordinary routes hand it one: `?url` in dev resolves to
 * a path the transform middleware rewrites to ESM (`Cannot use import statement outside a module`),
 * and marking it an asset still leaves the dev server appending an export (`Unexpected token
 * 'export'`). Only bytes served verbatim work, which is what the middleware and the emitted asset
 * do here.
 *
 * The URL reaches the application through a virtual module rather than a shared constant, because
 * the filename carries the installed `mapbox-gl` version: an upgrade changes the URL, so no visitor
 * can be served a cached worker from the previous version against a new library. Copying the file
 * into `public/` would have worked too, at the cost of a megabyte of vendored code in the tree that
 * silently goes stale on every upgrade.
 */
export const mapboxCspWorker = (): Plugin => ({
  name: 'mapbox-csp-worker',
  resolveId: (source) => (source === VIRTUAL_ID ? RESOLVED_ID : null),
  load: (id) =>
    id === RESOLVED_ID
      ? `export default ${JSON.stringify(WORKER_PATH)};`
      : null,
  configureServer: (server) => {
    server.middlewares.use(WORKER_PATH, (_request, response) => {
      response.setHeader('content-type', 'text/javascript');
      createReadStream(WORKER_FILE).pipe(response);
    });
  },
  // eslint-disable-next-line no-restricted-syntax
  generateBundle() {
    if (this.environment?.name !== 'client') return;
    this.emitFile({
      type: 'asset',
      fileName: WORKER_PATH.slice(1),
      source: readFileSync(WORKER_FILE),
    });
  },
});
