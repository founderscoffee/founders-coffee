import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'docs/design/profile',
  plugins: [tailwindcss()],
  server: { host: '127.0.0.1', port: 4174, strictPort: true },
  build: { outDir: '../../../dist/profile-design', emptyOutDir: true },
});
