import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const beacon = async (body: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}/client-logs`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
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

const browserReports = (lines: unknown[][]): Record<string, unknown>[] =>
  lines
    .flatMap(([line]) => parsedLine(line))
    .filter((entry) => entry.service === 'ui');

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
