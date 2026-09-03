import { z } from 'zod';

/**
 * Turn off Zod's JIT schema compilation for this runtime.
 *
 * Zod 4 compiles hot validators with the `Function` constructor and decides whether it may by
 * probing `Function('')` inside a `try`. Under a Content-Security-Policy without `'unsafe-eval'`
 * that probe throws, Zod silently falls back to the interpreted path — and the browser reports a
 * CSP violation on every page load, because a blocked `eval` is a violation whether or not the
 * caller handles it.
 *
 * Declaring `jitless` up front skips the probe entirely. Nothing is lost: the JIT path was never
 * going to be available in a browser this policy protects, and the Workers runtime already
 * disables it by user-agent. Call this before the first `parse`, not merely before the first
 * schema is constructed — the probe is memoized on first use.
 */
export const configureZodRuntime = (): void => {
  z.config({ jitless: true });
};
