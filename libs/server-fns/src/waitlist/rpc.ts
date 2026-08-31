import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import {
  appValidator,
  handleResult,
  marketCodeSchema,
} from '@founders-coffee/core';

import { getDb } from '../db.js';
import { rateLimit } from '../rate-limit.js';
import { joinWaitlistResolver, type JoinWaitlistInput } from './resolver.js';

const joinWaitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  marketCode: marketCodeSchema,
  cityCode: z.string().min(1).max(50),
  locale: z.enum(['ar', 'en', 'fr']),
});

/**
 * Join a city's waitlist. Public (no session) — anonymous demand capture for empty cities.
 *
 * Bot protection: Turnstile verification should be added at the form layer (Phase 5) and verified
 * here once the server-fn Turnstile middleware lands (currently Phase 7 of events-system-plan).
 * For now the validator + D1 UNIQUE constraint provide the basic guardrails.
 */
export const joinWaitlist = createServerFn({ strict: false })
  .middleware([rateLimit('join_waitlist', 5, 600_000)])
  .validator(appValidator(joinWaitlistSchema))
  .handler(async ({ data }) =>
    handleResult(joinWaitlistResolver(getDb(), data as JoinWaitlistInput)),
  );
