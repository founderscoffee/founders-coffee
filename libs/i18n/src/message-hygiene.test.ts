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

const MARKDOWN_LINK = /\[[^\]]+\]\(\/[^)]+\)/g;

/** Every string a reader can end up seeing, with a message's plural variants flattened out. */
const textsIn = (message: Message): string[] =>
  typeof message === 'string'
    ? [message]
    : message.flatMap((variant) => Object.values(variant.match));

const everyText = (): [string, string, string][] =>
  Object.entries(LOCALE_FILES).flatMap(([locale, messages]) =>
    Object.entries(messages).flatMap(([key, message]) =>
      message === undefined
        ? []
        : textsIn(message).map((text): [string, string, string] => [
            locale,
            key,
            text,
          ]),
    ),
  );

describe('message catalogue hygiene', () => {
  it('reads every locale', () => {
    expect(everyText().length).toBeGreaterThan(1500);
  });

  it('ships no unresolved bracket placeholder', () => {
    for (const [locale, key, text] of everyText()) {
      expect(
        text.replace(MARKDOWN_LINK, ''),
        `${locale}:${key} still carries a bracket placeholder`,
      ).not.toMatch(/\[/);
    }
  });

  it('writes tanwin al-fath one way, with the fatha before the alif', () => {
    for (const [locale, key, text] of everyText()) {
      expect(text, `${locale}:${key} splits tanwin as اً`).not.toMatch(/اً/);
    }
  });

  it('keeps em dashes out of product copy', () => {
    for (const [locale, key, text] of everyText()) {
      expect(text, `${locale}:${key} contains an em dash`).not.toMatch(/—/);
    }
  });
});
