import { describe, expect, it } from 'vitest';

import { errorPageHead, errorPageKind } from './seo-error';

describe('error page metadata', () => {
  it('uses localized not-found copy and never emits canonical or structured data', () => {
    const head = errorPageHead('ar', 'notFound');

    expect(head.meta).toEqual(
      expect.arrayContaining([
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'description', content: expect.any(String) },
      ]),
    );
    expect(head.meta.find((item) => 'title' in item)?.title).toContain(
      'Founders Coffee',
    );
    expect(head.links).toEqual([]);
    expect(head.scripts).toEqual([]);
  });

  it('keeps errors noindex with localized descriptions', () => {
    const arabic = errorPageHead('ar', 'error');
    const french = errorPageHead('fr', 'error');

    expect(arabic.meta).toContainEqual({
      name: 'robots',
      content: 'noindex, nofollow',
    });
    expect(
      arabic.meta.find((item) => item.name === 'description')?.content,
    ).not.toBe(
      french.meta.find((item) => item.name === 'description')?.content,
    );
  });
});

describe('which error page a render is', () => {
  const loaded = { status: 'success' };

  it('reads a not-found the root caught off the root match itself', () => {
    expect(
      errorPageKind({ status: 'success', globalNotFound: true }, [
        loaded,
        loaded,
      ]),
      'the list handed to head() still read success on a 404, so the page went out with no title and no robots tag',
    ).toBe('notFound');
  });

  it('reads a not-found or an error recorded in the list', () => {
    expect(errorPageKind(loaded, [loaded, { status: 'notFound' }])).toBe(
      'notFound',
    );
    expect(errorPageKind(loaded, [loaded, { status: 'error' }])).toBe('error');
  });

  it('calls a page that is both missing and failing missing', () => {
    expect(
      errorPageKind({ status: 'success', globalNotFound: true }, [
        { status: 'error' },
      ]),
    ).toBe('notFound');
  });

  it('is no error page when everything loaded', () => {
    expect(errorPageKind(loaded, [loaded, loaded])).toBeNull();
  });
});
