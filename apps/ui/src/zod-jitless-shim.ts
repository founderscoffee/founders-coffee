import { config } from 'zod/v4';

/**
 * Stand in for `zod` in the browser bundle, with JIT schema compilation already turned off.
 *
 * Zod 4 compiles a fast validator for object schemas with the `Function` constructor, and decides
 * whether it may by probing `new Function('')` inside a `try`. Under a Content-Security-Policy
 * without `'unsafe-eval'` that probe throws, Zod quietly falls back to the interpreted path — and
 * the browser reports a `securitypolicyviolation` on every page load anyway, because a blocked
 * `eval` is a violation whether or not the caller handles it. It was the only distinct violation
 * left across twelve staging loads, so it is the last thing standing between us and
 * `CSP_ENFORCED=true`.
 *
 * `config({ jitless: true })` skips the probe, but only if it runs before the *first* object schema
 * is constructed: `$ZodObjectJIT` reads `globalConfig.jitless` and the memoized `allowsEval` at
 * construction time, not at first parse. Calling it from an entry module cannot win that race —
 * ES imports evaluate before any statement in the module importing them, and once the app is
 * chunked, whichever chunk holds the first `z.object()` may load first. Three attempts to place the
 * call earlier all lost that race, one of them only in the production build.
 *
 * So the configuration is made a *dependency* of every `zod` import rather than a statement racing
 * them: `vite.config.ts` aliases bare `zod` to this module for the client environment only. Every
 * importer now evaluates this module first, and this module has already set `jitless` by the time
 * its own consumers run. Nothing is lost — the JIT path was never available in a browser this
 * policy protects.
 *
 * The alias is client-only, so the server keeps Zod's own default; the Workers runtime already
 * disables the JIT by user-agent. The re-exports come from `zod/v4`, which is the same module graph
 * as bare `zod` but a specifier the alias does not match, so this module cannot resolve to itself.
 */
const disableJitCompilation = (): void => {
  config({ jitless: true });
};

disableJitCompilation();

export * from 'zod/v4';
export { default } from 'zod/v4';
