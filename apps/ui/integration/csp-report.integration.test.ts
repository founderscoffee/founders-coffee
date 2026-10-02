import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLIENT_LOGS_BUDGET } from '@founders-coffee/server-fns/client-logs-http';
import { CSP_REPORTS_BUDGET } from '@founders-coffee/server-fns/csp-report-http';

import worker from '../src/server';

const ORIGIN = 'https://founders.coffee';
const KEEPALIVE_LIMIT = 64 * 1024;

const violation = (fields: Record<string, unknown> = {}) => ({
  'csp-report': {
    'document-uri': 'https://founders.coffee/ar/algeria?afterId=evt_1',
    referrer: 'https://www.reddit.com/',
    'violated-directive': 'script-src-elem',
    'effective-directive': 'script-src-elem',
    'original-policy':
      "default-src 'self'; script-src 'self' 'nonce-Zm91bmRlcnM='; report-uri /csp-report",
    disposition: 'enforce',
    'blocked-uri':
      'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit',
    'status-code': 200,
    'script-sample': '',
    ...fields,
  },
});

const reportFrom = (page: string): string =>
  JSON.stringify(
    violation({ 'document-uri': `https://founders.coffee${page}` }),
  );

const reportOfBytes = (bytes: number, page: string): string => {
  const unpadded = JSON.stringify(
    violation({
      'document-uri': `https://founders.coffee${page}`,
      'original-policy': '',
    }),
  );
  return JSON.stringify(
    violation({
      'document-uri': `https://founders.coffee${page}`,
      'original-policy': 'x'.repeat(bytes - unpadded.length),
    }),
  );
};

const post = async (
  path: string,
  body: string,
  address?: string,
): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/csp-report',
        ...(address ? { 'cf-connecting-ip': address } : {}),
      },
      body,
    }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

const parsedLine = (line: unknown): Record<string, unknown>[] => {
  try {
    return [JSON.parse(String(line)) as Record<string, unknown>];
  } catch {
    return [];
  }
};

const linesNamed = (
  lines: unknown[][],
  msg: string,
): Record<string, unknown>[] =>
  lines
    .flatMap(([line]) => parsedLine(line))
    .filter((entry) => entry.msg === msg);

const loggedPages = (lines: unknown[][]): unknown[] =>
  linesNamed(lines, 'csp.violation').map((entry) => entry.path);

const sendWholeBudget = async (address: string): Promise<void> => {
  for (let sent = 1; sent <= CSP_REPORTS_BUDGET.limit; sent += 1)
    await post('/csp-report', reportFrom(`/report-${sent}`), address);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /csp-report', () => {
  it("logs the violation a browser reports, without its addresses' queries or the policy, and answers 204", async () => {
    const warnings = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const response = await post('/csp-report', JSON.stringify(violation()));

    expect(response.status).toBe(204);
    const logged = linesNamed(warnings.mock.calls, 'csp.violation');
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      level: 'warn',
      directive: 'script-src-elem',
      disposition: 'enforce',
      path: '/ar/algeria',
      blocked: 'https://translate.google.com/translate_a/element.js',
    });
    expect(JSON.stringify(logged)).not.toMatch(
      /afterId|googleTranslateElementInit|nonce|reddit/u,
    );
  });

  it.each([
    ['text that is not JSON', 'script-src-elem'],
    ['a client log batch', JSON.stringify({ entries: [] })],
    [
      'a report that names no directive',
      JSON.stringify({ 'csp-report': { 'blocked-uri': 'inline' } }),
    ],
  ])('answers a body holding %s without logging it', async (_, body) => {
    const warnings = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const response = await post('/csp-report', body);

    expect(response.status).toBe(204);
    expect(linesNamed(warnings.mock.calls, 'csp.violation')).toEqual([]);
  });

  it('logs a report as large as a keepalive request can carry, drops one a byte larger, and answers both 204', async () => {
    const warnings = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const largest = reportOfBytes(KEEPALIVE_LIMIT, '/largest');
    const larger = reportOfBytes(KEEPALIVE_LIMIT + 1, '/a-byte-larger');
    const answers = [
      await post('/csp-report', largest, '203.0.113.30'),
      await post('/csp-report', larger, '203.0.113.30'),
    ];

    expect(new TextEncoder().encode(larger).byteLength).toBe(
      KEEPALIVE_LIMIT + 1,
    );
    expect(answers.map((response) => response.status)).toEqual([204, 204]);
    expect(loggedPages(warnings.mock.calls)).toEqual(['/largest']);
  });
});

describe("POST /csp-report past an address's budget", () => {
  it('logs every report the budget allows, drops the rest, and says once that it limited the address without naming it', async () => {
    const warnings = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await sendWholeBudget('203.0.113.31');
    const dropped = [
      await post('/csp-report', reportFrom('/dropped'), '203.0.113.31'),
      await post('/csp-report', reportFrom('/dropped'), '203.0.113.31'),
    ];

    expect(dropped.map((response) => response.status)).toEqual([204, 204]);
    const pages = loggedPages(warnings.mock.calls);
    expect(pages).toHaveLength(CSP_REPORTS_BUDGET.limit);
    expect(pages).not.toContain('/dropped');
    const limited = linesNamed(warnings.mock.calls, 'csp_reports_rate_limited');
    expect(limited).toHaveLength(1);
    expect(limited[0]).toMatchObject({
      limit: CSP_REPORTS_BUDGET.limit,
      windowMs: CSP_REPORTS_BUDGET.windowMs,
    });
    expect(JSON.stringify(limited)).not.toContain('203.0.113.31');
  });

  it('counts reports apart from the client logs the same address sends', async () => {
    const warnings = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    for (let sent = 1; sent <= CLIENT_LOGS_BUDGET.limit; sent += 1)
      await post('/client-logs', '{}', '203.0.113.32');
    await post(
      '/csp-report',
      reportFrom('/after-the-client-logs'),
      '203.0.113.32',
    );

    expect(loggedPages(warnings.mock.calls)).toEqual([
      '/after-the-client-logs',
    ]);
  });
});
