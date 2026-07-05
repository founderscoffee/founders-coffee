import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { fileURLToPath } from 'node:url'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { serwist } from '@serwist/vite'

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
           namespace as default. Only applied in the client environment (SSR/Workerd imports
           react-dom/server fine). */
        find: 'react-dom/server',
        replacement: fileURLToPath(new URL('./src/react-dom-server-shim.ts', import.meta.url)),
        environment: 'client',
      },
      {
        /* Isomorphic libs (better-auth core, observability server logger) import `AsyncLocalStorage`
           for SERVER request context; their browser code never uses it. Vite externalizes the Node
           built-in and throws on access — stub it for the client env so the import resolves without
           pulling Node into the browser bundle. SSR keeps the real `node:async_hooks`. */
        find: 'node:async_hooks',
        replacement: fileURLToPath(new URL('./src/async-hooks-stub.ts', import.meta.url)),
        environment: 'client',
      },
    ],
  },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart({
      importProtection: {
        exclude: [/\/routes\//],
      },
    }),
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
}))
