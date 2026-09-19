import { describe, expect, it } from 'vitest';

import { privatePageHead } from './seo-private';

describe('private page metadata', () => {
  it('adds the shared title template while keeping private pages noindex', () => {
    expect(privatePageHead('Notifications')).toEqual({
      meta: [
        { title: 'Founders Coffee - Notifications' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
    });
  });
});
