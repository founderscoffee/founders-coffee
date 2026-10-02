import { describe, expect, it } from 'vitest';

import { ingestClientLogs } from './ingest.js';
import type { LogTransport } from './transports.js';
import type { LogEntry } from './types.js';

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

const ingest = (body: unknown): LogEntry[] => {
  const entries: LogEntry[] = [];
  const transport: LogTransport = (entry) => void entries.push(entry);
  ingestClientLogs(body, transport);
  return entries;
};

describe('ingestClientLogs', () => {
  it('re-emits sanitized client entries preserving service=ui', () => {
    const entries = ingest({
      entries: [report({ msg: 'client boom', password: 'p' })],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].msg).toBe('client boom');
    expect(entries[0].service).toBe('ui');
    expect(entries[0].password).toBe('[redacted]');
  });

  it("cuts a failed query's values out of an entry the browser reported", () => {
    const entries = ingest({
      entries: [
        report({
          msg: 'Failed query: select "id" from "user" where "email" = ?\nparams: amina@example.com',
          stack:
            'Error: Failed query: select "id" from "user" where "email" = ?\nparams: amina@example.com\n    at x (y.js:1:1)',
        }),
      ],
    });

    expect(JSON.stringify(entries[0])).not.toContain('amina');
    expect(entries[0].msg).toBe(
      'Failed query: select "id" from "user" where "email" = ?',
    );
  });

  it('keeps the path of the page a report came from', () => {
    const [entry] = ingest({ entries: [report({ path: '/ar/algeria' })] });

    expect(
      entry.path,
      'six reports of a hydration failure arrived with nothing to say which page failed',
    ).toBe('/ar/algeria');
    expect(entry).toMatchObject({
      level: 'error',
      code: 'Error',
      source: 'window',
    });
  });

  it.each([
    ['a query', '/ar/algeria?afterId=evt_1&afterStartsAt=1790000000'],
    ['a fragment', '/ar/algeria#market-events'],
    ['no leading slash', 'ar/algeria'],
    ['a whole address', 'https://founders.coffee/ar/algeria'],
    ['whitespace', '/ar/al geria'],
    ['more than an address holds', `/${'a'.repeat(2048)}`],
    ['no text', 418],
  ])('keeps a report whose path carries %s, without the path', (_, path) => {
    const [entry] = ingest({ entries: [report({ path })] });

    expect(entry.msg).toContain('#418');
    expect(entry.path).toBeUndefined();
    expect(JSON.stringify(entry)).not.toContain('afterId');
  });

  it.each([
    ['an unknown level', { level: 'shout' }],
    ['no message', { msg: undefined }],
    ['a message that is not text', { msg: { text: 'boom' } }],
    ['an oversized message', { msg: 'x'.repeat(8193) }],
    ['the server’s service', { service: 'worker' }],
    ['a time that is not one', { ts: 'yesterday' }],
    ['a code that is not text', { code: 418 }],
    ['a stack that is not text', { stack: ['Hi', 'Ui'] }],
  ])('drops an entry with %s and keeps the rest of its batch', (_, fields) => {
    const entries = ingest({
      entries: [report(fields), report({ msg: 'kept' })],
    });

    expect(entries.map((entry) => entry.msg)).toEqual(['kept']);
  });

  it.each([
    ['nothing', null],
    ['text', 'entries'],
    ['no entries', {}],
    ['entries that are not a list', { entries: report() }],
    [
      'more entries than a browser sends at once',
      { entries: Array.from({ length: 51 }, () => report()) },
    ],
  ])('ignores a body that holds %s', (_, body) => {
    expect(ingest(body)).toEqual([]);
  });
});
