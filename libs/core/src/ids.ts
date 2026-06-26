/**
 * Opaque, prefixed id factory (AGENTS.md §6: consistent id format).
 * e.g. `id('evt')` -> `evt_8f3b...` (hex from Web Crypto UUID).
 *
 * Uses Web Crypto (`crypto.randomUUID`), available in both Cloudflare Workers and Node 19+.
 */
export function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}
