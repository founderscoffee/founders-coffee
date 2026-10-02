import { ingestClientLogs, logger } from '@founders-coffee/observability';

import { RATE_BUDGETS, type RateBudget } from './rate-budgets.js';
import { consumeRateBudget } from './rate-consume.js';
import { readBounded } from './read-bounded.js';

const CLIENT_LOGS_PATH = '/client-logs';
const CLIENT_LOGS_MAX_BYTES = 64 * 1024;

export const CLIENT_LOGS_BUDGET = RATE_BUDGETS.telemetry.clientLogs;

const spend = (address: string, budget: RateBudget): Promise<boolean> =>
  consumeRateBudget(address, budget.action, budget.limit, budget.windowMs);

/**
 * The batch a request carries, or `null` when its body is larger than a beacon can be or is not
 * JSON.
 *
 * A beacon is a keepalive request, and the Fetch standard lets a page have at most 64 KiB of those
 * in flight, so every batch the client logger sends by beacon fits in `CLIENT_LOGS_MAX_BYTES`. A
 * larger body came from something else, and is cut off as it arrives, before it is parsed or logged.
 * The entry schema bounds the fields it knows but passes any other on as context, so without this
 * cap one request could carry any amount into the Worker's memory and the log.
 */
const readBatch = async (request: Request): Promise<unknown> => {
  const bytes = await readBounded(request, CLIENT_LOGS_MAX_BYTES);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
};

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
    ingestClientLogs(await readBatch(request));
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
