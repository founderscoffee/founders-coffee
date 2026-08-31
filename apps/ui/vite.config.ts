import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { serwist } from '@serwist/vite';

/* Isomorphic meta-framework code statically imports Node built-ins whose server-side branches never
   run in the browser — better-auth core + the observability server logger pull `AsyncLocalStorage`
   (`node:async_hooks`), and TanStack Start's streaming-SSR module pulls `ReadableStream`
   (`node:stream/web`) + `Readable` (`node:stream`). In the client env Vite externalizes Node
   built-ins and throws on the named-import binding; these stubs let the imports resolve. SSR/Workerd
   must keep the REAL built-ins — e.g. @cloudflare/vite-plugin's runner worker does `new Writable(...)`
   from `node:stream`, so a global alias would throw "Writable is not a constructor".

   `resolve.alias` entries silently ignore an `environment` field (that's @rollup/plugin-alias, which
   only honors `{ find, replacement }`), so per-env scoping MUST happen here via the Vite 6+
   Environment API (`this.environment.name`). Exact-match avoids `node:stream` catching `node:stream/web`. */
const clientNodeBuiltinStubs: Plugin = {
  name: 'client-node-builtin-stubs',
  enforce: 'pre',
  /* Method (not arrow) on purpose: Vite calls this hook with `this` = PluginContext, which
     exposes `this.environment`. An arrow would capture module scope and lose the binding. */
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
  resolve: {
    tsconfigPaths: true,
    /* Force a single React copy — TanStack's autoCodeSplitting puts each route `component` in a
       separate chunk (?tsr-split=component); without dedupe the split chunk can resolve `react` to
       a different instance than `react-dom` → null dispatcher → "Invalid hook call". */
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        /* TanStack Router issue #7412 — React 19's `react-dom/server.browser.js` has no default
           export, but `renderRouterToString` does `import ReactDOMServer from 'react-dom/server'`.
           In the client environment Vite resolves that to server.browser.js and the default import
           is undefined → "doesn't provide an export named: 'default'". The shim re-exports the
           namespace as default. The `environment` field here is ignored (see comment above), so the
           shim applies to every env — harmless, since the re-exported namespace resolves fine in
           Workerd too. */
        find: 'react-dom/server',
        replacement: fileURLToPath(
          new URL('./src/react-dom-server-shim.ts', import.meta.url),
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
    /* Resolution-intercepting plugins come AFTER `tanstackStart()` — TanStack/router#6770 showed
       that resolvers preceding the TanStack plugin can disrupt Import Protection's module-graph
       analysis. Our `enforce: 'pre'` still guarantees we intercept `node:` specifiers before Vite
       externalizes them; the array position just lets TanStack's analysis run first. */
    clientNodeBuiltinStubs,
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
