import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

import { mapboxCspWorker } from './vite-mapbox-worker';
import { isSeoPrerenderPath, seoPrerenderPages } from './src/lib/seo-prerender';
import {
  CLIENT_OUT_DIR,
  precacheIgnores,
  SW_DEST,
  assertServiceWorkerEmitted,
  clientOnlyServwist,
} from './vite-service-worker';

const LOCAL_STATE_PATH = fileURLToPath(
  new URL('../../.wrangler/state', import.meta.url),
);
const MAPBOX_CSP_PATH = fileURLToPath(
  new URL('../../node_modules/mapbox-gl/dist/mapbox-gl-csp.js', import.meta.url),
);

const mapboxCspAlias: Plugin = {
  name: 'mapbox-csp-alias',
  enforce: 'pre',
  resolveId: (source, importer) =>
    source === 'mapbox-gl' && importer?.includes('@vis.gl/react-mapbox')
      ? MAPBOX_CSP_PATH
      : null,
};

const clientNodeBuiltinStubs: Plugin = {
  name: 'client-node-builtin-stubs',
  enforce: 'pre',
  // eslint-disable-next-line no-restricted-syntax
  resolveId(source) {
    if (this.environment?.name !== 'client') return null;
    const stubs: Record<string, string> = {
      'node:async_hooks': fileURLToPath(
        new URL('./src/async-hooks-stub.ts', import.meta.url),
      ),
      'node:stream/web': fileURLToPath(
        new URL('./src/stream-web-stub.ts', import.meta.url),
      ),
      'node:stream': fileURLToPath(
        new URL('./src/stream-stub.ts', import.meta.url),
      ),
    };
    return stubs[source] ?? null;
  },
};

export default defineConfig(({ command }) => ({
  server: {
    watch: {
      ignored: ['**/.osm-snapshot/**', '**/.wrangler/**', '**/dist/**'],
    },
  },
  resolve: {
    tsconfigPaths: true,
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: 'react-dom/server',
        replacement: fileURLToPath(
          new URL('./src/react-dom-server-shim.ts', import.meta.url),
        ),
        environment: 'client',
      },
      {
        find: /^zod$/,
        replacement: fileURLToPath(
          new URL('./src/zod-jitless-shim.ts', import.meta.url),
        ),
        environment: 'client',
      },
    ],
  },
  plugins: [
    cloudflare({
      viteEnvironment: { name: 'ssr' },
      persistState: { path: LOCAL_STATE_PATH },
    }),
    tailwindcss(),
    mapboxCspAlias,
    tanstackStart({
      pages: seoPrerenderPages,
      prerender: {
        enabled: true,
        crawlLinks: true,
        autoStaticPathsDiscovery: false,
        filter: isSeoPrerenderPath,
      },
      sitemap: { enabled: false },
      importProtection: {
        exclude: [/\/routes\//],
      },
    }),
    clientNodeBuiltinStubs,
    mapboxCspWorker(),
    viteReact(),
    ...clientOnlyServwist({
      swSrc: 'src/sw.ts',
      swDest: SW_DEST,
      globDirectory: CLIENT_OUT_DIR,
      globIgnores: precacheIgnores(),
      injectionPoint: 'self.__SW_MANIFEST',
      rollupFormat: 'iife',
      disable: command === 'serve',
    }),
    ...(command === 'serve' ? [] : [assertServiceWorkerEmitted()]),
  ],
}));
