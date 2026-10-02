import { ingestClientLogs, logger } from '@founders-coffee/observability';

import { RATE_BUDGETS, type RateBudget } from './rate-budgets.js';
import { consumeRateBudget } from './rate-consume.js';

const CLIENT_LOGS_PATH = '/client-logs';

export const CLIENT_LOGS_BUDGET = RATE_BUDGETS.telemetry.clientLogs;

const spend = (address: string, budget: RateBudget): Promise<boolean> =>
  consumeRateBudget(address, budget.action, budget.limit, budget.windowMs);

/**
 * Log the batch a browser sent, unless its address has already sent more than a page can.
 *
 * A beacon carries no session and no Turnstile token, so the caller is its address. A batch over
 * `CLIENT_LOGS_BUDGET` is dropped without being read, and the answer is the same 204 either way, so
 * a beacon has nothing to retry and its sender cannot tell where the limit lies. A refusal is logged
 * at most once a window, from a budget of its own, as one line that names neither the address nor
 * the batch, so a sender over its limit cannot fill the log with refusals instead.
 */
const acceptBatch = async (request: Request): Promise<Response> => {
  const address = `ip:${request.headers.get('cf-connecting-ip') ?? 'unknown'}`;
  if (await spend(address, CLIENT_LOGS_BUDGET)) {
    ingestClientLogs(await request.json().catch(() => null));
  } else if (await spend(address, RATE_BUDGETS.telemetry.clientLogsRefusal)) {
    logger.warn('client_logs_rate_limited', {
      limit: CLIENT_LOGS_BUDGET.limit,
      windowMs: CLIENT_LOGS_BUDGET.windowMs,
    });
  }
  return new Response(null, { status: 204 });
};

/**
 * Answer `POST /client-logs`, where the client logger sends its batches, or `null` for any other
 * request. A beacon is a plain POST, often sent as a page is left, with no session and no RPC
 * envelope, so it is served beside the photo and chat routes rather than as a server function, and
 * it draws on the same Durable Object limiter they do.
 */
export const handleClientLogsRequest = (
  request: Request,
  url: URL,
): Promise<Response> | null =>
  url.pathname === CLIENT_LOGS_PATH && request.method === 'POST'
    ? acceptBatch(request)
    : null;
