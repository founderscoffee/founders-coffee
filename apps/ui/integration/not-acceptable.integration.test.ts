import { createDb, seed } from '@founders-coffee/db';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import worker from '../src/server';

const ORIGIN = 'https://founders.coffee';

const fetchAccepting = async (
  path: string,
  accept: string,
): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${path}`, { headers: { accept } }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

describe('a request that takes no HTML', () => {
  beforeAll(async () => {
    await seed(createDb(env.DB));
  });

  it.each(['/ar/algeria', '/v2/_catalog', '/.well-known/agent.json'])(
    'is told 406 for the page at %s, not a server error',
    async (path) => {
      const response = await fetchAccepting(path, 'application/json');

      expect(
        response.status,
        'on 2026-10-04 bots asking for JSON got 500 from TanStack Start and turned the daily report red',
      ).toBe(406);
      expect(response.headers.get('vary')).toBe('Accept');
      expect(response.headers.get('cache-control')).toContain('no-store');
    },
  );

  it('still gets the page when it takes HTML', async () => {
    const response = await fetchAccepting(
      '/ar/algeria',
      'text/html,application/xhtml+xml',
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it.each([
    ['/events.json?market=algeria', 'application/json'],
    ['/robots.txt', 'text/plain'],
  ])(
    'still gets %s, which answers in a type of its own',
    async (path, type) => {
      const response = await fetchAccepting(path, 'application/json');

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain(type);
    },
  );
});
