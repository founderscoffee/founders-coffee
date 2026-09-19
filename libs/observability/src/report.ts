import { AppError, isNotFoundCode } from '@founders-coffee/core';

import { logger } from './logger.js';
import type { LogContext, Logger } from './types.js';

const isError = (value: unknown): value is Error =>
  typeof value === 'object' && value !== null && value instanceof Error;

/**
 * Normalize any thrown value into a structured entry and log it. Wireable into TanStack Start
 * `onError`, route error boundaries, `queryClient.onError`, and `unhandledrejection`. Reuses
 * `AppError.code` when present so stable codes surface in logs. Defaults to the isomorphic `logger`
 * singleton (server or client per context) — never imports `./server.js` directly, so it stays
 * client-safe.
 *
 * A not-found code goes to `info` and everything else to `error`. A request for a market that does
 * not exist is a fact about the URL rather than a fault, and it arrives in bulk: every root-level
 * file request falls through to the `$market/$city` route (FC-13). At `info` they stay readable in
 * Workers Observability and leave `error` meaning something is wrong. Not `debug`, which sits below
 * the server logger's default threshold and would disappear in production.
 */
export const reportError = (
  error: unknown,
  context?: LogContext,
  activeLogger: Logger = logger,
): void => {
  if (isError(error)) {
    const code = error instanceof AppError ? error.code : error.name;
    const entry: LogContext = { code, stack: error.stack, ...context };
    if (isNotFoundCode(code)) {
      activeLogger.info(error.message, entry);
      return;
    }
    activeLogger.error(error.message, entry);
    return;
  }
  activeLogger.error(String(error), { code: 'unknown', ...context });
};
