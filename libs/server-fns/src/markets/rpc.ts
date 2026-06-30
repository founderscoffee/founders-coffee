import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { handleResult } from '@founders-coffee/core';

import { getDb } from '../db.js';
import {
  listVisibleMarkets,
  resolveCityLanding,
  resolveMarket,
  resolveMarketLanding,
} from './resolver.js';

/**
 * The `createServerFn` RPC wrappers over the db-injected resolver. These are the **throw boundary**:
 * `handleResult` unwraps the domain `Result` and throws the typed `AppError` on failure so TanStack
 * Query (and route loaders) enter their error state automatically (AGENTS §7, §11.5). `strict: false`
 * because `Market.brandOverrides` is a JSON column typed `Record<string, unknown>` — runtime-
 * serializable, but not provably so to TS (zod still validates inputs at runtime).
 */
export const getMarket = createServerFn({ strict: false })
  .validator(z.object({ code: z.string().optional(), slug: z.string().optional() }))
  .handler(async ({ data }) => handleResult(resolveMarket(getDb(), data)));

export const getVisibleMarkets = createServerFn({ strict: false }).handler(async () =>
  listVisibleMarkets(getDb()),
);

/** Country-landing data (market + featured cities from TS geo data) by slug-or-code. */
export const getMarketLanding = createServerFn({ strict: false })
  .validator(z.object({ key: z.string() }))
  .handler(async ({ data }) => handleResult(resolveMarketLanding(getDb(), data.key)));

/** City-landing data (market + city) by market key + city slug. City validated from geo TS data. */
export const getCityLanding = createServerFn({ strict: false })
  .validator(z.object({ marketKey: z.string(), citySlug: z.string() }))
  .handler(async ({ data }) => handleResult(resolveCityLanding(getDb(), data)));
