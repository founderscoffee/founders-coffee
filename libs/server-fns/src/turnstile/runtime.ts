import { AppError, err, ok, type Result } from '@founders-coffee/core';

import {
  createCloudflareTurnstileProvider,
  createDevTurnstileProvider,
  type TurnstileProvider,
} from './provider.js';

export interface TurnstileRuntimeEnv {
  APP_ENVIRONMENT?: string;
  APP_URL?: string;
  TURNSTILE_DISABLED?: string;
  TURNSTILE_SECRET_KEY?: string;
  EVENT_CREATE_WAF_CONFIGURED?: string;
}

export const resolveTurnstileProvider = (
  runtimeEnv: TurnstileRuntimeEnv,
): Result<TurnstileProvider> => {
  const isDevelopment = runtimeEnv.APP_ENVIRONMENT === 'development';
  if (runtimeEnv.TURNSTILE_DISABLED === 'true') {
    return isDevelopment
      ? ok(createDevTurnstileProvider())
      : err(
          new AppError(
            'security_configuration_error',
            'Bot verification is unavailable',
          ),
        );
  }

  if (!runtimeEnv.TURNSTILE_SECRET_KEY || !runtimeEnv.APP_URL) {
    return err(
      new AppError(
        'security_configuration_error',
        'Bot verification is unavailable',
      ),
    );
  }

  try {
    const expectedHostname = new URL(runtimeEnv.APP_URL).hostname;
    return ok(
      createCloudflareTurnstileProvider(
        runtimeEnv.TURNSTILE_SECRET_KEY,
        expectedHostname,
      ),
    );
  } catch {
    return err(
      new AppError(
        'security_configuration_error',
        'Bot verification is unavailable',
      ),
    );
  }
};

export const requireEventCreateWaf = (
  runtimeEnv: TurnstileRuntimeEnv,
): Result<void> =>
  runtimeEnv.APP_ENVIRONMENT === 'development' ||
  runtimeEnv.EVENT_CREATE_WAF_CONFIGURED === 'true'
    ? ok(undefined)
    : err(
        new AppError(
          'security_configuration_error',
          'Event creation is temporarily unavailable',
        ),
      );
