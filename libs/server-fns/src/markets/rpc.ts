import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { handleResult } from '@founders-coffee/core';

import { getDb } from '../db.js';
import { getMarketWithCities, listVisibleMarkets, resolveMarket } from './resolver.js';

/**
 * The `createServerFn` RPC wrappers over the db-injected resolver — the P1-001 deferred piece,
 * now unblocked by env-injection (P1-017). These are the **throw boundary**: `handleResult`
 * unwraps the domain `Result` and throws the typed `AppError` on failure so TanStack Query (and
 * route loaders) enter their error state automatically (AGENTS §7, §11.5). `strict: false` because
 * `Market.brandOverrides` is a JSON column typed `Record<string, unknown>` — runtime-serializable,
 * but not provably so to TS (zod still validates inputs at runtime). Global `requestContextMiddleware`
 * (registered in each app's `src/start.ts`) runs for every fn.
 */
export const getMarket = createServerFn({ strict: false })
  .validator(z.object({ code: z.string().optional(), slug: z.string().optional() }))
  .handler(async ({ data }) => handleResult(resolveMarket(getDb(), data)));

export const getMarketCities = createServerFn({ strict: false })
  .validator(z.object({ code: z.string() }))
  .handler(async ({ data }) => handleResult(getMarketWithCities(getDb(), data.code)));

export const getVisibleMarkets = createServerFn({ strict: false }).handler(async () =>
  listVisibleMarkets(getDb()),
);
