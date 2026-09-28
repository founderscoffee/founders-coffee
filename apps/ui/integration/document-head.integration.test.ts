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

  it('names the site and offers a large icon on the page the home page lands on', async () => {
    const home = await fetchDocument('/');
    const landing = home.headers.get('location') ?? '';
    const head =
      (await (await fetchDocument(landing)).text()).split('</head>')[0] ?? '';
    const website = [
      ...head.matchAll(
        /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gsu,
      ),
    ]
      .map((match) => JSON.parse(match[1] ?? '{}') as Record<string, unknown>)
      .find((node) => node['@type'] === 'WebSite');
    const iconSizes = [
      ...head.matchAll(/<link rel="icon" href="[^"]+" sizes="(\d+)x\1"/gu),
    ].map((match) => Number(match[1]));

    expect(home.status, 'Google reads the page / redirects to').toBe(307);
    expect(
      website,
      'with no WebSite node Google printed the bare domain above each result',
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Founders Coffee',
      url: `${ORIGIN}/`,
    });
    expect(
      Math.max(...iconSizes),
      'Google asks for an icon larger than 48px, and the largest was 32px',
    ).toBeGreaterThan(48);
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
