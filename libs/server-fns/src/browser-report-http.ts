import { logger } from '@founders-coffee/observability';

import type { RateBudget } from './rate-budgets.js';
import { consumeRateBudget } from './rate-consume.js';
import { readBounded } from './read-bounded.js';

const KEEPALIVE_MAX_BYTES = 64 * 1024;

export interface BrowserReportRoute {
  readonly path: string;
  readonly budget: RateBudget;
  readonly refusalBudget: RateBudget;
  readonly refusalMessage: string;
  readonly ingest: (body: unknown) => void;
}

const spend = (address: string, budget: RateBudget): Promise<boolean> =>
  consumeRateBudget(address, budget.action, budget.limit, budget.windowMs);

/**
 * The report a request carries, or `null` when its body is larger than a browser sends or is not
 * JSON.
 *
 * A browser sends every report as a keepalive request: the client logger's beacon or the fetch it
 * falls back to, and a policy violation by the CSP specification's own steps. The Fetch standard
 * lets a page have at most 64 KiB of those in flight, so every report a browser sends fits in
 * `KEEPALIVE_MAX_BYTES`. A larger body came from something else, and is cut off as it arrives,
 * before it is parsed or logged, so no request can carry any amount into the Worker's memory, or
 * into the log through a field a report's schema passes on.
 */
const readReport = async (request: Request): Promise<unknown> => {
  const bytes = await readBounded(request, KEEPALIVE_MAX_BYTES);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
};

/**
 * Log the report a browser sent, unless its address has already sent more than a page can.
 *
 * A report carries no session and no Turnstile token, so the caller is its address. A report over
 * the route's budget is dropped without being read, and the answer is the same 204 either way, so a
 * browser has nothing to retry and its sender cannot tell where the limit lies. A refusal is logged
 * at most once a window, from a budget of its own, as one line that names neither the address nor
 * the report, so a sender over its limit cannot fill the log with refusals instead.
 */
const acceptReport = async (
  route: BrowserReportRoute,
  request: Request,
): Promise<Response> => {
  const address = `ip:${request.headers.get('cf-connecting-ip') ?? 'unknown'}`;
  if (await spend(address, route.budget)) {
    route.ingest(await readReport(request));
  } else if (await spend(address, route.refusalBudget)) {
    logger.warn(route.refusalMessage, {
      limit: route.budget.limit,
      windowMs: route.budget.windowMs,
    });
  }
  return new Response(null, { status: 204 });
};

/**
 * Answer a report a browser posts to `route.path` by itself, or `null` for any other request.
 *
 * A report is a plain POST, often sent as a page is left, with no session and no RPC envelope, so
 * it is served beside the photo and chat routes rather than as a server function, and it draws on
 * the same Durable Object limiter they do.
 */
export const answerBrowserReport = (
  route: BrowserReportRoute,
  request: Request,
  url: URL,
): Promise<Response> | null =>
  url.pathname === route.path && request.method === 'POST'
    ? acceptReport(route, request)
    : null;
