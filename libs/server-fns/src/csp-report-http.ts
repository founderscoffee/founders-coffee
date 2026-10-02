import { ingestCspReport } from '@founders-coffee/observability';

import {
  answerBrowserReport,
  type BrowserReportRoute,
} from './browser-report-http.js';
import { RATE_BUDGETS } from './rate-budgets.js';

export const CSP_REPORT_PATH = '/csp-report';
export const CSP_REPORTS_BUDGET = RATE_BUDGETS.telemetry.cspReports;

const CSP_REPORT_ROUTE: BrowserReportRoute = {
  path: CSP_REPORT_PATH,
  budget: CSP_REPORTS_BUDGET,
  refusalBudget: RATE_BUDGETS.telemetry.cspReportsRefusal,
  refusalMessage: 'csp_reports_rate_limited',
  ingest: ingestCspReport,
};

/**
 * Answer `POST /csp-report`, the policy's `report-uri`, where a browser sends each violation of the
 * Content Security Policy, or `null` for any other request.
 */
export const handleCspReportRequest = (
  request: Request,
  url: URL,
): Promise<Response> | null =>
  answerBrowserReport(CSP_REPORT_ROUTE, request, url);
