import { ingestClientLogs } from '@founders-coffee/observability';

import {
  answerBrowserReport,
  type BrowserReportRoute,
} from './browser-report-http.js';
import { RATE_BUDGETS } from './rate-budgets.js';

export const CLIENT_LOGS_BUDGET = RATE_BUDGETS.telemetry.clientLogs;

const CLIENT_LOGS_ROUTE: BrowserReportRoute = {
  path: '/client-logs',
  budget: CLIENT_LOGS_BUDGET,
  refusalBudget: RATE_BUDGETS.telemetry.clientLogsRefusal,
  refusalMessage: 'client_logs_rate_limited',
  ingest: ingestClientLogs,
};

/**
 * Answer `POST /client-logs`, where the client logger sends its batches, or `null` for any other
 * request.
 */
export const handleClientLogsRequest = (
  request: Request,
  url: URL,
): Promise<Response> | null =>
  answerBrowserReport(CLIENT_LOGS_ROUTE, request, url);
