import { describe, expect, it } from 'vitest';

import ar from '../messages/ar.json';
import en from '../messages/en.json';
import fr from '../messages/fr.json';

type Variant = { readonly match: Readonly<Record<string, string>> };

type Message = string | readonly Variant[];

const LOCALE_FILES = { ar, en, fr } as Record<
  string,
  Record<string, Message | undefined>
>;

const PLACEHOLDER = /\{(\w+)\}/g;

const DERIVED_FROM_CITY: Readonly<Record<string, string>> = {
  cityAfterArticle: 'city',
};

/** Every text a locale can render for a message, with its variants flattened out. */
const textsIn = (message: Message): string[] =>
  typeof message === 'string'
    ? [message]
    : message.flatMap((variant) => Object.values(variant.match));

/**
 * The inputs a text interpolates. French writes "au Caire" by selecting on the city's article and
 * naming `cityAfterArticle`, which `cityInputs` derives from the same `city` the other locales name,
 * so it counts as that city.
 */
const placeholdersIn = (text: string): string[] =>
  [...text.matchAll(PLACEHOLDER)]
    .map((match) => DERIVED_FROM_CITY[match[1]] ?? match[1])
    .sort();

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
      const [english = ''] = textsIn(LOCALE_FILES.en[key] ?? '');
      const expected = placeholdersIn(english);
      for (const [locale, messages] of Object.entries(LOCALE_FILES)) {
        for (const text of textsIn(messages[key] ?? '')) {
          expect(
            placeholdersIn(text),
            `${key} placeholder drift in ${locale}`,
          ).toEqual(expected);
        }
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
