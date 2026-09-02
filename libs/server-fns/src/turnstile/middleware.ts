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
 *
 * `requireWaf` is deliberately not the default. It gates on the account-side rule EC-06 owns, which
 * protects event creation specifically; applying it everywhere would take unrelated endpoints down
 * until that one rule is configured.
 */
const requireTurnstile = (
  expectedAction: TurnstileAction,
  options: { requireWaf?: boolean } = {},
) =>
  createMiddleware({ type: 'function' })
    .validator(appValidator(protectedRequestSchema))
    .server(async ({ data, next }) => {
      const runtimeEnv = env as TurnstileRuntimeEnv;
      if (options.requireWaf) {
        await handleResult(Promise.resolve(requireEventCreateWaf(runtimeEnv)));
      }
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

export const requireEventCreateTurnstile = requireTurnstile(
  TURNSTILE_ACTIONS.createEvent,
  { requireWaf: true },
);

export const requireWaitlistTurnstile = requireTurnstile(
  TURNSTILE_ACTIONS.joinWaitlist,
);
