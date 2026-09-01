import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';
import { z } from 'zod';

import { appValidator, handleResult } from '@founders-coffee/core';

import { type TurnstileVerificationInput } from './provider.js';
import {
  requireEventCreateWaf,
  resolveTurnstileProvider,
  type TurnstileRuntimeEnv,
} from './runtime.js';

const protectedRequestSchema = z
  .object({ turnstileToken: z.string().trim().max(2_048).optional() })
  .passthrough();

export const requireEventCreateTurnstile = createMiddleware({
  type: 'function',
})
  .validator(appValidator(protectedRequestSchema))
  .server(async ({ data, next }) => {
    const runtimeEnv = env as TurnstileRuntimeEnv;
    await handleResult(Promise.resolve(requireEventCreateWaf(runtimeEnv)));
    const provider = await handleResult(
      Promise.resolve(resolveTurnstileProvider(runtimeEnv)),
    );
    const input: TurnstileVerificationInput = {
      token: data.turnstileToken,
      remoteIp: getRequestHeader('cf-connecting-ip'),
      expectedAction: 'create_event',
    };
    await handleResult(provider.verify(input));
    return next();
  });
