/**
 * Opaque, prefixed id factory (AGENTS.md §6: consistent id format).
 * e.g. `id('evt')` -> `evt_8f3b...`
 *
 * Uses `node:crypto.randomUUID` — available in Node and in Cloudflare Workers
 * (via the `nodejs_compat` flag every Workers app enables).
 */
import { randomUUID } from 'node:crypto';

export function id(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}
