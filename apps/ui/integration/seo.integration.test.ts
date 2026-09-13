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

describe('public Worker SEO contract', () => {
  beforeAll(async () => {
    await seed(createDb(env.DB));
  });

  it('serves staging robots and an empty staging sitemap', async () => {
    const robots = await worker.fetch(
      new Request(`${ORIGIN}/robots.txt`),
      env,
      createExecutionContext(),
    );
    const robotsBody = await robots.text();
    expect(robots.status).toBe(200);
    expect(robots.headers.get('content-type')).toContain('text/plain');
    expect(robotsBody).toContain('Disallow: /');
    expect(robotsBody).not.toContain('Sitemap:');

    const sitemap = await worker.fetch(
      new Request(`${ORIGIN}/sitemap.xml`),
      env,
      createExecutionContext(),
    );
    const sitemapBody = await sitemap.text();
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get('content-type')).toContain('application/xml');
    expect(sitemapBody).toContain('<urlset');
    expect(sitemapBody).not.toContain('<url>');
  });

  it('serves a staging-safe llms guide and a production discovery guide', async () => {
    const staging = await worker.fetch(
      new Request(`${ORIGIN}/llms.txt`),
      env,
      createExecutionContext(),
    );
    const stagingBody = await staging.text();

    expect(staging.status).toBe(200);
    expect(staging.headers.get('content-type')).toContain('text/plain');
    expect(staging.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(staging.headers.get('cache-control')).toBe('no-store');
    expect(stagingBody).toContain(
      'This staging environment is not for public discovery.',
    );
    expect(stagingBody).not.toContain('https://founders.coffee');

    const production = await worker.fetch(
      new Request('https://founders.coffee/llms.txt'),
      env,
      createExecutionContext(),
    );
    const productionBody = await production.text();

    expect(production.status).toBe(200);
    expect(production.headers.get('content-type')).toContain('text/plain');
    expect(production.headers.get('x-robots-tag')).toBeNull();
    expect(production.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(productionBody).toContain('# founders.coffee');
    expect(productionBody).toContain('https://founders.coffee/sitemap.xml');
    expect(productionBody).toContain('https://founders.coffee/robots.txt');
    expect(productionBody).not.toContain('staging.founders.coffee');
  });

  it('renders a public locale page with staging-safe metadata and hints', async () => {
    const response = await fetchDocument('/ar/algeria');
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('cache-control')).toContain('s-maxage=60');
    expect(body).toContain('<html lang="ar"');
    expect(body).toContain('https://staging.founders.coffee/ar/algeria');
    expect(body).toContain('<h1');
    const linkHeader = response.headers.get('link');
    if (linkHeader) {
      expect(linkHeader).toMatch(/<\/assets\//u);
      expect(linkHeader).not.toMatch(
        /https?:\/\/(?!staging\.founders\.coffee)/u,
      );
    }
  });

  it('keeps utility pages private and noindex', async () => {
    const response = await fetchDocument('/login');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('link')).toBeNull();
  });

  it('preserves one-hop redirects without Early Hints', async () => {
    const response = await fetchDocument('/about');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('/ar/about');
    expect(response.headers.get('link')).toBeNull();
  });
});
