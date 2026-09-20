import { createDb, seed } from '@founders-coffee/db';
import { cookieName } from '@founders-coffee/i18n';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import worker from '../src/server';

const ORIGIN = 'https://founders.coffee';
const EVENT = 'evt_private_screen';

const fetchDocument = async (
  path: string,
  locale?: string,
): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${path}`, {
      headers: {
        accept: 'text/html',
        ...(locale ? { cookie: `${cookieName}=${locale}` } : {}),
      },
      redirect: 'manual',
    }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

describe('the screens a notification links at carry their own language', () => {
  beforeAll(async () => {
    await seed(createDb(env.DB));
  });

  it.each(['closeout', 'feedback'])(
    'opens /%s in the language of the link, not of the cookie',
    async (screen) => {
      const response = await fetchDocument(`/fr/${screen}/${EVENT}`, 'ar');

      expect(response.status, `/fr/${screen} should render`).toBe(200);
      expect(
        /<html[^>]*\blang="fr"/u.test(await response.text()),
        'the prefix has to win over the cookie, or a host prompted in French still lands in Arabic',
      ).toBe(true);
    },
  );

  it.each(['closeout', 'feedback'])(
    'sends the unprefixed /%s on to its prefixed form',
    async (screen) => {
      const response = await fetchDocument(`/${screen}/${EVENT}`, 'fr');

      expect(response.status).toBe(307);
      expect(
        response.headers.get('location'),
        'notifications already in flight carry the unprefixed address and have to keep working',
      ).toBe(`/fr/${screen}/${EVENT}`);
    },
  );

  it.each(['closeout', 'feedback'])(
    'keeps /%s out of any shared cache and out of the index',
    async (screen) => {
      const response = await fetchDocument(`/fr/${screen}/${EVENT}`, 'fr');

      expect(response.headers.get('Cache-Control')).toContain('no-store');
      expect(response.headers.get('X-Robots-Tag')).toBeTruthy();
    },
  );
});
