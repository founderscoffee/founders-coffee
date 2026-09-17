import { describe, expect, it } from 'vitest';

import { errorPageHead } from './seo-error';

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
