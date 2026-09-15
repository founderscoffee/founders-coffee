import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { appValidator, handleResult } from '@founders-coffee/core';

import { TURNSTILE_ACTIONS, type TurnstileAction } from './actions.js';
import { type TurnstileVerificationInput } from './provider.js';
import {
  requireEventCreateWaf,
  resolveTurnstileProvider,
  type TurnstileRuntimeEnv,
} from './runtime.js';

const protectedRequestSchema = z
  .object({ turnstileToken: z.string().trim().max(2_048).optional() })
  .passthrough();

/**
 * Require a Turnstile response issued for `expectedAction`.
 *
 * The action is pinned per endpoint so a response minted on one form cannot be replayed against
 * another — a widget on the waitlist form must not buy a caller an event creation. `remoteip` is
 * forwarded from `cf-connecting-ip` (AGENTS.md §11.5), and `resolveTurnstileProvider` fails closed
 * outside local development when no secret is configured, so a missing secret is an outage rather
 * than an open door.
 */
const requireTurnstile = (expectedAction: TurnstileAction) =>
  createMiddleware({ type: 'function' })
    .validator(appValidator(protectedRequestSchema))
    .server(async ({ data, next }) => {
      const runtimeEnv = env as TurnstileRuntimeEnv;
      const provider = await handleResult(
        Promise.resolve(resolveTurnstileProvider(runtimeEnv)),
      );
      const input: TurnstileVerificationInput = {
        token: data.turnstileToken,
        remoteIp: getRequestHeader('cf-connecting-ip'),
        expectedAction,
      };
      await handleResult(provider.verify(input));
      return next();
    });

/**
 * Refuse event creation until the account-side rate-limit rule EC-06 owns is in place.
 *
 * This is the edge control, not the challenge: it gates on `EVENT_CREATE_WAF_CONFIGURED` and has
 * nothing to say about who the caller is. It is applied to event creation alone, because applying
 * it everywhere would take unrelated endpoints down until that one rule is configured.
 *
 * It lives beside the Turnstile middleware because it shares that module's runtime environment
 * shape, and it is exported separately so removing the challenge from a flow cannot silently
 * remove the edge rule with it.
 */
export const requireEventCreateWafRule = createMiddleware({
  type: 'function',
}).server(async ({ next }) => {
  await handleResult(
    Promise.resolve(requireEventCreateWaf(env as TurnstileRuntimeEnv)),
  );
  return next();
});

export const requireWaitlistTurnstile = requireTurnstile(
  TURNSTILE_ACTIONS.joinWaitlist,
);

export const requireProfileTurnstile = requireTurnstile(
  TURNSTILE_ACTIONS.updateProfile,
);

export const requireFeedbackTurnstile = requireTurnstile(
  TURNSTILE_ACTIONS.submitFeedback,
);
