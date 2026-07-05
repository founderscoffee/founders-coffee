import { AppError } from '@founders-coffee/core';

import { logger } from './logger.js';
import type { LogContext, Logger } from './types.js';

const isError = (value: unknown): value is Error =>
  typeof value === 'object' && value !== null && value instanceof Error;

/**
 * Normalize any thrown value into a structured entry and log it at `error`. Wireable into TanStack
 * Start `onError`, route error boundaries, `queryClient.onError`, and `unhandledrejection`. Reuses
 * `AppError.code` when present so stable codes surface in logs. Defaults to the isomorphic `logger`
 * singleton (server or client per context) — never imports `./server.js` directly, so it stays
 * client-safe.
 */
export const reportError = (
  error: unknown,
  context?: LogContext,
  activeLogger: Logger = logger,
): void => {
  if (isError(error)) {
    const code = error instanceof AppError ? error.code : error.name;
    activeLogger.error(error.message, { code, stack: error.stack, ...context });
    return;
  }
  activeLogger.error(String(error), { code: 'unknown', ...context });
};
