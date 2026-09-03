import { env } from 'cloudflare:workers';

import type { WorkerEnv } from '@founders-coffee/infra';
import { createMetrics, type Metrics } from '@founders-coffee/observability';

/**
 * The runtime environment, typed once.
 *
 * `env` from `cloudflare:workers` is `Cloudflare.Env`, which applications populate through
 * `wrangler types` and libraries cannot. Casting inline is what produced three separate untyped
 * casts across this library; the narrowing now happens here and nowhere else, against the
 * `WorkerEnv` shape `libs/infra` declares — §3 names that library as the home for the typed Env.
 *
 * `WorkerEnv` is a hand-maintained mirror of the `wrangler.jsonc` files, and deliberately optional
 * almost everywhere: a binding absent from one environment must be a value the code checks for, not
 * a type error at build time. `DB` is required because nothing here runs without it.
 *
 * Not re-exported from the package barrel on purpose: it imports `cloudflare:workers`, and anything
 * the barrel exposes joins the client module graph, which breaks the browser build.
 */
export const workerEnv = (): WorkerEnv => env as unknown as WorkerEnv;

/**
 * The Analytics Engine metrics writer, or `null` where the dataset is not bound.
 *
 * Product metrics are best-effort: a missing binding means an environment that has not been given
 * the dataset yet (local Miniflare runs, a Worker deployed before the binding landed), and callers
 * degrade instead of failing the request that produced the measurement.
 */
export const workerMetrics = (): Metrics | null => {
  const analytics = workerEnv().ANALYTICS;
  return analytics ? createMetrics(analytics) : null;
};
