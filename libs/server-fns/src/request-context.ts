import { createMiddleware } from '@tanstack/react-start';

import { reportError } from '@founders-coffee/observability';
import { runWithContext } from '@founders-coffee/observability/context';

const generateRequestId = (): string => crypto.randomUUID();

/**
 * Run an async function inside a fresh request context (a per-request id), logging
 * any failure via `reportError` before re-throwing. Extracted from the middleware
 * so the logic is directly testable. The structured logger (libs/observability)
 * reads this context, so every log within `fn` auto-carries the requestId
 * (AGENTS.md §13).
 */
export const withRequestContext = async <T>(fn: () => Promise<T>): Promise<T> =>
  runWithContext({ requestId: generateRequestId() }, async () => {
    try {
      return await fn();
    } catch (error) {
      reportError(error);
      throw error;
    }
  });

/**
 * Server-function middleware: gives every server function a per-request id (in the
 * AsyncLocalStorage context the logger reads) and logs failures. Env-free. Register
 * globally in `createStart` (P1-017) and add to each feature fn's `.middleware([...])`
 * for typed context.
 */
export const requestContextMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => withRequestContext(() => next()),
);
