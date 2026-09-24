import { describe, expect, it } from 'vitest';

import { LOCALES, sign_in } from '@founders-coffee/i18n';

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

  it.each(LOCALES)(
    'leaves the sign-in title a whole phrase in %s, not a preposition with nothing after it',
    (locale) => {
      const [{ title }] = privatePageHead(sign_in({}, { locale })).meta;

      expect(title).not.toMatch(/(?:to|à|إلى)$/u);
      expect(title?.startsWith('Founders Coffee - ')).toBe(true);
      expect(title?.replace('Founders Coffee - ', '')).not.toBe('');
    },
  );
});
