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

/**
 * The half of a prefixed id that travels in a URL.
 *
 * Shared links carry `/e/8f3b...` rather than `/e/evt_8f3b...`: the prefix is the same for every
 * event, so it is noise in an address a person is meant to paste into a message. Both halves live
 * here as a pair because the trip has to round: three separate call sites were each stripping and
 * re-adding it with their own regex, and a card URL that stripped it against a route that never put
 * it back is what sent every social card to the generic fallback image.
 */
export const shortId = (value: string): string => value.replace(/^[a-z]+_/, '');

/** Restore the prefix that `shortId` removed. */
export const prefixedId = (prefix: string, short: string): string =>
  `${prefix}_${short}`;
