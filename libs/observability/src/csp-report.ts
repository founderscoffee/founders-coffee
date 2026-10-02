import { z } from 'zod';

import { logger } from './logger.js';
import type { Logger } from './types.js';

const MAX_ADDRESS = 2_048;
const DIRECTIVE = /^[a-z][a-z-]{0,63}$/u;
const KEYWORD = /^[a-z][a-z0-9 -]{0,63}$/u;
const WEB_SCHEMES = new Set(['http:', 'https:']);

const text = z.string().optional().catch(undefined);
const position = z.number().int().nonnegative().optional().catch(undefined);

const cspReportSchema = z.object({
  'csp-report': z.object({
    'effective-directive': text,
    'violated-directive': text,
    'document-uri': text,
    'blocked-uri': text,
    'source-file': text,
    'line-number': position,
    'column-number': position,
    disposition: z.enum(['enforce', 'report']).optional().catch(undefined),
  }),
});

type CspReport = z.infer<typeof cspReportSchema>['csp-report'];

/** `value` as a URL, or `null` when it is not an absolute one. */
const parsedUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

/**
 * Where a report says a violation came from or was going, as the log keeps it.
 *
 * A browser strips only the fragment and any credentials from the addresses it reports, so each
 * one arrives with its query, and a query carries whatever a page or a third party put in it. A web
 * address is kept as its origin and path. Any other address is kept as its scheme alone (`blob`,
 * `chrome-extension`), which is all the CSP specification has a browser send. A word a browser
 * reports in place of an address (`inline`, `eval`, Firefox's `sandbox eval code`) is kept as it
 * came. Anything else is dropped, and the report kept without it.
 */
const reportedAddress = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const url = parsedUrl(value);
  if (!url) return KEYWORD.test(value) ? value : undefined;
  if (!WEB_SCHEMES.has(url.protocol)) return url.protocol.slice(0, -1);
  const kept = `${url.origin}${url.pathname}`;
  return kept.length <= MAX_ADDRESS ? kept : undefined;
};

/**
 * The path of the page a violation happened on, the same `path` a client error report carries, or
 * nothing for a frame with no web address of its own (`about:blank`, which a browser reports as
 * `about`).
 */
const pagePath = (value: string | undefined): string | undefined => {
  const url = value === undefined ? null : parsedUrl(value);
  return url &&
    WEB_SCHEMES.has(url.protocol) &&
    url.pathname.length <= MAX_ADDRESS
    ? url.pathname
    : undefined;
};

/**
 * The directive a report says was violated. A browser that follows CSP Level 3 names it alone in
 * `effective-directive`; an older one names it only in `violated-directive`, followed by the
 * sources it allows.
 */
const directiveOf = (report: CspReport): string | undefined => {
  const name =
    report['effective-directive'] ??
    report['violated-directive']?.split(' ')[0];
  return name !== undefined && DIRECTIVE.test(name) ? name : undefined;
};

/**
 * Log a violation of the Content Security Policy that a browser posted to the policy's
 * `report-uri`, as one `csp.violation` line.
 *
 * The body is validated here, as every input is: a `csp-report` object naming the directive that
 * was violated. Anything else is dropped. The line keeps what says where the policy failed: the
 * directive, whether it was enforced, the page's path, the blocked address, and the file and
 * position the violation came from. It leaves out the rest of what a browser sends: the policy
 * itself, which this Worker wrote and which carries the page's nonce; the page's referrer, which is
 * where its visitor came from; and the status code and script sample, which say nothing the line
 * needs.
 */
export const ingestCspReport = (body: unknown, log: Logger = logger): void => {
  const parsed = cspReportSchema.safeParse(body);
  if (!parsed.success) return;
  const report = parsed.data['csp-report'];
  const directive = directiveOf(report);
  if (!directive) return;
  log.warn('csp.violation', {
    directive,
    disposition: report.disposition,
    path: pagePath(report['document-uri']),
    blocked: reportedAddress(report['blocked-uri']),
    sourceFile: reportedAddress(report['source-file']),
    line: report['line-number'],
    column: report['column-number'],
  });
};
