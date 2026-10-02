import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLIENT_LOGS_BUDGET } from '@founders-coffee/server-fns/client-logs-http';

import worker from '../src/server';

const ORIGIN = 'https://founders.coffee';

const report = (fields: Record<string, unknown> = {}) => ({
  ts: '2026-10-01T12:18:00.000Z',
  level: 'error',
  msg: 'Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= for the full message',
  service: 'ui',
  code: 'Error',
  stack: 'Hi@https://founders.coffee/assets/index-C5Kg4YjW.js:9:31164',
  source: 'window',
  ...fields,
});

const beacon = async (body: string, address?: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}/client-logs`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
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

const batchOf = (msg: string): string =>
  JSON.stringify({ entries: [report({ msg })] });

const sendWholeBudget = async (address: string): Promise<void> => {
  for (let sent = 1; sent <= CLIENT_LOGS_BUDGET.limit; sent += 1)
    await beacon(batchOf(`report ${sent}`), address);
};

const parsedLine = (line: unknown): Record<string, unknown>[] => {
  try {
    return [JSON.parse(String(line)) as Record<string, unknown>];
  } catch {
    return [];
  }
};

const browserReports = (lines: unknown[][]): Record<string, unknown>[] =>
  lines
    .flatMap(([line]) => parsedLine(line))
    .filter((entry) => entry.service === 'ui');

const reportedMessages = (lines: unknown[][]): unknown[] =>
  browserReports(lines).map((entry) => entry.msg);

const limitedLines = (lines: unknown[][]): Record<string, unknown>[] =>
  lines
    .flatMap(([line]) => parsedLine(line))
    .filter((entry) => entry.msg === 'client_logs_rate_limited');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /client-logs', () => {
  it('logs a browser report with the page it came from, and drops an entry that is not one', async () => {
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = await beacon(
      JSON.stringify({
        entries: [
          report({ path: '/ar/algeria' }),
          report({ level: 'shout', msg: 'forged' }),
        ],
      }),
    );

    expect(response.status).toBe(204);
    const logged = browserReports(errors.mock.calls);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      path: '/ar/algeria',
      level: 'error',
      code: 'Error',
      source: 'window',
    });
  });

  it('logs a report whose path carries a query, without the path', async () => {
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await beacon(
      JSON.stringify({
        entries: [report({ path: '/ar/algeria?afterId=evt_1' })],
      }),
    );

    const logged = browserReports(errors.mock.calls);
    expect(logged).toHaveLength(1);
    expect(logged[0]).not.toHaveProperty('path');
    expect(JSON.stringify(logged)).not.toContain('afterId');
  });

  it.each([
    ['text that is not JSON', 'Minified React error #418'],
    ['nothing', 'null'],
    ['entries that are not a list', JSON.stringify({ entries: report() })],
  ])('answers a body holding %s without logging it', async (_, body) => {
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = await beacon(body);

    expect(response.status).toBe(204);
    expect(browserReports(errors.mock.calls)).toEqual([]);
  });
});

describe("POST /client-logs past an address's budget", () => {
  it('logs every batch the budget allows, then drops the next and still answers 204', async () => {
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await sendWholeBudget('203.0.113.10');
    const over = await beacon(batchOf('one batch too many'), '203.0.113.10');

    expect(over.status).toBe(204);
    const logged = reportedMessages(errors.mock.calls);
    expect(logged).toHaveLength(CLIENT_LOGS_BUDGET.limit);
    expect(logged).not.toContain('one batch too many');
  });

  it('says once that it limited an address, without naming it, however many batches it drops', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnings = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await sendWholeBudget('203.0.113.11');
    const dropped = [
      await beacon(batchOf('dropped'), '203.0.113.11'),
      await beacon(batchOf('dropped'), '203.0.113.11'),
      await beacon(batchOf('dropped'), '203.0.113.11'),
    ];

    expect(dropped.map((response) => response.status)).toEqual([204, 204, 204]);
    const limited = limitedLines(warnings.mock.calls);
    expect(limited).toHaveLength(1);
    expect(limited[0]).toMatchObject({
      level: 'warn',
      limit: CLIENT_LOGS_BUDGET.limit,
      windowMs: CLIENT_LOGS_BUDGET.windowMs,
    });
    expect(JSON.stringify(limited)).not.toContain('203.0.113.11');
  });

  it('counts every address against its own budget', async () => {
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await sendWholeBudget('203.0.113.12');
    await beacon(
      batchOf('from the address that sent its budget'),
      '203.0.113.12',
    );
    await beacon(batchOf('from the address next door'), '203.0.113.13');

    const logged = reportedMessages(errors.mock.calls);
    expect(logged).toContain('from the address next door');
    expect(logged).not.toContain('from the address that sent its budget');
  });
});
