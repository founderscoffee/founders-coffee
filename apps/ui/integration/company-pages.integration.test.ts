import { LOCALES } from '@founders-coffee/core/locale';
import {
  createDb,
  getMarketByCode,
  seed,
  type Market,
} from '@founders-coffee/db';
import { footer_tagline, localizedName } from '@founders-coffee/i18n';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import { COMPANY_PAGES } from '../src/content/company/pages';
import { SOURCE_REPOSITORY_URL } from '../src/lib/source-repository';
import worker from '../src/server';

const ORIGIN = 'https://founders.coffee';

const PAGES = LOCALES.flatMap((locale) =>
  Object.keys(COMPANY_PAGES).map((page) => ({ locale, page })),
);

const fetchDocument = async (pathname: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${pathname}`, { headers: { accept: 'text/html' } }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

let algeria: Market;

describe('the company and legal pages, rendered by the Worker like every other page (#104)', () => {
  beforeAll(async () => {
    const db = createDb(env.DB);
    await seed(db);
    const seeded = await getMarketByCode(db, 'DZ');
    if (!seeded)
      throw new Error('The seed has no market for the footer to name');
    algeria = seeded;
  });

  it.each(PAGES)(
    '/$locale/$page carries the security headers, names its market, offers to host and links its source',
    async ({ locale, page }) => {
      const response = await fetchDocument(`/${locale}/${page}`);
      const html = await response.text();
      const footer = html.slice(html.indexOf('<footer'));
      const policy =
        response.headers.get('content-security-policy') ??
        response.headers.get('content-security-policy-report-only');

      expect(response.status).toBe(200);
      expect(policy, 'a prerendered file went out with no policy').toMatch(
        /script-src [^;]*'nonce-[^']+'/u,
      );
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(
        footer,
        'the prerender knew no market, and the tagline read "في في"',
      ).toContain(
        footer_tagline({ market: localizedName(algeria, locale) }, { locale }),
      );
      expect(
        html,
        'with no market there was no host button in the header or the footer',
      ).toContain(`href="/${locale}/algeria/host/create"`);
      expect(
        footer,
        'the AGPL has the site offer the source it runs to everyone who uses it, and the server-rendered footer is how every page does',
      ).toContain(`href="${SOURCE_REPOSITORY_URL}"`);
    },
  );
});
