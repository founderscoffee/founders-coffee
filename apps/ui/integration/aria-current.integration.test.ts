import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import { createDb, seed } from '@founders-coffee/db';

import worker from '../src/server';

const ORIGIN = 'https://staging.founders.coffee';

const documentAt = async (pathname: string): Promise<string> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${pathname}`, { headers: { accept: 'text/html' } }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response.text();
};

/**
 * Every anchor in the document that tells a screen reader it is the page being read.
 *
 * Read off the served HTML rather than a rendered tree, because the shell's own tests mock
 * `Link` away, and `aria-current` is the one thing `Link` decides for itself.
 */
const claimingToBeThisPage = (document: string): readonly string[] =>
  [...document.matchAll(/<a\b[^>]*>/gu)]
    .map((match) => match[0])
    .filter((tag) => /aria-current="page"/u.test(tag))
    .map((tag) => /href="([^"]*)"/u.exec(tag)?.[1] ?? '');

describe('which link says it is the page you are on', () => {
  beforeAll(async () => {
    await seed(createDb(env.DB));
  });

  it.each([
    '/ar/algeria/algiers',
    '/en/algeria/algiers',
    '/ar/algeria/host/create',
  ])('names only the address of %s itself', async (pathname) => {
    const wrong = claimingToBeThisPage(await documentAt(pathname)).filter(
      (href) => href !== pathname,
    );

    expect(
      wrong,
      `these point elsewhere and still announce themselves as the current page: ${wrong.join(', ')}. A link is active by path prefix unless told otherwise, so every ancestor of this address claims it.`,
    ).toEqual([]);
  });

  it('still marks the one link that is the page you are on', async () => {
    const claims = claimingToBeThisPage(await documentAt('/ar/algeria'));

    expect(
      claims,
      'a guard that silenced the cue everywhere would pass the test above and help nobody',
    ).toContain('/ar/algeria');
  });
});
