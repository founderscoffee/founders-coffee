import { AppError } from '@founders-coffee/core';

import { createServerLogger } from './server.js';
import type { LogContext, Logger } from './types.js';

const isError = (value: unknown): value is Error =>
  typeof value === 'object' && value !== null && value instanceof Error;

/**
 * Normalize any thrown value into a structured entry and log it at `error`.
 * Wireable into TanStack Start `onError`, route error boundaries,
 * `queryClient.onError`, and `unhandledrejection` (the wiring itself is P1-017).
 * Reuses `AppError.code` when present so stable codes surface in logs. No external
 * error-tracker in P0 (AGENTS.md §1.8 — adding a vendor needs approval).
 */
export const reportError = (
  error: unknown,
  context?: LogContext,
  logger: Logger = createServerLogger(),
): void => {
  if (isError(error)) {
    const code = error instanceof AppError ? error.code : error.name;
    logger.error(error.message, { code, stack: error.stack, ...context });
    return;
  }
  logger.error(String(error), { code: 'unknown', ...context });
};
