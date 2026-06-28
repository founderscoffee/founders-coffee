import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    /* Force a single React copy — TanStack's autoCodeSplitting puts each route `component` in a
       separate chunk (?tsr-split=component); without dedupe the split chunk can resolve `react` to
       a different instance than `react-dom` → null dispatcher → "Invalid hook call". */
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
