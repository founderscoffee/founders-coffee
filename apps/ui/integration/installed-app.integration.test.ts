import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import worker from '../src/server';

const ORIGIN = 'https://staging.founders.coffee';

const head = async (pathname: string): Promise<string> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${pathname}`, { headers: { accept: 'text/html' } }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response.text();
};

const metaContent = (document: string, name: string): string | null =>
  new RegExp(`<meta[^>]*name="${name}"[^>]*content="([^"]*)"`, 'u').exec(
    document,
  )?.[1] ??
  new RegExp(`<meta[^>]*content="([^"]*)"[^>]*name="${name}"`, 'u').exec(
    document,
  )?.[1] ??
  null;

describe('what the served document says about being installed', () => {
  it('carries the standalone tags an older iPhone reads', async () => {
    const document = await head('/ar/algeria');

    expect(metaContent(document, 'mobile-web-app-capable')).toBe('yes');
    expect(metaContent(document, 'apple-mobile-web-app-capable')).toBe('yes');
    expect(
      metaContent(document, 'apple-mobile-web-app-status-bar-style'),
      'without this the status bar is whatever iOS infers, which is the one thing the manifest cannot say',
    ).toBe('black');
    expect(metaContent(document, 'apple-mobile-web-app-title')).toBe(
      'Founders',
    );
    expect(metaContent(document, 'theme-color')).toBe('#270F00');
  });

  it.each([
    ['/ar/algeria', '/manifest.webmanifest'],
    ['/en/algeria', '/manifest.en.webmanifest'],
    ['/fr/algeria', '/manifest.fr.webmanifest'],
  ])('points %s at its own manifest', async (pathname, href) => {
    const document = await head(pathname);

    expect(document).toContain(`rel="manifest" href="${href}"`);
  });
});
