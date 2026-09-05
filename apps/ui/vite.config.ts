import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { serwist } from '@serwist/vite';

import { mapboxCspWorker } from './vite-mapbox-worker';

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
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart({
      importProtection: {
        exclude: [/\/routes\//],
      },
    }),
    clientNodeBuiltinStubs,
    mapboxCspWorker(),
    viteReact(),
    serwist({
      swSrc: 'src/sw.ts',
      swDest: 'sw.js',
      globDirectory: 'dist',
      injectionPoint: 'self.__SW_MANIFEST',
      rollupFormat: 'iife',
      disable: command === 'serve',
    }),
  ],
}));
