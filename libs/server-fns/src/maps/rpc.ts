import { createServerFn } from '@tanstack/react-start';

import { appValidator, handleResult } from '@founders-coffee/core';
import { venues as venuesDomain } from '@founders-coffee/domain';

import { rateLimit } from '../rate-limit.js';
import type { HostMapContext, VenueCandidate } from './provider.js';
import { MAP_RATE_LIMITS, type RateLimitPolicy } from './rate-limits.js';
import {
  getHostMapContextResolver,
  reverseEventVenueResolver,
  searchEventVenuesResolver,
} from './resolver.js';
import { getMapProvider } from './runtime.js';
import {
  hostMapContextSchema,
  venueReverseSchema,
  venueSearchSchema,
} from './schemas.js';

/**
 * Per-request limit for one map endpoint.
 *
 * The `createServerFn` chain is written out at each endpoint rather than wrapped in a factory:
 * TanStack's plugin finds the chain syntactically to split the handler into a server-only bundle,
 * and hiding `createServerFn` behind a helper leaves the whole module in the client graph — which
 * breaks the build, because `runtime.ts` imports `cloudflare:workers`. Only the middleware is
 * factored out.
 *
 * These three are anonymous by design: the host wizard is reachable without a session and only
 * requires one at submission, where `createEvent` enforces it. Leaving them anonymous keeps venue
 * browsing open to a visitor deciding whether to host, so the limit keys on `cf-connecting-ip` —
 * what `rateLimit` falls back to when no session is attached. They forward to a billed provider, so
 * an application limit is required regardless of the shared WAF rule, which sees gross volume
 * across the whole server-function surface and cannot tell a paid geocoding call from a free read.
 *
 * `MAP_RATE_LIMITS` is sized against the wizard's real behaviour rather than a round number.
 * `VenueSearch` debounces typing by 350ms and TanStack Query holds each result for 60 seconds, so
 * naming one venue costs a handful of requests and trying several costs a few dozen; `venueSearch`
 * sits well above that and still caps a scripted caller at six requests a minute. `hostMapContext`
 * is cached for thirty minutes and fetched once per city, and `venueReverse` fires only on a pin
 * drop, so both are lower. Each policy carries a distinct `action`, which keeps the token buckets
 * separate — they share the identity half of the key, so a repeated name would let one endpoint
 * spend another's budget.
 */
const limit = (policy: RateLimitPolicy) =>
  rateLimit(policy.action, policy.limit, policy.windowMs);

export const getHostMapContext = createServerFn({ strict: false })
  .middleware([limit(MAP_RATE_LIMITS.hostMapContext)])
  .validator(appValidator(hostMapContextSchema))
  .handler(async ({ data }): Promise<HostMapContext> =>
    handleResult(getHostMapContextResolver(getMapProvider(), data)),
  );

/**
 * The snapshotted venues for a city.
 *
 * No provider call and no rate limit: this reads a dataset committed to the repo, because the map
 * provider indexes almost no cafés in Algiers or Cairo and a category search there returns nothing
 * at all. It stays a server function so the wizard keeps one way of asking for data and the
 * dataset never has to be reachable as a public URL.
 */
export const listNearbyVenues = createServerFn({ strict: false })
  .validator(appValidator(hostMapContextSchema))
  .handler(async ({ data }): Promise<readonly venuesDomain.SnapshotVenue[]> =>
    venuesDomain.getCityVenues(data.marketCode, data.cityCode),
  );

export const searchEventVenues = createServerFn({ strict: false })
  .middleware([limit(MAP_RATE_LIMITS.venueSearch)])
  .validator(appValidator(venueSearchSchema))
  .handler(async ({ data }): Promise<readonly VenueCandidate[]> =>
    handleResult(searchEventVenuesResolver(getMapProvider(), data)),
  );

export const reverseEventVenue = createServerFn({ strict: false })
  .middleware([limit(MAP_RATE_LIMITS.venueReverse)])
  .validator(appValidator(venueReverseSchema))
  .handler(async ({ data }): Promise<VenueCandidate> =>
    handleResult(reverseEventVenueResolver(getMapProvider(), data)),
  );
