import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import {
  appValidator,
  handleResult,
  localeSchema,
  marketCodeSchema,
} from '@founders-coffee/core';

import { getDb } from '../db.js';
import { rateLimit } from '../rate-limit.js';
import { requireWaitlistTurnstile } from '../turnstile/middleware.js';
import { joinWaitlistResolver, type JoinWaitlistInput } from './resolver.js';

const joinWaitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  marketCode: marketCodeSchema,
  cityCode: z.string().min(1).max(50),
  locale: localeSchema,
  turnstileToken: z.string().trim().max(2_048).optional(),
});

export type JoinWaitlistRequest = z.infer<typeof joinWaitlistSchema>;

/**
 * Join a city's waitlist. Public (no session) — anonymous demand capture for empty cities.
 *
 * Anonymous, state-changing and email-collecting is the most spammable shape a write can have, so
 * this carries Turnstile as well as the IP-scoped limit. Its response is pinned to `join_waitlist`,
 * so one minted here cannot be replayed against event creation.
 *
 * `JoinWaitlistRequest` is the wire contract and is deliberately not the resolver's
 * `JoinWaitlistInput`: `turnstileToken` belongs to the request, is consumed by the middleware, and
 * never reaches the domain. The two were the same type, which is why adding one wire field became a
 * type error at every call site instead of a one-line change.
 */
export const joinWaitlist = createServerFn({ method: 'POST', strict: false })
  .middleware([
    requireWaitlistTurnstile,
    rateLimit('join_waitlist', 5, 600_000),
  ])
  .validator(appValidator(joinWaitlistSchema))
  .handler(async ({ data }) =>
    handleResult(
      joinWaitlistResolver(getDb(), {
        email: data.email,
        marketCode: data.marketCode,
        cityCode: data.cityCode,
        locale: data.locale,
      } as JoinWaitlistInput),
    ),
  );
