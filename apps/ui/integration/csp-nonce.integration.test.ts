import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import worker from '../src/server';

const ORIGIN = 'https://founders.coffee';

const document = async (pathname: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${pathname}`, { headers: { accept: 'text/html' } }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc=)[^>]*>/giu;

const policyNonce = (response: Response): string | null => {
  const policy =
    response.headers.get('content-security-policy') ??
    response.headers.get('content-security-policy-report-only') ??
    '';
  return /'nonce-([^']+)'/u.exec(policy)?.[1] ?? null;
};

/**
 * Every inline script this origin serves has to carry the response's nonce.
 *
 * `script-src` names a nonce and never `'unsafe-inline'`, and a browser that understands nonces
 * ignores `'unsafe-inline'` once one is present — so an inline script without the attribute is not
 * degraded, it is refused. While the policy is report-only that refusal is a line in a console
 * nobody is reading and a report nobody is counting, which is exactly how one survives long enough
 * to be discovered by the flag that enforces the policy. This is a whole-document check rather than
 * a check of any one script, because the failure is always a script somebody added without knowing
 * the rule.
 */
describe('inline scripts against the policy that governs them', () => {
  it.each(['/ar/algeria', '/en/algeria', '/ar/about'])(
    'signs every inline script it serves on %s',
    async (pathname) => {
      const response = await document(pathname);
      const body = await response.text();
      const nonce = policyNonce(response);

      expect(
        nonce,
        'the response carries no nonce in its policy at all, so either the header stopped being sent or it stopped naming one — both make the check below vacuous',
      ).toBeTruthy();

      const tags = [...body.matchAll(INLINE_SCRIPT)].map((match) => match[0]);
      expect(tags.length).toBeGreaterThan(0);

      const unsigned = tags.filter((tag) => !tag.includes(`nonce="${nonce}"`));
      expect(
        unsigned,
        `${unsigned.length} inline script(s) on ${pathname} carry no nonce, so an enforced policy refuses to run them: ${unsigned.join(' ')}. Emit them through the route's head.scripts rather than as a raw tag, which is where the per-response nonce is attached`,
      ).toEqual([]);
    },
  );

  it('keeps the nonce fresh per response', async () => {
    const [first, second] = await Promise.all([
      document('/ar/algeria'),
      document('/ar/algeria'),
    ]);

    expect(policyNonce(first)).toBeTruthy();
    expect(
      policyNonce(first),
      'a nonce reused across responses lets injected markup mark itself as trusted, which is the whole protection the directive buys',
    ).not.toBe(policyNonce(second));
  });
});
