import { createDb, seed } from '@founders-coffee/db';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import worker from '../src/server';

const ORIGIN = 'https://staging.founders.coffee';

const fetchDocument = async (pathname: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${pathname}`, {
      headers: { accept: 'text/html' },
    }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

describe('what a document says about itself in its head', () => {
  beforeAll(async () => {
    await seed(createDb(env.DB));
  });

  it('titles a missing page and keeps it out of the index', async () => {
    const response = await fetchDocument('/fr/algeria/nowhere');
    const head = (await response.text()).split('</head>')[0] ?? '';

    expect(response.status).toBe(404);
    expect(head, 'every 404 went out with no <title>').toMatch(
      /<title>Founders Coffee - [^<]+<\/title>/u,
    );
    expect(head, 'and with no robots tag').toContain(
      '<meta name="robots" content="noindex, nofollow"',
    );
  });

  it('lists both other languages as Open Graph alternates', async () => {
    const head =
      (await (await fetchDocument('/fr/about')).text()).split('</head>')[0] ??
      '';
    const alternates = [
      ...head.matchAll(/property="og:locale:alternate" content="([^"]+)"/gu),
    ].map((match) => match[1]);

    expect(alternates, 'only the last of the two reached the page').toEqual([
      'ar_DZ',
      'en_US',
    ]);
  });
});
