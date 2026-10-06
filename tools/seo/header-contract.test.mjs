import { describe, expect, it } from 'vitest';

import { documentHeaderFailures } from './header-contract.mjs';

const PRODUCTION = 'https://founders.coffee';
const STAGING = 'https://staging.founders.coffee';

const WORKER = {
  'content-security-policy': "default-src 'self'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=()',
};

const failuresFor = (headers, canonicalOrigin = PRODUCTION) =>
  documentHeaderFailures({
    path: '/ar/privacy',
    response: new Response('', { headers }),
    canonicalOrigin,
  });

describe('the headers a public document is served with', () => {
  it('passes a document the Worker answered, in production and on staging', () => {
    expect(failuresFor(WORKER)).toEqual([]);
    expect(
      failuresFor({ ...WORKER, 'x-robots-tag': 'noindex, nofollow' }, STAGING),
    ).toEqual([]);
  });

  it('refuses a document Workers Assets served on its own, as /ar/privacy was (#104)', () => {
    expect(
      failuresFor({ 'cache-control': 'public, max-age=0, must-revalidate' }),
    ).toEqual([
      '/ar/privacy: no content-security-policy, strict-transport-security, x-content-type-options, referrer-policy, x-frame-options, permissions-policy, so the Worker did not answer it',
    ]);
  });

  it('takes a report-only policy as the Worker’s own', () => {
    const { 'content-security-policy': policy, ...rest } = WORKER;

    expect(
      failuresFor({ ...rest, 'content-security-policy-report-only': policy }),
    ).toEqual([]);
  });

  it('keeps production indexable and staging out of the index', () => {
    expect(
      failuresFor({ ...WORKER, 'x-robots-tag': 'noindex, nofollow' }),
    ).toEqual(['/ar/privacy: production response is noindex']);
    expect(failuresFor(WORKER, STAGING)).toEqual([
      '/ar/privacy: expected noindex, nofollow response header, got missing',
    ]);
  });

  it('refuses an Early Hint that points at another origin', () => {
    expect(
      failuresFor({
        ...WORKER,
        link: '<https://cdn.example.com/app.js>; rel=preload; as=script',
      }),
    ).toEqual(['/ar/privacy: Early Hint Link header points to another origin']);
  });

  it('lets through the connection a meetup page opens to Mapbox for its picture, as production sends it', () => {
    expect(
      failuresFor({
        ...WORKER,
        link: '</assets/styles-BXc2ZPtV.css>; as=style; rel=preload, <https://api.mapbox.com>; rel=preconnect',
      }),
    ).toEqual([]);
  });

  it('refuses anything else that names Mapbox, or an origin that only starts like the site’s', () => {
    for (const link of [
      '<https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/3,36,14/400x224>; rel=preload; as=image',
      '<https://api.mapbox.com>; rel=dns-prefetch',
      '<https://api.mapbox.com/styles/v1>; rel=preconnect',
      '<https://api.mapbox.com.example.com>; rel=preconnect',
      '<https://events.mapbox.com>; rel=preconnect',
      '</assets/styles-BXc2ZPtV.css>; as=style; rel=preload, <https://cdn.example.com/app.js>; rel=preload; as=script',
      '<https://founders.coffee.example.com/app.js>; rel=preload; as=script',
    ])
      expect(failuresFor({ ...WORKER, link }), link).toEqual([
        '/ar/privacy: Early Hint Link header points to another origin',
      ]);
  });

  it('takes an absolute address on the site itself as its own', () => {
    expect(
      failuresFor({
        ...WORKER,
        link: '<https://founders.coffee/assets/app.js>; rel=modulepreload; as=script',
      }),
    ).toEqual([]);
  });
});
