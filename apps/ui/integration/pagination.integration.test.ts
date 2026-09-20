import { createDb, seed } from '@founders-coffee/db';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import worker from '../src/server';

const ORIGIN = 'https://founders.coffee';

const MARKET = '/ar/algeria';
const CITY = '/ar/algeria/algiers';

const fetchDocument = async (path: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${path}`, { headers: { accept: 'text/html' } }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

const HALF_CURSORS = [
  'afterId=evt_missing',
  'afterStartsAt=1767225600000',
] as const;

describe('crawlable pagination cursors', () => {
  beforeAll(async () => {
    await seed(createDb(env.DB));
  });

  it('serves the landing pages themselves', async () => {
    for (const path of [MARKET, CITY]) {
      const response = await fetchDocument(path);

      expect(response.status, `${path} should render`).toBe(200);
    }
  });

  it('sends half a cursor back to the canonical page instead of failing', async () => {
    for (const path of [MARKET, CITY]) {
      for (const half of HALF_CURSORS) {
        const response = await fetchDocument(`${path}?${half}`);

        expect(
          response.status,
          `${path}?${half} reaches a server function that rejects an unpaired cursor, so leaving it in the search is a 500 on a crawlable URL`,
        ).toBe(307);
        expect(response.headers.get('location')).toBe(path);
      }
    }
  });

  it('ignores search parameters it does not own', async () => {
    const response = await fetchDocument(`${MARKET}?utm_source=newsletter`);

    expect(response.status).toBe(200);
  });

  it('sends a complete cursor that names no row back to the first page', async () => {
    const response = await fetchDocument(
      `${MARKET}?afterStartsAt=1767225600000&afterId=evt_missing`,
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(MARKET);
  });

  it('never lets a failure be cached by the shared cache', async () => {
    const failures = [
      '/ar/algeria/not-a-real-city',
      '/ar/not-a-real-market',
      '/definitely/not/a/route',
    ];

    for (const path of failures) {
      const response = await fetchDocument(path);
      const cacheControl = response.headers.get('cache-control') ?? '';

      expect(response.status, `${path} should fail`).toBeGreaterThanOrEqual(
        400,
      );
      expect(
        cacheControl,
        `${path} answered ${response.status} with "${cacheControl}" — a shared cache would pin that failure for every later visitor`,
      ).not.toMatch(/s-maxage|public/u);
    }
  });
});
