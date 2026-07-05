/**
 * Opaque, prefixed id factory (AGENTS.md §6: consistent id format).
 * e.g. `id('evt')` -> `evt_8f3b...`
 *
 * Uses the Web Crypto API (`globalThis.crypto.randomUUID`) — universally available in browsers,
 * Node 19+, and Cloudflare Workers. Avoids `node:crypto` so the module is safe to import from
 * client code without Vite externalizing a Node built-in.
 */
export const id = (prefix: string): string =>
  `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, '')}`;
