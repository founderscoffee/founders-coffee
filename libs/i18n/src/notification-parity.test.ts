import { describe, expect, it } from 'vitest';

import ar from '../messages/ar.json';
import en from '../messages/en.json';
import fr from '../messages/fr.json';

const LOCALE_FILES = { ar, en, fr } as Record<
  string,
  Record<string, string | undefined>
>;

const PLACEHOLDER = /\{(\w+)\}/g;

const placeholdersIn = (value: string): string[] =>
  [...value.matchAll(PLACEHOLDER)].map((match) => match[1]).sort();

const notificationKeys = Object.keys(en).filter((key) =>
  key.startsWith('ntf_'),
);

describe('notification message parity', () => {
  it('defines notification keys at all', () => {
    expect(notificationKeys.length).toBeGreaterThan(0);
  });

  it.each(notificationKeys)('%s exists in every locale', (key) => {
    for (const [locale, messages] of Object.entries(LOCALE_FILES)) {
      expect(messages[key], `${key} missing from ${locale}`).toBeTruthy();
    }
  });

  it.each(notificationKeys)(
    '%s interpolates the same placeholders in every locale',
    (key) => {
      const expected = placeholdersIn(en[key as keyof typeof en] as string);
      for (const [locale, messages] of Object.entries(LOCALE_FILES)) {
        expect(
          placeholdersIn(messages[key] as string),
          `${key} placeholder drift in ${locale}`,
        ).toEqual(expected);
      }
    },
  );

  it('keeps every locale file at identical key parity', () => {
    const keys = Object.entries(LOCALE_FILES).map(([, messages]) =>
      Object.keys(messages).sort().join('\n'),
    );
    expect(new Set(keys).size).toBe(1);
  });
});
