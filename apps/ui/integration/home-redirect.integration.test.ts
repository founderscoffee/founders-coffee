import { createDb, seed } from '@founders-coffee/db';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import { GEO_COOKIE } from '../src/features/markets/api';
import worker from '../src/server';

import { recordD1Rounds } from './d1-rounds.fixtures';

const ORIGIN = 'https://founders.coffee';

const arrive = async (
  path: string,
  country: string,
  cookie?: string,
): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${path}`, {
      headers: {
        accept: 'text/html',
        'cf-ipcountry': country,
        ...(cookie ? { cookie } : {}),
      },
    }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

describe('an arrival that names no market', () => {
  beforeAll(async () => {
    await seed(createDb(env.DB));
  });

  it.each([
    ['/', 'DZ', '/ar/algeria'],
    ['/', 'EG', '/ar/egypt'],
    ['/fr', 'SA', '/fr/saudi-arabia'],
    ['/en/host', 'EG', '/en/egypt/host/create'],
    ['/', 'US', '/ar/algeria'],
  ])(
    '%s from %s goes on to %s without waiting on D1',
    async (path, country, location) => {
      await (await arrive(path, country)).text();
      const d1 = recordD1Rounds();
      try {
        const response = await arrive(path, country);
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(location);
        await response.text();
      } finally {
        d1.restore();
      }

      expect(
        d1.rounds(),
        `the visitor's country is matched against the markets the root route already holds, from the list the data centre keeps; looking the country up as a slug, then as a code, then loading a whole landing to read its slug was up to five trips in a row (#136):\n${d1.timeline()}`,
      ).toBe(0);
    },
  );

  it('sends a reader whose remembered market has closed to the market of their country', async () => {
    const response = await arrive('/', 'SA', `${GEO_COOKIE}=atlantis`);

    expect(response.headers.get('location')).toBe('/ar/saudi-arabia');
    expect(response.headers.get('set-cookie')).toContain(
      `${GEO_COOKIE}=saudi-arabia;`,
    );
  });
});
