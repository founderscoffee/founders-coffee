import { describe, expect, it } from 'vitest';

import { ingestCspReport } from './csp-report.js';
import { createServerLogger } from './server.js';

const violation = (fields: Record<string, unknown> = {}) => ({
  'csp-report': {
    'document-uri': 'https://founders.coffee/ar/algeria',
    referrer: 'https://www.reddit.com/',
    'violated-directive': 'script-src-elem',
    'effective-directive': 'script-src-elem',
    'original-policy':
      "default-src 'self'; script-src 'self' https://challenges.cloudflare.com 'nonce-Zm91bmRlcnM='; report-uri /csp-report",
    disposition: 'enforce',
    'blocked-uri':
      'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit',
    'status-code': 200,
    'script-sample': '',
    ...fields,
  },
});

const ingest = (body: unknown): Record<string, unknown>[] => {
  const lines: string[] = [];
  ingestCspReport(
    body,
    createServerLogger({
      transport: (entry) => void lines.push(JSON.stringify(entry)),
    }),
  );
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
};

const loggedFrom = (
  fields: Record<string, unknown>,
): Record<string, unknown> => {
  const entries = ingest(violation(fields));
  expect(entries).toHaveLength(1);
  return entries[0];
};

describe('ingestCspReport', () => {
  it('logs the directive, the page, the blocked address and where the violation came from', () => {
    const entry = loggedFrom({
      'source-file': 'https://founders.coffee/assets/index-C5Kg4YjW.js',
      'line-number': 17,
      'column-number': 34,
    });

    expect(entry).toMatchObject({
      msg: 'csp.violation',
      level: 'warn',
      directive: 'script-src-elem',
      disposition: 'enforce',
      path: '/ar/algeria',
      blocked: 'https://translate.google.com/translate_a/element.js',
      sourceFile: 'https://founders.coffee/assets/index-C5Kg4YjW.js',
      line: 17,
      column: 34,
    });
  });

  it('keeps no query, no referrer and none of the policy that was violated', () => {
    const entry = loggedFrom({
      'document-uri': 'https://founders.coffee/ar/algeria?afterId=evt_1',
      referrer: 'https://news.example/thread?reader=amina',
      'source-file': 'https://founders.coffee/assets/index.js?v=amina',
    });
    const line = JSON.stringify(entry);

    expect(entry.path).toBe('/ar/algeria');
    expect(entry.sourceFile).toBe('https://founders.coffee/assets/index.js');
    for (const left of [
      'afterId',
      'amina',
      'googleTranslateElementInit',
      'news.example',
      'nonce',
      'report-uri',
    ])
      expect(line).not.toContain(left);
  });

  it('names the directive from violated-directive for a browser that sends no effective-directive', () => {
    const entry = loggedFrom({
      'effective-directive': undefined,
      'violated-directive':
        "script-src 'self' https://challenges.cloudflare.com 'nonce-Zm91bmRlcnM='",
    });

    expect(entry.directive).toBe('script-src');
    expect(JSON.stringify(entry)).not.toContain('nonce');
  });

  it('keeps a word a browser reports in place of an address, as Firefox reported an extension', () => {
    const entry = loggedFrom({
      'document-uri': 'about',
      'blocked-uri': 'inline',
      'source-file': 'sandbox eval code',
      'line-number': 17,
      'column-number': 34,
    });

    expect(entry).toMatchObject({
      blocked: 'inline',
      sourceFile: 'sandbox eval code',
      line: 17,
    });
    expect(entry, 'a frame with no web address has no path').not.toHaveProperty(
      'path',
    );
  });

  it.each([
    [
      'chrome-extension://abcdefghijklmnopabcdefghijklmnop/content.js',
      'chrome-extension',
    ],
    [
      'blob:https://founders.coffee/0f6c5b9e-4f1e-4bd6-9a33-ad3c2c1a6b8e',
      'blob',
    ],
    ['data:text/javascript;base64,YWxlcnQoMSk=', 'data'],
  ])('keeps only the scheme of %s', (blocked, scheme) => {
    expect(loggedFrom({ 'blocked-uri': blocked }).blocked).toBe(scheme);
  });

  it('drops an address no browser would report, and keeps the rest of its report', () => {
    const entry = loggedFrom({
      'blocked-uri': `https://founders.coffee/${'a'.repeat(2_048)}`,
      'source-file': '<script>alert(1)</script>',
      'line-number': '17',
      disposition: 'shout',
    });

    expect(entry.directive).toBe('script-src-elem');
    for (const dropped of ['blocked', 'sourceFile', 'line', 'disposition'])
      expect(entry).not.toHaveProperty(dropped);
  });

  it.each([
    ['nothing', null],
    ['a list', [violation()]],
    ['a client log batch', { entries: [] }],
    ['a report that is not an object', { 'csp-report': 'script-src-elem' }],
    [
      'a report that names no directive',
      violation({
        'effective-directive': undefined,
        'violated-directive': undefined,
      }),
    ],
    [
      'a directive that is not one',
      violation({
        'effective-directive': undefined,
        'violated-directive': '<img src=x>',
      }),
    ],
  ])('logs nothing for %s', (_, body) => {
    expect(ingest(body)).toEqual([]);
  });
});
